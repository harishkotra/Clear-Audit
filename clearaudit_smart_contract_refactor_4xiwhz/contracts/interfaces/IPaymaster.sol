// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPaymaster — ERC-4337 / EIP-8141 Paymaster Interface
 *
 * @notice This interface follows the ERC-4337 v0.7 paymaster shape.
 *         For EIP-8141 (frame transaction alt mempool), the EntryPoint
 *         contract on the devnet may call these same methods but with
 *         a slightly different UserOperation struct layout.
 *
 *         ⚠️  CHECK WITH EF ENGINEERS:
 *         - Does the devnet EntryPoint use the same PackedUserOperation?
 *         - Is there an additional `frameData` field we need to unpack?
 *         - Does `postOp` get called with the same semantics?
 */

// ──────────────────────────────────────────────────────────────────────
// ERC-4337 v0.7 "PackedUserOperation" — the struct the EntryPoint
// passes into paymaster validation.  If EIP-8141 adds fields, extend
// this struct accordingly.
// ──────────────────────────────────────────────────────────────────────
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;          // empty for existing accounts
    bytes callData;
    bytes32 accountGasLimits; // packed: verificationGasLimit (16 bytes) | callGasLimit (16 bytes)
    uint256 preVerificationGas;
    bytes32 gasFees;          // packed: maxPriorityFeePerGas (16 bytes) | maxFeePerGas (16 bytes)
    bytes paymasterAndData;   // first 20 bytes = paymaster address, rest = paymaster-specific data
    bytes signature;
}

/**
 * @dev Post-operation mode enum.
 *      - opSucceeded:  the user op succeeded
 *      - opReverted:   the user op reverted (paymaster still pays gas)
 *      - postOpReverted: a prior postOp call reverted (second attempt)
 */
enum PostOpMode {
    opSucceeded,
    opReverted,
    postOpReverted
}

interface IPaymaster {
    /**
     * @notice Called by the EntryPoint during the verification phase.
     * @param userOp          The packed user operation.
     * @param userOpHash      Hash of the user operation (for signature checks).
     * @param maxCost         Maximum gas cost the paymaster must cover.
     * @return context        Arbitrary bytes passed to `postOp`.
     * @return validationData 0 = success, 1 = sig failure, or packed
     *                        (aggregator, validUntil, validAfter).
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    /**
     * @notice Called by the EntryPoint after the user operation executes.
     * @param mode           Whether the op succeeded, reverted, or postOp reverted.
     * @param context        The bytes returned from `validatePaymasterUserOp`.
     * @param actualGasCost  The actual gas cost charged.
     * @param actualUserOpFeePerGas  The actual fee per gas unit.
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external;
}
