// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BountyVault} from "../BountyVault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Shared fixtures for BountyVault v2 tests. No test functions here.
abstract contract BountyVaultTestBase is Test {
    MockUSDC internal usdc;
    BountyVault internal vault;

    address internal paymaster = makeAddr("paymaster");
    address internal arbitrator = makeAddr("arbitrator");
    address internal payer = makeAddr("payer");
    address internal payee = makeAddr("payee");
    address internal claimer = makeAddr("claimer");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant AMT = 1_000e6;
    uint256 internal constant FUNDS = 1_000_000e6;
    uint64 internal constant DAY = 1 days;
    bytes32 internal constant CRIT = keccak256("criteria");

    uint64 internal t0;

    function setUp() public virtual {
        vm.warp(1_700_000_000);
        t0 = uint64(block.timestamp);
        usdc = new MockUSDC();
        vault = new BountyVault(address(usdc), paymaster, arbitrator);
        usdc.mint(payer, FUNDS);
        vm.prank(payer);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ───────── creation helpers (all create as `payer`) ─────────

    /// named bounty, no deadline
    function _bounty() internal returns (uint256 id) {
        return _bountyFull(payee, AMT, 0);
    }

    /// named bounty with an absolute deadline
    function _bountyD(uint64 deadline) internal returns (uint256 id) {
        return _bountyFull(payee, AMT, deadline);
    }

    function _bountyFull(address to, uint256 amount, uint64 deadline) internal returns (uint256 id) {
        vm.prank(payer);
        id = vault.createBounty(to, uint128(amount), deadline, CRIT);
    }

    /// open agent task with an absolute deadline
    function _task(uint64 deadline) internal returns (uint256 id) {
        return _taskAmt(AMT, deadline);
    }

    function _taskAmt(uint256 amount, uint64 deadline) internal returns (uint256 id) {
        vm.prank(payer);
        id = vault.createOpenTask(uint128(amount), deadline, CRIT);
    }

    // ───────── action helpers ─────────

    function _claim(uint256 id, address who) internal {
        vm.prank(who);
        vault.claimTask(id);
    }

    function _release(uint256 id) internal {
        vm.prank(payer);
        vault.release(id);
    }

    function _dispute(uint256 id, address who) internal {
        vm.prank(who);
        vault.dispute(id);
    }

    function _resolve(uint256 id, bool toPayee) internal {
        vm.prank(arbitrator);
        vault.resolveDispute(id, toPayee);
    }

    // ───────── views ─────────

    function _status(uint256 id) internal view returns (BountyVault.Status s) {
        (,,, s) = vault.getDeal(id);
    }

    function _payeeOf(uint256 id) internal view returns (address p) {
        (, p,,) = vault.getDeal(id);
    }

    function _claimedAt(uint256 id) internal view returns (uint64 ca) {
        (,,,,, ca,,,,,) = vault.deals(id);
    }

    function _vaultBal() internal view returns (uint256) {
        return usdc.balanceOf(address(vault));
    }

    /// sum of amounts of every deal currently Open or Disputed
    function _liveEscrow() internal view returns (uint256 sum) {
        uint256 n = vault.nextDealId();
        for (uint256 i; i < n; i++) {
            (,, uint256 a, BountyVault.Status s) = vault.getDeal(i);
            if (s == BountyVault.Status.Open || s == BountyVault.Status.Disputed) sum += a;
        }
    }
}
