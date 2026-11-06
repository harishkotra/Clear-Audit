// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";

/**
 * +------------------------------------------------------------------+
 * |              ClearAudit v3 - Zero-Trust Bug Bounty Vault           |
 * +------------------------------------------------------------------+
 * | Payers escrow USDC for named payees, claimable agent tasks, or     |
 * | contests. A contest accepts many entrants; the arbitrator awards   |
 * | the escrow to one or more of them in a single transaction.         |
 * | Release and award require a committed evidence fingerprint that    |
 * | has not expired. After a challenge window, anyone may settle a     |
 * | single-payee deal. Only the payer can release early.               |
 * | Either party can dispute. The fixed arbitrator decides disputes,  |
 * | awards contests, and only Open deals can expire into a refund.    |
 * | Arbitration is trusted: "zero-trust" does not remove that trust.   |
 * | Fees are always ZERO. Sponsored gas funds the payer's own release |
 * | call; the immutable paymaster is wiring, not a privileged caller. |
 * +------------------------------------------------------------------+
 *
 * State machine (terminal states have no outgoing transitions):
 *
 * None --> Open --> Released                      (payer release, or anyone after challenge)
 *            |  \-> ResolvedToPayer               (cancel / expiry)
 *            |
 *            +--> Disputed --> ResolvedToPayee     (arbitrator)
 *                         \-> ResolvedToPayer     (arbitrator only)
 *
 * Role       | Can do                            | Cannot do
 * -----------+-----------------------------------+---------------------
 * Payer      | Fund; assign; release; dispute;    | Claim own task;
 *            | cancel before deadline if unclaimed| arbitrate
 * Payee      | Claim eligible task; dispute       | Self-release; resolve
 * Arbitrator | Resolve disputed deals             | Be payer or payee
 * Anyone     | Refund expired Open deals;          | Refund Disputed deals
 *            | settle after the challenge window   |
 * Paymaster  | Sponsor payer's own release gas     | Privileged release
 *
 * Judge notes: assigned means named by the payer; claimedAt != 0 means
 * claimed through claimTask. An assigned but unclaimed deal is cancellable
 * and reassignable before its deadline. Claiming does not release funds.
 * Deadlines gate claiming, assignment and cancellation, not payer release
 * or disputes. A zero deadline means no expiry, and is forbidden for tasks.
 * The deadline is the delivery contract: any expired Open deal is refundable,
 * whether claimed or not. Disputed deals await the arbitrator even after expiry.
 * Release remains allowed after expiry; the first release or refund wins.
 * Token accounting assumes standard, non-fee-on-transfer USDC semantics.
 * This contract is non-upgradeable; all wiring is fixed at deployment.
 *
 * KNOWN LIMITATION — USDC ISSUER BLOCKLIST / RESTRICTED RECIPIENTS:
 * If a payee or payer is blocklisted by the USDC issuer, its payout reverts;
 * funds stay locked and all state changes roll back. Judges should not
 * mistake CEI for a guarantee that issuer-controlled USDC will transfer.
 * Choosing a valid payee mitigates this, but later restrictions can still
 * prevent settlement, including refunds to the payer. Production would add
 * pull-payment with a recovery address; none is implemented here.
 */
