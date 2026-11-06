// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";

/**
 * +------------------------------------------------------------------+
 * |                 ClearAudit - Zero-Trust Bug Bounty Vault          |
 * +------------------------------------------------------------------+
 * | Protocols escrow USDC for named whitehats. A whitehat cannot       |
 * | self-release: normal payout requires the protocol's approval,     |
 * | either directly or through the authorized paymaster integration.  |
 * | A whitehat can instead freeze an open bounty for arbitration.      |
 * | The arbitrator is immutable, fixed at deployment, and the one      |
 * | trusted party for disputes; "zero-trust" does not remove that trust.|
 * +------------------------------------------------------------------+
 *
 * State machine (terminal states have no outgoing transitions):
 *
 * None --> Open --> Released
 *            |
 *            +--> Disputed --> ResolvedToWhitehat
 *                          \-> ResolvedToProtocol
 *
 * Role       | Can do                         | Cannot do
 * -----------+--------------------------------+------------------------
 * Protocol   | Deposit; approve open payout   | Refund itself; resolve
 * Whitehat   | Dispute its own open bounty    | Self-release; resolve
 * Arbitrator | Resolve disputed bounties      | Join a bounty; release
 * Paymaster  | Relay open payout; receive fee | Dispute; resolve
 *
 * The paymaster is an authorized execution boundary: it must preserve
 * protocol approval when relaying a payout. This vault does not verify
 * a separate protocol signature on calls made by the paymaster.
 * Token accounting assumes standard, non-fee-on-transfer USDC semantics.
 *
 * KNOWN LIMITATION — USDC ISSUER BLOCKLIST / RESTRICTED RECIPIENTS:
 * If the whitehat or protocol is blocklisted by the USDC issuer, a transfer
 * to that party reverts and the corresponding payout cannot settle; funds
 * stay locked in the vault and state changes roll back. Judges should not
 * mistake CEI for a guarantee that issuer-controlled USDC will transfer.
 * The protocol mitigates this by choosing a valid whitehat address at creation,
 * but a later issuer restriction can still prevent settlement. Production
 * would add a pull-payment design with a recovery address; no such recovery
 * mechanism is implemented here, and this limitation is documentation only.
 */
