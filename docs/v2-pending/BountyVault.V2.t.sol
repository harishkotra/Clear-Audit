// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

/// @dev The v2 acceptance scenarios: claim/release, refund races, role
///      neutrality of the arbitrator, and escrow conservation.
contract BountyVaultV2Test is BountyVaultTestBase {
    // (1) claim then release pays the claimer exactly once
    function test_ClaimThenRelease_PaysClaimerExactlyOnce() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        _release(id);
        assertEq(usdc.balanceOf(claimer), AMT);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));

        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.release(id);
        assertEq(usdc.balanceOf(claimer), AMT);
        assertEq(usdc.balanceOf(payer), FUNDS - AMT);
    }

    function test_ClaimThenRelease_DoesNotTouchOtherDealsFunds() public {
        uint256 a = _task(t0 + DAY);
        uint256 b = _task(t0 + DAY);
        _claim(a, claimer);
        _release(a);
        assertEq(_vaultBal(), AMT);
        assertEq(uint8(_status(b)), uint8(BountyVault.Status.Open));
    }

    // (2) second claim reverts AlreadyClaimed
    function test_SecondClaim_RevertsAlreadyClaimed() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.AlreadyClaimed.selector);
        vault.claimTask(id);
        vm.prank(claimer);
        vm.expectRevert(BountyVault.AlreadyClaimed.selector);
        vault.claimTask(id); // same claimer re-claiming is also rejected
        assertEq(_payeeOf(id), claimer);
    }

    // (3) release after refund and refund after release both revert
    function test_ReleaseAfterRefund_Reverts() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.warp(t0 + DAY + 1);
        vm.prank(stranger);
        vault.refundExpired(id);

        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.release(id);
        assertEq(usdc.balanceOf(claimer), 0);
        assertEq(usdc.balanceOf(payer), FUNDS);
    }

    function test_RefundAfterRelease_Reverts() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.warp(t0 + DAY + 1);
        _release(id); // release is still allowed after expiry; first one wins

        vm.prank(stranger);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.refundExpired(id);
        assertEq(usdc.balanceOf(claimer), AMT);
        assertEq(usdc.balanceOf(payer), FUNDS - AMT);
    }

    // (4) refundExpired behaviour
    function test_Refund_BeforeDeadlineReverts_NotYetExpired() public {
        uint256 id = _task(t0 + DAY);
        vm.warp(t0 + DAY - 1);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.NotYetExpired.selector);
        vault.refundExpired(id);
        assertEq(_vaultBal(), AMT);
    }

    function test_Refund_AfterDeadlinePaysPayer_Unclaimed() public {
        uint256 id = _task(t0 + DAY);
        vm.warp(t0 + DAY + 1);
        vm.prank(stranger);
        vault.refundExpired(id);
        assertEq(usdc.balanceOf(payer), FUNDS);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
    }

    function test_Refund_AfterDeadlinePaysPayer_Claimed() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.warp(t0 + DAY + 1);
        vm.prank(stranger);
        vault.refundExpired(id);
        assertEq(usdc.balanceOf(payer), FUNDS);
        assertEq(usdc.balanceOf(claimer), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
    }

    function test_Refund_AfterDeadlinePaysPayer_NamedBounty() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.warp(t0 + DAY + 1);
        vault.refundExpired(id);
        assertEq(usdc.balanceOf(payer), FUNDS);
        assertEq(usdc.balanceOf(payee), 0);
    }

    function test_Refund_OnDisputedDealReverts_EvenAfterExpiry() public {
        uint256 id = _bountyD(t0 + DAY);
        _dispute(id, payee);
        vm.warp(t0 + DAY + 100 days);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.refundExpired(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
        assertEq(_vaultBal(), AMT);
        // the arbitrator can still decide it afterwards
        _resolve(id, true);
        assertEq(usdc.balanceOf(payee), AMT);
    }

    // (5) cancel after claim reverts
    function test_Cancel_AfterClaimReverts() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.prank(payer);
        vm.expectRevert(BountyVault.AlreadyClaimed.selector);
        vault.cancel(id);
        assertEq(_vaultBal(), AMT);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
    }

    function test_Cancel_BeforeClaimSucceedsAndBlocksLaterClaim() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vault.cancel(id);
        vm.prank(claimer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.claimTask(id);
    }

    // (6) arbitrator can never be payer or payee
    function test_Role_CreateBountyWithArbitratorAsPayee_Reverts() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createBounty(arbitrator, uint128(AMT), 0, CRIT);
    }

    function test_Role_CreateBountyByArbitrator_Reverts() public {
        usdc.mint(arbitrator, AMT);
        vm.startPrank(arbitrator);
        usdc.approve(address(vault), AMT);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createBounty(payee, uint128(AMT), 0, CRIT);
        vm.stopPrank();
    }

    function test_Role_CreateOpenTaskByArbitrator_Reverts() public {
        usdc.mint(arbitrator, AMT);
        vm.startPrank(arbitrator);
        usdc.approve(address(vault), AMT);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createOpenTask(uint128(AMT), t0 + DAY, CRIT);
        vm.stopPrank();
    }

    function test_Role_ClaimByArbitrator_Reverts() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.claimTask(id);
        assertEq(_payeeOf(id), address(0));
    }

    function test_Role_AssignPayeeToArbitrator_Reverts() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.assignPayee(id, arbitrator);
        assertEq(_payeeOf(id), address(0));
    }

    function test_Role_ArbitratorStillResolvesOtherPartiesDeals() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        _dispute(id, claimer);
        _resolve(id, false);
        assertEq(usdc.balanceOf(payer), FUNDS);
    }

    // (7) vault balance == sum of Open + Disputed amounts after a mixed sequence
    function test_Conservation_AfterMixedSequence() public {
        uint256 d1 = _bountyFull(payee, 100e6, t0 + DAY); // will be released
        uint256 d2 = _taskAmt(200e6, t0 + DAY); // claimed, then refunded
        uint256 d3 = _taskAmt(300e6, t0 + 2 * DAY); // cancelled
        uint256 d4 = _bountyFull(payee, 400e6, 0); // disputed, resolved to payer
        uint256 d5 = _bountyFull(payee, 500e6, 0); // disputed, left pending
        uint256 d6 = _taskAmt(600e6, t0 + 3 * DAY); // left open, unclaimed
        uint256 d7 = _bountyFull(payee, 700e6, 0); // disputed, resolved to payee
        assertEq(_vaultBal(), 2_800e6);
        assertEq(_vaultBal(), _liveEscrow());

        _release(d1);
        assertEq(_vaultBal(), _liveEscrow());
        assertEq(_vaultBal(), 2_700e6);

        _claim(d2, claimer);
        _dispute(d4, payer);
        _dispute(d5, payee);
        _dispute(d7, payee);
        assertEq(_vaultBal(), _liveEscrow());

        vm.prank(payer);
        vault.cancel(d3);
        assertEq(_vaultBal(), _liveEscrow());
        assertEq(_vaultBal(), 2_400e6);

        _resolve(d4, false);
        _resolve(d7, true);
        assertEq(_vaultBal(), _liveEscrow());
        assertEq(_vaultBal(), 1_300e6); // d2 + d5 + d6

        vm.warp(t0 + DAY + 1);
        vault.refundExpired(d2);
        assertEq(_vaultBal(), _liveEscrow());
        assertEq(_vaultBal(), 1_100e6); // d5 (disputed) + d6 (open)

        vm.warp(t0 + 3 * DAY + 1);
        vm.prank(stranger);
        vault.refundExpired(d6);
        assertEq(_vaultBal(), 500e6);
        assertEq(_vaultBal(), _liveEscrow());
        assertEq(uint8(_status(d5)), uint8(BountyVault.Status.Disputed));

        // payouts add up: payee got d1 + d7, payer got back d2 + d3 + d4 + d6
        assertEq(usdc.balanceOf(payee), 800e6);
        assertEq(usdc.balanceOf(payer), FUNDS - 100e6 - 700e6 - 500e6);
        assertEq(usdc.balanceOf(payee) + usdc.balanceOf(payer) + _vaultBal(), FUNDS);
    }
}
