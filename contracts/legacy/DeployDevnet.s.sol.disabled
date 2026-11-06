// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {BountyVault} from "../BountyVault.sol";
import {SponsorPaymaster} from "../SponsorPaymaster.sol";

/// Deploy the EF alt-mempool reference stack on the EIP-8141 devnet (chain 1337).
///
/// This is the research artifact for the Ethereum Foundation track, not the
/// product. The devnet is shared infrastructure and gets reset during the
/// hackathon, so this script exists to rebuild the artifact in one command:
///
///   PROTOCOL_PRIVATE_KEY=0x... forge script \
///     contracts/script/DeployDevnet.s.sol:DeployDevnet \
///     --rpc-url https://altmempool.forshtat.com/rpc --broadcast --legacy
///
/// It deploys mUSDC, funds and deploys the demo SponsorPaymaster, deploys the
/// vault against both, mints test USDC to the relayer, and opens deal #0 so the
/// gasless demo page has something to settle.
contract DeployDevnet is Script {
    uint256 constant PAYMASTER_FUND = 50 ether;
    uint256 constant MINT_TO_RELAYER = 10_000e6;
    uint256 constant DEAL_AMOUNT = 1_000e6;

    function run() external {
        uint256 pk = vm.envUint("PROTOCOL_PRIVATE_KEY");
        address protocol = vm.addr(pk);
        // The researcher is a beneficiary only: any address works, it never signs.
        address researcher = vm.envOr("DEVNET_RESEARCHER", address(0xBEEF00000000000000000000000000000000BEEf));
        // Disputes are not exercised on the devnet artifact; keep a distinct address.
        address arbitrator = vm.envOr("DEVNET_ARBITRATOR", address(0x4E9dE2B8d17CC142A615573be3aC7901CBc1787a));

        vm.startBroadcast(pk);

        MockUSDC musdc = new MockUSDC();
        SponsorPaymaster paymaster = new SponsorPaymaster{value: PAYMASTER_FUND}();
        BountyVault vault = new BountyVault(address(musdc), address(paymaster), arbitrator);

        musdc.mint(protocol, MINT_TO_RELAYER);
        musdc.approve(address(vault), type(uint256).max);
        uint256 dealId = vault.createBounty(researcher, DEAL_AMOUNT);

        vm.stopBroadcast();

        console.log("chainId        ", block.chainid);
        console.log("protocol       ", protocol);
        console.log("researcher     ", researcher);
        console.log("arbitrator     ", arbitrator);
        console.log("MockUSDC       ", address(musdc));
        console.log("SponsorPaymaster", address(paymaster));
        console.log("BountyVault    ", address(vault));
        console.log("dealId         ", dealId);
        console.log("dealAmount     ", DEAL_AMOUNT);
    }
}
