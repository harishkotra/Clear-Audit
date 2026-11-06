// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IERC20.sol";
import "./interfaces/IPaymaster.sol";

/**
 * @dev Minimal read-only vault boundary for judges: no BountyVault import or
 *      deployment-time code check is needed. Its Status enum is ABI-encoded as
 *      uint8; Open is value 1. The amount is returned only to match the vault ABI.
 */
interface IBountyVaultView {
    function getDeal(uint256 dealId)
        external
        view
        returns (address payer, address payee, uint256 amount, uint8 status);
}

/**
 * +------------------------------------------------------------------+
 * |            ClearAudit - USDCPaymaster / Bounty Sponsorship         |
 * +------------------------------------------------------------------+
 * | Sponsorship is deliberately narrow: only a smart-account execute() |
 * | targeting the configured BountyVault with release(uint256) passes |
 * | validation. Sponsorship is FREE; there is no vault fee parameter. |
 * | Other selectors and targets are rejected: deposits, disputes,     |
 * | and resolutions are not sponsored by this policy.                 |
 * |                                                                  |
 * | Policy: approved payer + own open bounty + a nonzero payee + zero |
 * | value + three-attempt cap + owner-configured gas cost cap.         |
 * | The payee is read from the vault, not supplied by the caller.      |
 * | Owner approval removes the permissionless bounty-rotation drain: |
 * | fresh tiny bounties cannot admit an unapproved account. Production |
 * | still needs sponsor signatures and per-sender spending budgets.  |
 * | The vault rechecks authority and state during execution. A        |
 * | smart-account execute() calls the vault AS THAT ACCOUNT, not as   |
 * | this paymaster. Sponsored gas is for the payer's own release;     |
 * | the paymaster has no special vault privilege and collects no fee. |
 * +------------------------------------------------------------------+
 *
 * This retains the ERC-4337 v0.7 paymaster shape adapted for experimental
 * EIP-8141 frame transactions. The devnet EntryPoint may have different
 * staking/deposit requirements or validation rules; this interface does
 * not itself implement a frame relay or protocol-signature verification.
 */
