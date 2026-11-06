// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BountyVault} from "../BountyVault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Shared fixtures for BountyVault tests. No test functions here.
abstract contract BountyVaultTestBase is Test {
    MockUSDC internal usdc;
    BountyVault internal vault;

    address internal paymaster = makeAddr("paymaster");
    address internal arbitrator = makeAddr("arbitrator");
    address internal protocol = makeAddr("protocol");
    address internal whitehat = makeAddr("whitehat");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AMT = 1_000e6;
    uint256 internal constant FUNDS = 1_000_000e6;

    function setUp() public virtual {
        usdc = new MockUSDC();
        vault = new BountyVault(address(usdc), paymaster, arbitrator);
        usdc.mint(protocol, FUNDS);
        vm.prank(protocol);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _create() internal returns (uint256 id) {
        return _create(AMT);
    }

    function _create(uint256 amount) internal returns (uint256 id) {
        vm.prank(protocol);
        id = vault.createBounty(whitehat, amount);
    }

    function _dispute(uint256 id) internal {
        vm.prank(whitehat);
        vault.disputeBounty(id);
    }

    function _status(uint256 id) internal view returns (BountyVault.Status s) {
        (,,, s) = vault.getDeal(id);
    }
}
