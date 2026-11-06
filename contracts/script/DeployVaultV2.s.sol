// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {BountyVault} from "../BountyVault.sol";

/**
 * @notice Deploy the v2 vault on Arc Testnet.
 * @dev Usage (PRIVATE_KEY comes from the environment, never a literal):
 *
 *   forge script contracts/script/DeployVaultV2.s.sol:DeployVaultV2 \
 *     --rpc-url https://rpc.testnet.arc.io --broadcast --private-key $PRIVATE_KEY
 *
 * ARBITRATOR defaults to the broadcaster. PAYMASTER defaults to zero, which the
 * v2 constructor accepts on purpose: with no fee on the release path there is
 * nothing for a paymaster to sponsor, so a v2 deployment does not need one.
 */
contract DeployVaultV2 is Script {
    error WrongChain(uint256 expected, uint256 actual);
    error ZeroAddress();

    /// @notice Arc native USDC's ERC-20 interface uses 6 decimals (native: 18).
    address public constant SETTLEMENT_TOKEN = 0x3600000000000000000000000000000000000000;

    function run() external returns (BountyVault vault) {
        if (block.chainid != 5042002) revert WrongChain(5042002, block.chainid);

        address broadcaster = msg.sender;
        address arbitrator = vm.envOr("ARBITRATOR", broadcaster);
        address paymaster = vm.envOr("PAYMASTER", address(0));
        if (arbitrator == address(0)) revert ZeroAddress();
        if (arbitrator == broadcaster) {
            console2.log("note: broadcaster is also the arbitrator, so it cannot fund or be paid");
        }

        vm.startBroadcast();
        uint64 window = uint64(vm.envOr("CHALLENGE_WINDOW", uint256(5 minutes)));
        vault = new BountyVault(SETTLEMENT_TOKEN, paymaster, arbitrator, window);
        vm.stopBroadcast();

        console2.log("BountyVault", address(vault));
        console2.log("token", address(vault.token()));
        console2.log("arbitrator", vault.arbitrator());
        console2.log("paymaster", vault.paymaster());
        console2.log("challengeWindow", vault.challengeWindow());
        console2.log("nextDealId", vault.nextDealId());
    }
}