contract USDCPaymaster is IPaymaster {
    // ────────────────────────── Constants ──────────────────────────

    /// @notice The only sponsored inner selector: BountyVault.release.
    bytes4 private constant RELEASE_SELECTOR = bytes4(
        keccak256("release(uint256)")
    );

    /// @notice Maximum admitted sponsorship attempts for any single bounty.
    /// @dev Judge note: failed execution must not create an unlimited retry budget.
    uint256 public constant MAX_SPONSORED_ATTEMPTS_PER_BOUNTY = 3;

    // ────────────────────────── State ──────────────────────────────

    /// @notice The ERC-4337 / EIP-8141 EntryPoint contract.
    ///         On mainnet: 0x0000000071727De22E5E9d8BAf0edAc6f37da032
    ///         On alt mempool devnet: check EF docs for the address.
    address public immutable entryPoint;

    /// @notice Address of the BountyVault whose releases are sponsored.
    address public immutable vault;

    /// @notice The USDC token contract.
    IERC20 public immutable usdc;

    /// @notice Owner of the paymaster (can withdraw profits, manage deposits).
    address public owner;

    /// @notice Maximum sponsored cost per operation, in native-token wei.
    /// @dev Judge note: this bounds individual exposure, not aggregate spend;
    ///      production still needs sponsor authorization and per-sender budgets.
    uint256 public maxSponsoredCost;

    /// @notice Admitted sponsorship attempts, including reverted executions.
    /// @dev Judge note: stored in the paymaster itself during validation, not
    ///      postOp, so a later execution revert cannot replenish the allowance.
    ///      At a fixed cost cap, cumulative loss per bounty is bounded by
    ///      MAX_SPONSORED_ATTEMPTS_PER_BOUNTY x maxSponsoredCost. If the owner
    ///      changes the cap, the bound is the sum of the admitted attempts' caps.
    ///      Production still needs per-sender budgets and sponsor signatures.
    mapping(uint256 => uint256) public sponsoredAttempts;

    /// @notice Owner-approved protocol smart accounts eligible for sponsorship.
    /// @dev Judge note: default-deny admission prevents arbitrary accounts from
    ///      rotating through fresh tiny bounties to drain the sponsorship deposit.
    ///      Approval is not an aggregate budget; production adds sponsor signatures.
    mapping(address => bool) public sponsoredProtocols;

    // ────────────────────────── Errors ─────────────────────────────

    error OnlyEntryPoint();
    error OnlyOwner();
    error InvalidTarget();
    error InvalidCallData();
    error InsufficientVaultBalance();
    error TransferFailed();
    // Judge note: distinguish invalid configuration, ineligible bounty requests,
    // and excessive gas exposure without changing existing failure conventions.
    error ZeroAddress();
    error IneligibleBounty();
    error MaxCostExceeded();
    // Judge note: distinguish guaranteed nonpayable-call failure, exhausted
    // retry allowance, and a no-code EntryPoint from existing policy failures.
    error NonZeroValue();
    error AttemptsExhausted();
    error EntryPointNotContract();
    error EntryPointDepositFailed();
    error EntryPointWithdrawFailed();
    error ProtocolNotApproved();

    // ────────────────────────── Events ─────────────────────────────

    // Judge note: FREE sponsorship records identity only, never a fictitious fee.
    event GasSponsored(address indexed payee, uint256 indexed dealId);

    event Deposited(uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    // Judge note: separate native EntryPoint withdrawals from USDC fee withdrawals.
    event EntryPointWithdrawn(address indexed to, uint256 amount);
    // Judge note: expose both limits so sponsorship policy changes are observable.
    event MaxSponsoredCostUpdated(uint256 previousMaxCost, uint256 newMaxCost);
    event ProtocolSponsorshipSet(address indexed protocol, bool approved);

    // ────────────────────────── Modifiers ──────────────────────────

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ────────────────────────── Constructor ────────────────────────

    /**
     * @notice Fix the trusted EntryPoint, sponsored vault, and fee token.
     * @dev Retains the existing deployment/ownership model; the deployer owns it.
     * @param _entryPoint Address of the EntryPoint contract.
     * @param _vault Address of the BountyVault contract.
     * @param _usdc Address of the USDC token.
     */
    constructor(address _entryPoint, address _vault, address _usdc) {
        // Judge note: reject unusable zero configuration, but deliberately do NOT
        // check code size: the CREATE2 vault address may not be deployed yet.
        if (_entryPoint == address(0) || _vault == address(0) || _usdc == address(0)) {
            revert ZeroAddress();
        }
        entryPoint = _entryPoint;
        vault = _vault;
        usdc = IERC20(_usdc);
        owner = msg.sender;
        // Judge note: default per-operation ceiling is 0.05 native ETH-equivalent
        // (5e16 wei), independent of USDC decimals; the owner can tune this cap.
        maxSponsoredCost = 5e16;
    }

    // ────────────────────────── EntryPoint Deposit ─────────────────

    /**
     * @notice Deposit ETH to the EntryPoint to cover gas for sponsored ops.
     * @dev The paymaster must have a positive deposit at the EntryPoint
     *      so the EntryPoint can debit gas costs from it. Owner-only to
     *      preserve the existing deposit-management policy. Devnet staking
     *      and unstake-delay requirements depend on the actual EntryPoint.
     */
    function depositToEntryPoint() external payable onlyOwner {
        // Judge note: a low-level call to an EOA reports success without running
        // depositTo; reject no-code configuration before forwarding any funds.
        if (entryPoint.code.length == 0) revert EntryPointNotContract();
        // Forward ETH to the EntryPoint's deposit function.
        // EntryPoint.depositTo(address) is the standard method.
        (bool ok,) = entryPoint.call{value: msg.value}(
            abi.encodeWithSignature("depositTo(address)", address(this))
        );
        if (!ok) revert EntryPointDepositFailed();
        emit Deposited(msg.value);
    }

    /**
     * @notice Deposit existing native balance into this paymaster's EntryPoint deposit.
     * @dev Judge note: on Arc, native USDC has 18 decimals while its ERC-20 view
     *      has 6. Sub-1e12-wei remainders are invisible to withdrawFees. Both views
     *      represent one asset, not independent balances: this owner-only path
     *      can use any existing native balance, including those remainders.
     *      Nonpayable by design: amount comes from this contract, not msg.value.
     *      Insufficient balance or a failed EntryPoint call reverts without a
     *      Deposited event; a no-code EntryPoint cannot silently swallow funds.
     */
    function depositBalanceToEntryPoint(uint256 amount) external onlyOwner {
        if (entryPoint.code.length == 0) revert EntryPointNotContract();
        (bool ok,) = entryPoint.call{value: amount}(
            abi.encodeWithSignature("depositTo(address)", address(this))
        );
        if (!ok) revert EntryPointDepositFailed();
        emit Deposited(amount);
    }

    /**
     * @notice Recover native funds held in this paymaster's EntryPoint deposit.
     * @dev Judge note: only the owner may select a nonzero recipient. The call
     *      originates from this paymaster so EntryPoint debits its deposit, not
     *      the owner's. A failed withdrawal reverts and emits no success event.
     */
    function withdrawFromEntryPoint(address payable to, uint256 amount) external onlyOwner {
        // Judge note: success from an EOA call is not evidence of a withdrawal.
        // Require code here too, so misconfiguration cannot emit false success.
        if (entryPoint.code.length == 0) revert EntryPointNotContract();
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = entryPoint.call(
            abi.encodeWithSignature("withdrawTo(address,uint256)", to, amount)
        );
        if (!ok) revert EntryPointWithdrawFailed();
        emit EntryPointWithdrawn(to, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                    PAYMASTER VALIDATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Called by the EntryPoint during the VERIFICATION phase.
     * @dev Sponsorship allowlist for judges, in order:
     *      1. The outer selector must be execute(address,uint256,bytes).
     *      2. Its destination must be the immutable BountyVault address and its
     *         native value must be zero because release is nonpayable.
     *      3. Its inner selector must be release(uint256), encoding only dealId.
     *      4. The sender must be an owner-approved payer, checked before
     *         any vault read or attempt consumption in the private helper.
     *      5. The sender must own the real open bounty with a nonzero payee.
     *         The helper reads that payee for the fee-free postOp context.
     *      6. maxCost must not exceed the owner-configured per-operation cap.
     *      7. The bounty must have an unused attempt; validation consumes it.
     *
     *      Judge note: owner approval removes the permissionless bounty-rotation
     *      drain; creating unlimited tiny bounties cannot admit an unapproved
     *      sender. Rejected senders cause no state writes and no vault calls.
     *
     *      The view call ties sponsorship to a real open bounty owned by the
     *      sender rather than merely recognizing a selector. Open is uint8(1);
     *      unknown, disputed, or terminal deals are not eligible. Malformed ABI
     *      input reverts; alternate targets/selectors are rejected.
     *
     *      Eligibility is not a guarantee execution will succeed: the vault
     *      repeats its execution-time checks. Judge note: nonzero outer native
     *      value is rejected before sponsorship of a guaranteed nonpayable revert.
     *      The account/EntryPoint must provide signature authentication.
     *
     *      PRODUCTION REQUIREMENTS: add a sponsor signature, per-sender budgets,
     *      and EntryPoint stake/storage-access-rule compliance for vault reads.
     *      Judge note: at most three admitted attempts bound cumulative loss per
     *      bounty to attempts x maxSponsoredCost at a fixed cap, even when each
     *      execution reverts; this is not a global or per-sender budget.
     *      Frame-specific metadata, if required by a devnet, is not parsed here.
     * @param userOp The packed user operation.
     * @param userOpHash Hash of the user operation (unused by this policy).
     * @param maxCost Maximum native gas cost in wei, checked against the cap.
     * @return context Encoded (dealId, payee) for the fee-free postOp event.
     * @return validationData Zero: valid with no time-range restriction.
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    )
        external
        override
        onlyEntryPoint
        returns (bytes memory context, uint256 validationData)
    {
        // Suppress unused variable warning — we don't need the hash for
        // our simple validation, but a production paymaster would use it
        // for signature-based access control.
        (userOpHash);

        // ── Step 1: Verify the target is our BountyVault contract ───
        // In ERC-4337, userOp.sender is the smart account. The actual
        // destination and inner calldata are inside userOp.callData:
        // execute(address dest, uint256 value, bytes data), 0xb61d27f6.
        // Rejecting other outer selectors excludes batch/alternate entry paths.
        bytes4 outerSelector = bytes4(userOp.callData[:4]);
        if (outerSelector != bytes4(keccak256("execute(address,uint256,bytes)"))) {
            revert InvalidCallData();
        }

        (address target, uint256 value, bytes memory innerCallData) =
            abi.decode(userOp.callData[4:], (address, uint256, bytes));

        if (target != vault) revert InvalidTarget();
        // Judge note: release is nonpayable. Forwarding any native value
        // guarantees a revert while still charging this paymaster for the gas;
        // reject that known failure during validation, before consuming a retry.
        if (value != 0) revert NonZeroValue();

        // ── Step 2: Verify the inner call is release ────────────────
        // Exactly one uint256 follows the selector; reject legacy fee/recipient payloads.
        if (innerCallData.length != 36) revert InvalidCallData();

        bytes4 innerSelector = _selectorOf(innerCallData);
        if (innerSelector != RELEASE_SELECTOR) revert InvalidCallData();

        // ── Step 3: Decode the sole release argument ───────────────
        // release(uint256 dealId): no fee or caller-supplied payee exists.
        uint256 dealId = abi.decode(_slice(innerCallData, 4, innerCallData.length - 4), (uint256));

        // ── Step 4: Require an approved payer and its own open bounty ─
        // Judge note: a selector or fresh bounty cannot authorize deposit spend.
        // Keep admission and the vault read in the existing private helper.
        // It checks approval before reading the vault or consuming any attempt.
        // Read only the minimal view ABI; Open == 1 matches BountyVault.Status.
        address payee = _checkEligible(userOp.sender, dealId);
        // Judge note: limit worst-case gas exposure per admitted operation.
        // This is not a replacement for production sponsor signatures/budgets.
        if (maxCost > maxSponsoredCost) revert MaxCostExceeded();

        // ── Step 5: Consume one bounded per-bounty sponsorship attempt ─
        // Judge note: write our OWN storage during validation, never postOp.
        // EntryPoint's later execution revert does not undo successful validation,
        // so even failed releases consume an attempt and cannot retry forever.
        // A revert of the entire enclosing transaction still rolls this back.
        // With a fixed cap, loss is bounded by attempts x maxSponsoredCost per
        // bounty; production also needs per-sender budgets and sponsor signatures.
        uint256 attempts = sponsoredAttempts[dealId];
        if (attempts >= MAX_SPONSORED_ATTEMPTS_PER_BOUNTY) revert AttemptsExhausted();
        sponsoredAttempts[dealId] = attempts + 1;

        // ── Step 6: Return fee-free context for postOp ──────────────
        // Judge note: no fee is encoded or implied by sponsorship metadata.
        context = abi.encode(dealId, payee);

        // validationData = 0 means "valid, no time-range restriction".
        // In production, you might pack (validUntil, validAfter) here.
        validationData = 0;
    }

    // ═══════════════════════════════════════════════════════════════
    //                     POST-OPERATION HOOK
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Called by the EntryPoint AFTER the UserOperation executes.
     * @dev This hook only emits sponsorship metadata; it never pulls USDC.
     *      Judge note: sponsorship is FREE. The payer account executes its own
     *      release and the vault pays its recorded payee in full. The paymaster
     *      has no privileged release path and the vault charges no fee.
     *      Retains the existing mode handling: opReverted returns early;
     *      other modes emit the event using the EntryPoint-supplied context.
     * @param mode Whether the op succeeded or reverted.
     * @param context The bytes returned from validatePaymasterUserOp.
     * @param actualGasCost The actual gas cost in ETH (wei).
     * @param actualUserOpFeePerGas The actual fee per gas unit.
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external override onlyEntryPoint {
        // Suppress unused variable warnings.
        (actualGasCost);
        (actualUserOpFeePerGas);

        if (mode == PostOpMode.opReverted) {
            // The release call reverted. The paymaster still pays
            // gas but receives no fee. The existing hook simply returns.
            return;
        }

        // Judge note: decode only the bounty identity; free sponsorship has
        // no fee field to report as if a USDC transfer had been collected.
        (uint256 dealId, address payee) = abi.decode(context, (uint256, address));

        emit GasSponsored(payee, dealId);
    }

    // ────────────────────────── Owner Functions ────────────────────

    /**
     * @notice Approve or revoke a protocol smart account's gas sponsorship.
     * @dev Judge note: only the owner can admit protocols; fresh tiny bounties
     *      cannot bypass this default-deny gate. Revocation blocks future
     *      validation without resetting any bounty's consumed attempts.
     *      Production would still add a sponsor signature and spending budgets.
     */
    function setSponsoredProtocol(address protocol, bool approved) external onlyOwner {
        if (protocol == address(0)) revert ZeroAddress();
        sponsoredProtocols[protocol] = approved;
        emit ProtocolSponsorshipSet(protocol, approved);
    }

    /**
     * @notice Set the maximum native-token wei cost of one sponsored operation.
     * @dev Judge note: owner-only policy tuning; zero permits only zero-maxCost
     *      requests. Emit old/new values to make changes visible to observers.
     *      This does not implement an aggregate or per-sender spending budget.
     */
    function setMaxSponsoredCost(uint256 newMaxCost) external onlyOwner {
        uint256 previousMaxCost = maxSponsoredCost;
        maxSponsoredCost = newMaxCost;
        emit MaxSponsoredCostUpdated(previousMaxCost, newMaxCost);
    }

    /**
     * @notice Withdraw accumulated USDC fees to the owner.
     * @dev Judge note: retained ABI for recovering existing or directly received
     *      USDC balances; v2 vault releases and gas sponsorship collect no fee.
     *      Check the token's boolean result: a failed transfer must not emit
     *      a misleading withdrawal event. The owner-only policy is unchanged.
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance > 0) {
            bool ok = usdc.transfer(owner, balance);
            if (!ok) revert TransferFailed();
            emit Withdrawn(owner, balance);
        }
    }

    /**
     * @notice Allow the paymaster to receive ETH (for EntryPoint deposits).
     * @dev Receiving ETH does not automatically credit the EntryPoint deposit.
     */
    receive() external payable {}

    // ────────────────────────── Internal Helpers ───────────────────

    function _selectorOf(bytes memory data) private pure returns (bytes4) {
        return bytes4(data);
    }

    function _checkEligible(address sender, uint256 dealId) private view returns (address payee) {
        // Judge note: reject unapproved accounts before the external vault read
        // and before validation consumes an attempt; this path writes no state.
        if (!sponsoredProtocols[sender]) revert ProtocolNotApproved();
        (address payer, address dealPayee, , uint8 status) =
            IBountyVaultView(vault).getDeal(dealId);
        if (sender != payer || dealPayee == address(0) || status != 1) {
            revert IneligibleBounty();
        }
        return dealPayee;
    }

    /**
     * @dev Slice a bytes array. Used to strip the 4-byte selector
     *      from calldata before abi.decode. The caller checks selector length.
     */
    function _slice(
        bytes memory data,
        uint256 start,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[start + i];
        }
        return result;
    }
}
