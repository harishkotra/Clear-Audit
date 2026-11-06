// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import "../ClearAuditDeployer.sol";

/**
 * @notice Reproducible ClearAudit deployment on Arc Testnet only.
 * @dev Usage (PRIVATE_KEY comes from the environment, never a literal):
 * forge script contracts/script/DeployArc.s.sol:DeployArc --rpc-url https://rpc.testnet.arc.io --broadcast --private-key $PRIVATE_KEY
 *
 * Optional ARBITRATOR and ADMIN environment addresses default to msg.sender,
 * the Forge-configured broadcaster. Fund that broadcaster with Arc USDC first.
 * The vault and paymaster are created inside the relayer's constructor, so both
 * share the relayer deployment transaction; no wallet-nonce prediction is used.
 * The script does not fund EntryPoint or configure sponsored protocols.
 */
contract DeployArc is Script {
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    error WrongChain(uint256 expected, uint256 actual);
    error NoUsdcForGas(address deployer, uint256 balance);
    error ZeroAddress();
    error BurnAddressRole(address role);
    error WiringMismatch(string field);

    /// @notice Arc native USDC's ERC-20 interface uses 6 decimals (native: 18).
    address public constant SETTLEMENT_TOKEN = 0x3600000000000000000000000000000000000000;

    /// @notice ERC-4337 v0.7 EntryPoint deployed on Arc Testnet.
    address public constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external returns (ClearAuditDeployer relayer) {
        if (block.chainid != 5042002) revert WrongChain(5042002, block.chainid);

        address broadcaster = msg.sender;
        address arbitrator = vm.envOr("ARBITRATOR", broadcaster);
        address admin = vm.envOr("ADMIN", broadcaster);
        // Reject unusable immutable roles before broadcasting, mirroring the relayer.
        if (arbitrator == address(0) || admin == address(0)) revert ZeroAddress();
        if (arbitrator == BURN) revert BurnAddressRole(arbitrator);
        if (admin == BURN) revert BurnAddressRole(admin);
        uint256 balance = IERC20(SETTLEMENT_TOKEN).balanceOf(broadcaster);
        if (balance == 0) revert NoUsdcForGas(broadcaster, balance);

        vm.startBroadcast();
        relayer = new ClearAuditDeployer(SETTLEMENT_TOKEN, ENTRY_POINT, arbitrator, admin);
        vm.stopBroadcast();

        BountyVault vault = relayer.vault();
        USDCPaymaster paymaster = relayer.paymaster();
        if (address(vault.token()) != SETTLEMENT_TOKEN) revert WiringMismatch("vault.token");
        if (vault.paymaster() != address(paymaster)) revert WiringMismatch("vault.paymaster");
        if (vault.arbitrator() != arbitrator) revert WiringMismatch("vault.arbitrator");
        if (paymaster.entryPoint() != ENTRY_POINT) revert WiringMismatch("paymaster.entryPoint");
        if (paymaster.vault() != address(vault)) revert WiringMismatch("paymaster.vault");
        if (address(paymaster.usdc()) != SETTLEMENT_TOKEN) revert WiringMismatch("paymaster.usdc");
        if (paymaster.owner() != address(relayer)) revert WiringMismatch("paymaster.owner");
        if (relayer.admin() != admin) revert WiringMismatch("relayer.admin");

        console2.log("Broadcaster:", broadcaster);
        console2.log("ClearAuditDeployer:", address(relayer));
        console2.log("BountyVault:", address(vault));
        console2.log("USDCPaymaster:", address(paymaster));
        console2.log("Arbitrator:", arbitrator);
        console2.log("Admin:", admin);
        console2.log("Settlement token:", SETTLEMENT_TOKEN);
        console2.log("EntryPoint:", ENTRY_POINT);
    }
}