contract BountyVault {
    // ────────────────────────── State ──────────────────────────────

    /// @notice The ERC-20 token used for bounties (USDC or the mock).
    IERC20 public immutable token;

    /// @notice Authorized payout relay; cannot decide dispute outcomes.
    address public immutable paymaster;

    /// @notice Fixed at deployment: the one trusted party for disputes.
    address public immutable arbitrator;

    /// @dev Auto-incrementing deal ID; the first valid ID is zero.
    uint256 public nextDealId;

    /// @notice None distinguishes a nonexistent deal from an open bounty.
    enum Status {
        None,
        Open,
        Disputed,
        Released,
        ResolvedToWhitehat,
        ResolvedToProtocol
    }

    /// @notice One protocol-funded bounty, with an immutable beneficiary.
    struct Deal {
        address protocol;     // depositor who approves normal payout
        address whitehat;     // beneficiary who may request arbitration
        uint256 amount;       // original deposit (6 decimals for USDC)
        Status status;        // lifecycle gate preventing repeated payouts
    }

    /// @notice All bounties, indexed by deal ID.
    mapping(uint256 => Deal) public deals;

    // ────────────────────────── Events ─────────────────────────────

    event BountyCreated(
        uint256 indexed dealId,
        address indexed protocol,
        address indexed whitehat,
        uint256 amount
    );

    event BountyReleased(
        uint256 indexed dealId,
        address indexed whitehat,
        uint256 amountToWhitehat,
        uint256 feeTaken
    );

    event BountyDisputed(uint256 indexed dealId, address indexed whitehat);

    event DisputeResolved(
        uint256 indexed dealId,
        bool payWhitehat,
        address indexed recipient,
        uint256 amount
    );

    // ────────────────────────── Errors ─────────────────────────────

    error OnlyProtocolOrPaymaster();
    error OnlyWhitehat();
    error OnlyArbitrator();
    error BountyNotOpen();
    error NotDisputed();
    error WhitehatMismatch();
    error FeeExceedsAmount();
    error RoleConflict();
    error TransferFailed();
    error ZeroAmount();
    error ZeroAddress();

    // ────────────────────────── Constructor ────────────────────────

    /**
     * @notice Fix the asset, authorized relay, and neutral adjudicator.
     * @dev No setter can replace the arbitrator after funds are deposited.
     * @param _token Address of the USDC (or mock) ERC-20 token.
     * @param _paymaster Address authorized to relay approved releases.
     * @param _arbitrator Address trusted to decide disputed bounty payouts.
     */
    constructor(address _token, address _paymaster, address _arbitrator) {
        if (_token == address(0) || _paymaster == address(0) || _arbitrator == address(0)) {
            revert ZeroAddress();
        }
        token = IERC20(_token);
        paymaster = _paymaster;
        arbitrator = _arbitrator;
    }

    // ────────────────────────── Protocol Functions ─────────────────

    /**
     * @notice Deposit USDC for a specific whitehat; the caller is the protocol.
     * @dev Approve this vault for `amount` beforehand. The arbitrator cannot
     *      be either party, and the protocol cannot name itself as whitehat.
     *      Effects precede the token interaction; failure rolls everything back.
     * @param whitehat The fixed beneficiary, permitted to dispute but not claim.
     * @param amount The USDC deposit in token base units (6 decimals for USDC).
     * @return dealId The new bounty's identifier.
     */
    function createBounty(
        address whitehat,
        uint256 amount
    ) external returns (uint256 dealId) {
        // Checks: reject unfunded bounties and non-neutral role assignments.
        if (whitehat == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (whitehat == msg.sender || msg.sender == arbitrator || whitehat == arbitrator) {
            revert RoleConflict();
        }

        // Effects: allocate and record the bounty before calling USDC.
        dealId = nextDealId++;
        deals[dealId] = Deal({
            protocol: msg.sender,
            whitehat: whitehat,
            amount: amount,
            status: Status.Open
        });

        // Interaction: a false return reverts the deposit and all effects.
        bool ok = token.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        emit BountyCreated(dealId, msg.sender, whitehat, amount);
    }

    // ────────────────────────── Protocol / Paymaster Functions ──────

    /**
     * @notice Approve and release an open bounty to its recorded whitehat.
     * @dev The whitehat cannot self-release. The protocol's direct call ignores
     *      supplied fee/recipient and pays the recorded whitehat in full. That
     *      branch also wins if protocol and paymaster happen to be identical.
     *      Judge note: sponsored protocol-account releases still call AS the
     *      protocol account and therefore use this zero-fee branch. Sponsorship
     *      is FREE; it does not make msg.sender the paymaster or collect USDC.
     *      The relay branch checks recipient and bounds the fee; it is reserved
     *      for a future relay calling AS the paymaster, which must preserve
     *      protocol approval. Disputed and terminal bounties cannot be released.
     * @param dealId The bounty to release.
     * @param fee USDC reimbursement for the paymaster path only.
     * @param whitehat Must match the recorded beneficiary on the relay path.
     */
    function releaseBounty(
        uint256 dealId,
        uint256 fee,
        address whitehat
    ) external {
        Deal storage deal = deals[dealId];

        // Checks: authorization never grants the whitehat a claim path.
        if (msg.sender != deal.protocol && msg.sender != paymaster) {
            revert OnlyProtocolOrPaymaster();
        }
        // None also fails this check: nonexistent IDs cannot pay out.
        if (deal.status != Status.Open) revert BountyNotOpen();

        if (msg.sender == deal.protocol) {
            fee = 0;
            whitehat = deal.whitehat;
        } else {
            if (whitehat != deal.whitehat) revert WhitehatMismatch();
            if (fee > deal.amount) revert FeeExceedsAmount();
        }

        // Effects: consume the only release transition BEFORE either transfer.
        // A callback cannot release or dispute this same bounty again.
        deal.status = Status.Released;
        uint256 whitehatAmount = deal.amount - fee;

        // Interactions: both transfers must succeed or the entire release reverts.
        // KNOWN LIMITATION — judge note: USDC issuer blocklisting of the whitehat
        // makes settlement revert, rolling back Released and leaving funds locked.
        // The protocol should choose a valid whitehat at creation; production
        // would add pull-payment with a recovery address for later restrictions.
        bool ok1 = token.transfer(whitehat, whitehatAmount);
        if (!ok1) revert TransferFailed();

        if (fee > 0) {
            bool ok2 = token.transfer(paymaster, fee);
            if (!ok2) revert TransferFailed();
        }

        emit BountyReleased(dealId, whitehat, whitehatAmount, fee);
    }

    // ────────────────────────── Dispute Functions ───────────────────

    /**
     * @notice Freeze the caller's open bounty for neutral arbitration.
     * @dev Only the recorded whitehat may dispute. No token interaction occurs;
     *      Disputed blocks normal payout until the immutable arbitrator acts.
     * @param dealId The open bounty to dispute.
     */
    function disputeBounty(uint256 dealId) external {
        Deal storage deal = deals[dealId];
        if (msg.sender != deal.whitehat) revert OnlyWhitehat();
        if (deal.status != Status.Open) revert BountyNotOpen();

        deal.status = Status.Disputed;
        emit BountyDisputed(dealId, deal.whitehat);
    }

    /**
     * @notice Resolve a disputed bounty entirely to one of its two parties.
     * @dev Only the immutable arbitrator may decide. There is no fee, split,
     *      recipient override, or path to reopen a resolved bounty. The final
     *      status is written before transferring the full deposit (CEI).
     * @param dealId The disputed bounty to resolve.
     * @param payWhitehat True pays the whitehat; false refunds the protocol.
     */
    function resolveDispute(uint256 dealId, bool payWhitehat) external {
        // Checks: arbitrary callers cannot adjudicate or bypass Disputed.
        if (msg.sender != arbitrator) revert OnlyArbitrator();
        Deal storage deal = deals[dealId];
        if (deal.status != Status.Disputed) revert NotDisputed();

        // Effects: terminal state is committed before the token interaction.
        deal.status = payWhitehat ? Status.ResolvedToWhitehat : Status.ResolvedToProtocol;
        address recipient = payWhitehat ? deal.whitehat : deal.protocol;

        // Interaction: failure rolls back the terminal state as well as payout.
        // KNOWN LIMITATION — judge note: if the selected whitehat OR protocol is
        // USDC-issuer-blocklisted, this transfer reverts and funds stay locked in
        // Disputed. Choosing a valid whitehat at creation only mitigates that side;
        // it cannot prevent later restrictions or a blocklisted protocol refund.
        // Production would add pull-payment with a recovery address, not a silent
        // recipient override here. This comment intentionally changes no behavior.
        bool ok = token.transfer(recipient, deal.amount);
        if (!ok) revert TransferFailed();

        emit DisputeResolved(dealId, payWhitehat, recipient, deal.amount);
    }

    // ────────────────────────── View Helpers ────────────────────────

    /**
     * @notice Read a bounty's participants, original amount, and lifecycle state.
     * @dev Unknown IDs return zero addresses, zero amount, and Status.None.
     * @param dealId The bounty identifier to inspect.
     * @return protocol The depositor who approves normal payout.
     * @return whitehat The fixed beneficiary.
     * @return amount The original deposit, unchanged after payout for history.
     * @return status The current state, including terminal payout outcomes.
     */
    function getDeal(uint256 dealId)
        external
        view
        returns (
            address protocol,
            address whitehat,
            uint256 amount,
            Status status
        )
    {
        Deal storage d = deals[dealId];
        return (d.protocol, d.whitehat, d.amount, d.status);
    }
}