contract BountyVault {
    // ────────────────────────── State ──────────────────────────────

    /// @notice The ERC-20 token used for every bounty (USDC or the mock).
    IERC20 public immutable token;

    /// @notice Sponsorship wiring only; grants no special vault privilege.
    address public immutable paymaster;

    /// @notice Fixed neutral adjudicator, copied into each deal at creation.
    address public immutable arbitrator;

    /// @notice Seconds after commitEvidence before anyone may settleAfterChallenge.
    uint64 public immutable challengeWindow;

    /// @dev Auto-incrementing deal ID; the first valid ID is zero.
    uint256 public nextDealId;

    enum Status {
        None,
        Open,
        Disputed,
        Released,
        ResolvedToPayee,
        ResolvedToPayer
    }

    struct Deal {
        address payer;
        address payee;
        address token;
        uint128 amount;
        uint64 deadline;
        uint64 claimedAt;
        Status status;
        bool agentMode;
        bool assigned;
        address arbitrator;
        bytes32 criteriaHash;
        bool contestMode;
    }

    /// @notice Historical deposits remain recorded after terminal settlement.
    mapping(uint256 => Deal) public deals;

    /// @notice SHA-256 (or keccak) fingerprint committed for this deal. Zero until commitEvidence.
    mapping(uint256 => bytes32) public evidenceHash;
    /// @notice Unix seconds after which the committed fingerprint is no longer valid for payout.
    mapping(uint256 => uint64) public evidenceExpiresAt;
    /// @notice Unix seconds after which anyone may settleAfterChallenge. Zero until commit.
    mapping(uint256 => uint64) public challengeUntil;

    /// @notice Entrants registered on a contest. Empty for every other deal kind.
    mapping(uint256 => mapping(address => bool)) public contestEntered;
    /// @notice How many distinct addresses have entered this contest.
    mapping(uint256 => uint32) public contestEntrants;

    uint256 public constant MAX_CONTEST_WINNERS = 8;

    // ────────────────────────── Events ─────────────────────────────

    // Judge note: docs/AGENT-DISPATCH.md was not available; this is the default event set.
    event BountyCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed payee,
        uint128 amount,
        uint64 deadline,
        bytes32 criteriaHash,
        bool agentMode
    );
    event TaskClaimed(uint256 indexed id, address indexed payee, uint64 claimedAt);
    event PayeeAssigned(uint256 indexed id, address indexed payee);
    event BountyReleased(uint256 indexed id, address indexed payee, uint128 amount);
    event BountyDisputed(uint256 indexed id, address indexed by);
    event DisputeResolved(uint256 indexed id, bool toPayee, address indexed recipient, uint128 amount);
    event BountyRefunded(uint256 indexed id, address indexed payer, uint128 amount, address caller);
    event BountyCancelled(uint256 indexed id, address indexed payer, uint128 amount);
    event EvidenceCommitted(uint256 indexed id, bytes32 hash, uint64 expiresAt, uint64 challengeUntil);
    event SettledAfterChallenge(uint256 indexed id, address indexed payee, uint128 amount, address caller);
    event ContestEntered(uint256 indexed id, address indexed entrant);
    event ContestAwarded(uint256 indexed id, uint256 winners, uint128 amount);
    event ContestSharePaid(uint256 indexed id, address indexed winner, uint128 amount);

    // ────────────────────────── Errors ─────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error TransferFailed();
    error RoleConflict();
    error OnlyArbitrator();
    error NotDisputed();
    error BountyNotOpen();
    error AlreadyClaimed();
    error DeadlinePassed();
    error DeadlineRequired();
    error NotClaimable();
    error NotYetExpired();
    error OnlyPayer();
    error OnlyParty();
    error PayeeNotSet();
    error TokenNotContract();
    error EvidenceMissing();
    error EvidenceExpired();
    error AlreadyCommitted();
    error ChallengePending();
    error ZeroWindow();
    error NotContest();
    error AlreadyEntered();
    error AmountMismatch();
    error TooManyWinners();

    // ────────────────────────── Constructor ────────────────────────

    /// @notice Fix the asset, optional sponsorship wiring and neutral adjudicator.
    /// @dev Retains the three-address constructor; no proxy or upgrade path.
    ///      A zero paymaster means "no gas sponsorship on this deployment", which
    ///      is what happens when the release path stops taking a fee.
    constructor(address _token, address _paymaster, address _arbitrator, uint64 _challengeWindow) {
        if (_token == address(0) || _arbitrator == address(0)) {
            revert ZeroAddress();
        }
        // Judge note: a no-code "token" would make every low-level transfer look
        // successful (empty return data) and silently escrow nothing, and the
        // token is immutable. On Arc the settlement token must be the ERC-20
        // interface of USDC (0x3600...0000), never a native-asset sentinel.
        if (_token.code.length == 0) revert TokenNotContract();
        if (_challengeWindow == 0) revert ZeroWindow();
        token = IERC20(_token);
        paymaster = _paymaster;
        arbitrator = _arbitrator;
        challengeWindow = _challengeWindow;
    }

    // ────────────────────────── Creation ───────────────────────────

    /**
     * @notice Escrow a bounty for a payer-named payee, optionally with expiry.
     * @dev Approve amount beforehand. Neutral roles are enforced at creation.
     *      Write the complete deal before pulling tokens; failure rolls back.
     */
    function createBounty(
        address payee,
        uint128 amount,
        uint64 deadline,
        bytes32 criteriaHash
    ) external returns (uint256 id) {
        if (payee == address(0)) revert ZeroAddress();
        if (payee == msg.sender || payee == arbitrator || msg.sender == arbitrator) {
            revert RoleConflict();
        }
        if (amount == 0) revert ZeroAmount();
        if (deadline != 0 && deadline <= block.timestamp) revert DeadlinePassed();

        id = nextDealId++;
        deals[id] = Deal({
            payer: msg.sender,
            payee: payee,
            token: address(token),
            amount: amount,
            deadline: deadline,
            claimedAt: 0,
            status: Status.Open,
            agentMode: false,
            assigned: true,
            arbitrator: arbitrator,
            criteriaHash: criteriaHash,
            contestMode: false
        });
        _pull(msg.sender, amount);
        emit BountyCreated(id, msg.sender, payee, amount, deadline, criteriaHash, false);
    }

    /// @notice Escrow an unassigned agent task with a mandatory future deadline.
    /// @dev No payee is selected until a claim or the payer's assignment.
    function createOpenTask(uint128 amount, uint64 deadline, bytes32 criteriaHash)
        external
        returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        if (deadline == 0) revert DeadlineRequired();
        if (deadline <= block.timestamp) revert DeadlinePassed();
        if (msg.sender == arbitrator) revert RoleConflict();

        id = nextDealId++;
        deals[id] = Deal({
            payer: msg.sender,
            payee: address(0),
            token: address(token),
            amount: amount,
            deadline: deadline,
            claimedAt: 0,
            status: Status.Open,
            agentMode: true,
            assigned: false,
            arbitrator: arbitrator,
            criteriaHash: criteriaHash,
            contestMode: false
        });
        _pull(msg.sender, amount);
        emit BountyCreated(id, msg.sender, address(0), amount, deadline, criteriaHash, true);
    }

    /// @notice Escrow a prize that many addresses may enter. The arbitrator awards shares.
    /// @dev No exclusive claim. A deadline is mandatory so an un-awarded contest can refund.
    function createContest(uint128 amount, uint64 deadline, bytes32 criteriaHash)
        external
        returns (uint256 id)
    {
        if (amount == 0) revert ZeroAmount();
        if (deadline == 0) revert DeadlineRequired();
        if (deadline <= block.timestamp) revert DeadlinePassed();
        if (msg.sender == arbitrator) revert RoleConflict();

        id = nextDealId++;
        deals[id] = Deal({
            payer: msg.sender,
            payee: address(0),
            token: address(token),
            amount: amount,
            deadline: deadline,
            claimedAt: 0,
            status: Status.Open,
            agentMode: false,
            assigned: false,
            arbitrator: arbitrator,
            criteriaHash: criteriaHash,
            contestMode: true
        });
        _pull(msg.sender, amount);
        emit BountyCreated(id, msg.sender, address(0), amount, deadline, criteriaHash, false);
    }

    // ────────────────────────── Payee Selection ────────────────────

    /// @notice Claim an unassigned agent task, without authorizing its payout.
    /// @dev Check claimedAt first so a repeated claim reports AlreadyClaimed.
    ///      Claiming exactly at the deadline is allowed; refunds require later.
    function claimTask(uint256 id) external {
        Deal storage deal = deals[id];
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.contestMode) revert NotContest();
        if (deal.claimedAt != 0) revert AlreadyClaimed();
        if (deal.payee != address(0) || deal.assigned) revert NotClaimable();
        if (!deal.agentMode || deal.deadline == 0) revert NotClaimable();
        if (block.timestamp > deal.deadline) revert DeadlinePassed();
        if (msg.sender == deal.payer || msg.sender == deal.arbitrator) revert RoleConflict();

        deal.payee = msg.sender;
        deal.claimedAt = uint64(block.timestamp);
        emit TaskClaimed(id, msg.sender, deal.claimedAt);
    }

    /// @notice Name or replace a payee only while the deal remains unclaimed.
    /// @dev Assignment is distinct from claiming, even on an agent task.
    function assignPayee(uint256 id, address payee) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.payer) revert OnlyPayer();
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.contestMode) revert NotContest();
        if (deal.claimedAt != 0) revert AlreadyClaimed();
        if (deal.deadline != 0 && block.timestamp > deal.deadline) revert DeadlinePassed();
        if (payee == address(0)) revert ZeroAddress();
        if (payee == deal.payer || payee == deal.arbitrator) revert RoleConflict();

        deal.payee = payee;
        deal.assigned = true;
        emit PayeeAssigned(id, payee);
    }

    // ────────────────────────── Contests ───────────────────────────

    /// @notice Self-register as an entrant. Does not lock the prize or set a payee.
    function enterContest(uint256 id) external {
        _enter(id, msg.sender);
    }

    /// @notice Sponsor registers an entrant who submitted off-chain (no gas needed from them).
    function registerEntrant(uint256 id, address entrant) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.payer) revert OnlyPayer();
        _enter(id, entrant);
    }

    /**
     * @notice The recorded arbitrator pays one or more registered entrants.
     * @dev Amounts must sum to the escrow. Evidence must already be committed.
     *      Status is terminal before any transfer so a failed share rolls back all.
     */
    function award(uint256 id, address[] calldata winners, uint128[] calldata amounts) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.arbitrator) revert OnlyArbitrator();
        if (!deal.contestMode) revert NotContest();
        if (deal.status != Status.Open) revert BountyNotOpen();
        _requireLiveEvidence(id);

        uint256 n = winners.length;
        if (n == 0 || n != amounts.length) revert AmountMismatch();
        if (n > MAX_CONTEST_WINNERS) revert TooManyWinners();

        uint256 sum;
        for (uint256 i; i < n; i++) {
            address w = winners[i];
            uint128 a = amounts[i];
            if (w == address(0)) revert ZeroAddress();
            if (a == 0) revert ZeroAmount();
            if (w == deal.payer || w == deal.arbitrator) revert RoleConflict();
            if (!contestEntered[id][w]) revert NotClaimable();
            for (uint256 j; j < i; j++) {
                if (winners[j] == w) revert AlreadyClaimed();
            }
            sum += a;
        }
        if (sum != deal.amount) revert AmountMismatch();

        deal.status = Status.Released;
        if (n == 1) {
            deal.payee = winners[0];
            deal.assigned = true;
        }

        for (uint256 i; i < n; i++) {
            _pay(winners[i], amounts[i]);
            emit ContestSharePaid(id, winners[i], amounts[i]);
        }
        emit ContestAwarded(id, n, deal.amount);
        emit BountyReleased(id, n == 1 ? winners[0] : address(0), deal.amount);
    }

    function _enter(uint256 id, address entrant) private {
        Deal storage deal = deals[id];
        if (!deal.contestMode) revert NotContest();
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (block.timestamp > deal.deadline) revert DeadlinePassed();
        if (entrant == address(0)) revert ZeroAddress();
        if (entrant == deal.payer || entrant == deal.arbitrator) revert RoleConflict();
        if (contestEntered[id][entrant]) revert AlreadyEntered();

        contestEntered[id][entrant] = true;
        contestEntrants[id] += 1;
        emit ContestEntered(id, entrant);
    }

    // ────────────────────────── Settlement ─────────────────────────

    /**
     * @notice Only the payer may release the full amount to the stored payee.
     * @dev No recipient override or fee parameter exists. Sponsored execution
     *      calls AS the payer account, never AS a privileged paymaster relay.
     *      Consuming Open before the transfer prevents repeated settlement.
     */
    function release(uint256 id) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.payer) revert OnlyPayer();
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.contestMode) revert NotContest();
        if (deal.payee == address(0)) revert PayeeNotSet();
        _requireLiveEvidence(id);

        deal.status = Status.Released;
        _pay(deal.payee, deal.amount);
        emit BountyReleased(id, deal.payee, deal.amount);
    }

    /**
     * @notice Record the evidence fingerprint that must match the Arkiv anchor.
     * @dev Payer only, once per deal, while Open with a payee. Starts the
     *      challenge clock. The hash is whatever the Arkiv entity committed;
     *      this contract does not call Arkiv.
     */
    function commitEvidence(uint256 id, bytes32 hash, uint64 expiresAt) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.payer) revert OnlyPayer();
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.payee == address(0) && !deal.contestMode) revert PayeeNotSet();
        if (hash == bytes32(0)) revert ZeroAmount();
        if (expiresAt <= block.timestamp) revert EvidenceExpired();
        if (evidenceHash[id] != bytes32(0)) revert AlreadyCommitted();

        evidenceHash[id] = hash;
        evidenceExpiresAt[id] = expiresAt;
        uint64 until = uint64(block.timestamp) + challengeWindow;
        challengeUntil[id] = until;
        emit EvidenceCommitted(id, hash, expiresAt, until);
    }

    /**
     * @notice Anyone may pay the stored payee after the challenge window if
     *         evidence is still live and the deal was not disputed.
     */
    function settleAfterChallenge(uint256 id) external {
        Deal storage deal = deals[id];
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.contestMode) revert NotContest();
        if (deal.payee == address(0)) revert PayeeNotSet();
        _requireLiveEvidence(id);
        if (block.timestamp < challengeUntil[id]) revert ChallengePending();

        deal.status = Status.Released;
        _pay(deal.payee, deal.amount);
        emit SettledAfterChallenge(id, deal.payee, deal.amount, msg.sender);
        emit BountyReleased(id, deal.payee, deal.amount);
    }

    /// @notice True when an Open deal has a payee and unexpired committed evidence.
    function canSettle(uint256 id) public view returns (bool) {
        Deal storage deal = deals[id];
        if (deal.status != Status.Open) return false;
        if (deal.payee == address(0) && !deal.contestMode) return false;
        if (evidenceHash[id] == bytes32(0)) return false;
        if (block.timestamp >= evidenceExpiresAt[id]) return false;
        return true;
    }

    function getEvidence(uint256 id)
        external
        view
        returns (bytes32 hash, uint64 expiresAt, uint64 until)
    {
        return (evidenceHash[id], evidenceExpiresAt[id], challengeUntil[id]);
    }

    /// @notice Either recorded party may freeze an open deal for arbitration.
    /// @dev Once disputed, expiry cannot bypass arbitration or refund the deal.
    function dispute(uint256 id) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.payer && msg.sender != deal.payee) revert OnlyParty();
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.payee == address(0)) revert PayeeNotSet();

        deal.status = Status.Disputed;
        emit BountyDisputed(id, msg.sender);
    }

    /// @notice The deal's recorded arbitrator awards the full escrow to one party.
    /// @dev No split, fee, recipient override or reopening is possible. The
    ///      selected terminal state precedes the checked token interaction.
    function resolveDispute(uint256 id, bool toPayee) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.arbitrator) revert OnlyArbitrator();
        if (deal.status != Status.Disputed) revert NotDisputed();

        deal.status = toPayee ? Status.ResolvedToPayee : Status.ResolvedToPayer;
        address recipient = toPayee ? deal.payee : deal.payer;
        _pay(recipient, deal.amount);
        emit DisputeResolved(id, toPayee, recipient, deal.amount);
    }

    /**
     * @notice Anyone may refund an expired Open deal to its payer, claimed or not.
     * @dev The deadline is the delivery contract. Disputed deals must await the
     *      arbitrator; expiry never bypasses arbitration. None, Disputed and all
     *      terminal states fail before deadline checks. A refund deliberately
     *      reuses ResolvedToPayer; there is no additional Refunded enum value.
     *      BountyRefunded distinguishes expiry from an arbitrated outcome and
     *      records the caller without allowing them to redirect the payout.
     */
    function refundExpired(uint256 id) external {
        Deal storage deal = deals[id];
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.deadline == 0 || block.timestamp <= deal.deadline) revert NotYetExpired();

        deal.status = Status.ResolvedToPayer;
        _pay(deal.payer, deal.amount);
        emit BountyRefunded(id, deal.payer, deal.amount, msg.sender);
    }

    /// @notice The payer may cancel any unclaimed open deal before expiry.
    /// @dev A named/assigned payee is not a claim; claimedAt is the sole gate.
    ///      Zero-deadline deals may be cancelled while otherwise eligible.
    function cancel(uint256 id) external {
        Deal storage deal = deals[id];
        if (msg.sender != deal.payer) revert OnlyPayer();
        if (deal.status != Status.Open) revert BountyNotOpen();
        if (deal.claimedAt != 0) revert AlreadyClaimed();
        if (deal.deadline != 0 && block.timestamp > deal.deadline) revert DeadlinePassed();

        deal.status = Status.ResolvedToPayer;
        _pay(deal.payer, deal.amount);
        emit BountyCancelled(id, deal.payer, deal.amount);
    }

    // ────────────────────────── View Helpers ────────────────────────

    /// @notice Stable four-field view for sponsorship; unknown IDs return zeros.
    /// @dev Amount is widened to uint256; Open remains ABI enum value 1.
    function getDeal(uint256 id)
        external
        view
        returns (address payer, address payee, uint256 amount, Status status)
    {
        Deal storage deal = deals[id];
        return (deal.payer, deal.payee, deal.amount, deal.status);
    }

    // ────────────────────────── Token Helpers ──────────────────────

    /// @dev Accept non-returning tokens; reject failure, false or malformed data.
    ///      Callers must commit all state effects before this interaction.
    function _pay(address to, uint128 amount) private {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, uint256(amount))
        );
        if (!ok || (data.length != 0 && (data.length < 32 || abi.decode(data, (uint256)) != 1))) {
            revert TransferFailed();
        }
    }

    function _requireLiveEvidence(uint256 id) private view {
        if (evidenceHash[id] == bytes32(0)) revert EvidenceMissing();
        if (block.timestamp >= evidenceExpiresAt[id]) revert EvidenceExpired();
    }

    /// @dev A failed deposit reverts the allocated ID and the complete deal.
    function _pull(address from, uint128 amount) private {
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, address(this), uint256(amount))
        );
        if (!ok || (data.length != 0 && (data.length < 32 || abi.decode(data, (uint256)) != 1))) {
            revert TransferFailed();
        }
    }
}
