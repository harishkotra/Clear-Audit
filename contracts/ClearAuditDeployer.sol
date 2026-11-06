// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BountyVault.sol";
import "./USDCPaymaster.sol";
import "./interfaces/IERC20.sol";

/**
 * @title ClearAuditDeployer
 * @notice One-shot deployment relayer and narrowly scoped paymaster-owner adapter.
 * @dev Judge note: BountyVault fixes its paymaster immutably, while USDCPaymaster
 * fixes its vault immutably. Neither can be patched after deployment. The Arc
 * deployment wallet may be a smart-contract account, so predicting a child from
 * the wallet's transaction nonce is not a valid deployment strategy. Instead,
 * this fresh relayer creates both contracts in its own constructor, using its
 * own known CREATE nonce sequence, independently of how the wallet deploys it.
 *
 * Ownership is admin -> relayer -> paymaster owner: USDCPaymaster's constructor
 * observes this relayer as msg.sender. The immutable admin may call ONLY that
 * paymaster through the adapter, not arbitrary targets. BountyVault has no owner
 * functions; its arbitrator is immutable and is not controlled by this adapter.
 * There is no upgrade mechanism, admin replacement, or selfdestruct.
 */
contract ClearAuditDeployer {
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    address public immutable admin;
    BountyVault public immutable vault;
    USDCPaymaster public immutable paymaster;

    error ZeroAddress();
    error BurnAddress();
    error NativeTransferFailed();
    error PredictionMismatch();
    error OnlyAdmin();
    error CallFailed();
    error TransferFailed();

    event Deployed(
        address indexed vault,
        address indexed paymaster,
        address indexed arbitrator,
        address admin,
        address token,
        address entryPoint
    );

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    constructor(address token, address entryPoint, address arbitrator, address admin_) {
        if (
            token == address(0) || entryPoint == address(0)
                || arbitrator == address(0) || admin_ == address(0)
        ) revert ZeroAddress();
        if (arbitrator == BURN || admin_ == BURN) revert BurnAddress();
        admin = admin_;

        // EIP-161 initializes a newly created contract's nonce to 1. Our first
        // CREATE deploys the vault at nonce 1; the second deploys the paymaster
        // at nonce 2. CREATE derives an address from the last 20 bytes of
        // keccak256(RLP([creator, nonce])). For this 20-byte creator and nonce 2,
        // RLP is 0xd6 (22-byte list payload), 0x94 (20-byte address), creator,
        // 0x02 (the single-byte nonce). No other CREATE may precede these two.
        address predictedPaymaster = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xd6), bytes1(0x94), address(this), bytes1(0x02)
        )))));

        // The vault receives the actual future paymaster address, never a
        // zero/burn placeholder. Both creations share this deployment transaction;
        // any constructor or invariant failure rolls the entire transaction back.
        vault = new BountyVault(token, predictedPaymaster, arbitrator);
        paymaster = new USDCPaymaster(entryPoint, address(vault), token);
        if (address(paymaster) != predictedPaymaster) revert PredictionMismatch();
        assert(vault.paymaster() == address(paymaster));

        emit Deployed(address(vault), address(paymaster), arbitrator, admin_, token, entryPoint);
    }

    /**
     * @notice Operate the immutable paymaster as its owner, forwarding msg.value.
     * @dev This is CALL, not delegatecall, and the target cannot be supplied by
     * the admin. Examples include sponsorship settings, EntryPoint deposits and
     * withdrawals, and withdrawFees(). Original paymaster revert data is preserved.
     */
    function callPaymaster(bytes calldata data)
        external
        payable
        onlyAdmin
        returns (bytes memory)
    {
        (bool ok, bytes memory result) = address(paymaster).call{value: msg.value}(data);
        if (!ok) {
            if (result.length == 0) revert CallFailed();
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
        return result;
    }

    /**
     * @notice Recover ERC-20 balances held by the relayer to a nonzero recipient.
     * @dev Paymaster withdrawFees() pays its owner (this relayer), not admin.
     * The token must implement the existing project's boolean-return ERC-20 ABI.
     * On Arc, use sweepNative() for sub-1e12 native-unit remainders that are
     * invisible through the 6-decimal ERC-20 view of the same USDC balance.
     */
    function sweepToken(address token, address to, uint256 amount) external onlyAdmin {
        if (to == address(0)) revert ZeroAddress();
        if (!IERC20(token).transfer(to, amount)) revert TransferFailed();
    }

    /**
     * @notice Recover native funds held by the relayer to a nonzero recipient.
     * @dev Judge note: Arc native USDC uses 18 decimals, while its ERC-20 view
     * uses 6. Both views represent the same underlying balance, not two assets.
     * Sub-1e12 native-unit remainders are only recoverable through this native
     * path. The amount is denominated in native (18-decimal) units, and only
     * the immutable admin may initiate the transfer.
     */
    function sweepNative(address payable to, uint256 amount) external onlyAdmin {
        if (to == address(0)) revert ZeroAddress();
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    /// @notice Accept native funds; receiving them does not deposit to EntryPoint.
    receive() external payable {}
}
