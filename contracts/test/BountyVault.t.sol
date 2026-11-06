// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

/// @dev Deployment, happy paths and events for BountyVault v2.
contract BountyVaultTest is BountyVaultTestBase {
    // ───────── constructor ─────────

    function test_Constructor_StoresImmutables() public view {
        assertEq(address(vault.token()), address(usdc));
        assertEq(vault.paymaster(), paymaster);
        assertEq(vault.arbitrator(), arbitrator);
        assertEq(vault.nextDealId(), 0);
        assertEq(vault.challengeWindow(), WINDOW);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        new BountyVault(address(0), paymaster, arbitrator, WINDOW);
    }

    function test_Constructor_AllowsZeroPaymaster() public {
        // A deployment with no sponsorship is valid: the release path takes no fee,
        // so there is nothing for a paymaster to sponsor or skim.
        BountyVault v = new BountyVault(address(usdc), address(0), arbitrator, WINDOW);
        assertEq(v.paymaster(), address(0));
    }

    function test_Constructor_RevertsOnZeroArbitrator() public {
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        new BountyVault(address(usdc), paymaster, address(0), WINDOW);
    }

    function test_Constructor_RevertsOnZeroWindow() public {
        vm.expectRevert(BountyVault.ZeroWindow.selector);
        new BountyVault(address(usdc), paymaster, arbitrator, 0);
    }

    function test_Constructor_RevertsOnNoCodeToken() public {
        vm.expectRevert(BountyVault.TokenNotContract.selector);
        new BountyVault(makeAddr("eoaToken"), paymaster, arbitrator, WINDOW);
    }

    function test_Constructor_ZeroCheckPrecedesCodeCheck() public {
        // address(0) has no code too, but ZeroAddress is the reported error
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        new BountyVault(address(0), address(0), address(0), WINDOW);
    }

    // ───────── createBounty ─────────

    function test_CreateBounty_RecordsDealAndEscrows() public {
        uint64 dl = t0 + DAY;
        uint256 id = _bountyFull(payee, AMT, dl);
        assertEq(id, 0);
        assertEq(vault.nextDealId(), 1);
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, payer);
        assertEq(w, payee);
        assertEq(a, AMT);
        assertEq(uint8(s), uint8(BountyVault.Status.Open));
        assertEq(usdc.balanceOf(address(vault)), AMT);
        assertEq(usdc.balanceOf(payer), FUNDS - AMT);
        (,, address tok, uint128 amt, uint64 d, uint64 ca,, bool agent, bool assigned, address arb, bytes32 crit,) =
            vault.deals(id);
        assertEq(tok, address(usdc));
        assertEq(amt, AMT);
        assertEq(d, dl);
        assertEq(ca, 0);
        assertFalse(agent);
        assertTrue(assigned);
        assertEq(arb, arbitrator);
        assertEq(crit, CRIT);
    }

    function test_CreateBounty_DeadlineZeroIsAllowed() public {
        uint256 id = _bountyFull(payee, AMT, 0);
        (,,,, uint64 d,,,,,,,) = vault.deals(id);
        assertEq(d, 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
    }

    function test_CreateBounty_EmitsEvent() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit BountyVault.BountyCreated(0, payer, payee, uint128(AMT), t0 + DAY, CRIT, false);
        _bountyFull(payee, AMT, t0 + DAY);
    }

    function test_NextDealId_Sequences() public {
        assertEq(_bounty(), 0);
        assertEq(_task(t0 + DAY), 1);
        assertEq(_bounty(), 2);
        assertEq(vault.nextDealId(), 3);
    }

    function test_GetDeal_UnknownIdIsNone() public view {
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(999);
        assertEq(p, address(0));
        assertEq(w, address(0));
        assertEq(a, 0);
        assertEq(uint8(s), uint8(BountyVault.Status.None));
    }

    // ───────── createOpenTask ─────────

    function test_CreateOpenTask_RecordsAgentModeNoPayee() public {
        uint256 id = _task(t0 + DAY);
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, payer);
        assertEq(w, address(0));
        assertEq(a, AMT);
        assertEq(uint8(s), uint8(BountyVault.Status.Open));
        (,,,, uint64 d, uint64 ca,, bool agent, bool assigned, address arb, bytes32 crit,) = vault.deals(id);
        assertEq(d, t0 + DAY);
        assertEq(ca, 0);
        assertTrue(agent);
        assertFalse(assigned);
        assertEq(arb, arbitrator);
        assertEq(crit, CRIT);
        assertEq(_vaultBal(), AMT);
    }

    function test_CreateOpenTask_EmitsEvent() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit BountyVault.BountyCreated(0, payer, address(0), uint128(AMT), t0 + DAY, CRIT, true);
        _task(t0 + DAY);
    }

    // ───────── claimTask / assignPayee ─────────

    function test_ClaimTask_SetsPayeeAndClaimedAtWithoutMovingFunds() public {
        uint256 id = _task(t0 + DAY);
        vm.warp(t0 + 100);
        _claim(id, claimer);
        assertEq(_payeeOf(id), claimer);
        assertEq(_claimedAt(id), t0 + 100);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
        assertEq(_vaultBal(), AMT);
        assertEq(usdc.balanceOf(claimer), 0);
    }

    function test_ClaimTask_EmitsEvent() public {
        uint256 id = _task(t0 + DAY);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.TaskClaimed(id, claimer, t0);
        _claim(id, claimer);
    }

    function test_AssignPayee_SetsAssignedPayeeAndEmits() public {
        uint256 id = _task(t0 + DAY);
        vm.expectEmit(true, true, false, false, address(vault));
        emit BountyVault.PayeeAssigned(id, claimer);
        vm.prank(payer);
        vault.assignPayee(id, claimer);
        assertEq(_payeeOf(id), claimer);
        (,,,,,,,, bool assigned,,,) = vault.deals(id);
        assertTrue(assigned);
        assertEq(_claimedAt(id), 0);
    }

    function test_AssignPayee_CanReplaceUnclaimedNamedPayee() public {
        uint256 id = _bounty();
        vm.prank(payer);
        vault.assignPayee(id, claimer);
        assertEq(_payeeOf(id), claimer);
        _release(id);
        assertEq(usdc.balanceOf(claimer), AMT);
        assertEq(usdc.balanceOf(payee), 0);
    }

    function test_AssignPayee_AllowedOnZeroDeadlineBounty() public {
        uint256 id = _bounty();
        vm.warp(t0 + 365 days);
        vm.prank(payer);
        vault.assignPayee(id, claimer);
        assertEq(_payeeOf(id), claimer);
    }

    function test_AssignPayee_AssignedOpenTaskIsNoLongerClaimable() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vault.assignPayee(id, payee);
        vm.expectRevert(BountyVault.NotClaimable.selector);
        _claim(id, claimer);
    }

    // ───────── release ─────────

    function test_Release_PaysPayeeInFullAndEmits() public {
        uint256 id = _bounty();
        _commit(id);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.BountyReleased(id, payee, uint128(AMT));
        vm.prank(payer);
        vault.release(id);
        assertEq(usdc.balanceOf(payee), AMT);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
    }

    function test_Release_TakesNoFeeAndPaymasterReceivesNothing() public {
        uint256 id = _bounty();
        _release(id);
        assertEq(usdc.balanceOf(paymaster), 0);
        assertEq(usdc.balanceOf(payee), AMT);
    }

    function test_Release_StillAllowedAfterDeadline() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.warp(t0 + DAY + 10);
        _release(id);
        assertEq(usdc.balanceOf(payee), AMT);
    }

    // ───────── dispute / resolve ─────────

    function test_Dispute_ByPayeeFreezesDealAndEmits() public {
        uint256 id = _bounty();
        vm.expectEmit(true, true, false, false, address(vault));
        emit BountyVault.BountyDisputed(id, payee);
        _dispute(id, payee);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
        assertEq(_vaultBal(), AMT);
    }

    function test_Dispute_ByPayerAllowed() public {
        uint256 id = _bounty();
        vm.expectEmit(true, true, false, false, address(vault));
        emit BountyVault.BountyDisputed(id, payer);
        _dispute(id, payer);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
    }

    function test_Dispute_StillAllowedAfterDeadline() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.warp(t0 + DAY + 1);
        _dispute(id, payee);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
    }

    function test_Dispute_ByClaimerOfOpenTask() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        _dispute(id, claimer);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
    }

    function test_Resolve_ToPayeePaysPayee() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.DisputeResolved(id, true, payee, uint128(AMT));
        _resolve(id, true);
        assertEq(usdc.balanceOf(payee), AMT);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayee));
    }

    function test_Resolve_ToPayerRefundsPayer() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.DisputeResolved(id, false, payer, uint128(AMT));
        _resolve(id, false);
        assertEq(usdc.balanceOf(payer), FUNDS);
        assertEq(usdc.balanceOf(payee), 0);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
    }

    function test_Resolve_ToPayeeOnClaimedTaskPaysClaimer() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        _dispute(id, payer);
        _resolve(id, true);
        assertEq(usdc.balanceOf(claimer), AMT);
    }

    function test_Resolve_WorksAfterDeadline() public {
        uint256 id = _bountyD(t0 + DAY);
        _dispute(id, payee);
        vm.warp(t0 + 10 * DAY);
        _resolve(id, true);
        assertEq(usdc.balanceOf(payee), AMT);
    }

    // ───────── refundExpired / cancel ─────────

    function test_RefundExpired_PaysPayerAndEmitsWithCaller() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.warp(t0 + DAY + 1);
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.BountyRefunded(id, payer, uint128(AMT), stranger);
        vm.prank(stranger);
        vault.refundExpired(id);
        assertEq(usdc.balanceOf(payer), FUNDS);
        assertEq(usdc.balanceOf(stranger), 0);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
    }

    function test_Cancel_RefundsPayerAndEmits() public {
        uint256 id = _bounty();
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.BountyCancelled(id, payer, uint128(AMT));
        vm.prank(payer);
        vault.cancel(id);
        assertEq(usdc.balanceOf(payer), FUNDS);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
    }

    function test_Cancel_AllowedOnAssignedButUnclaimedDeal() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vault.assignPayee(id, payee);
        vm.prank(payer);
        vault.cancel(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
    }

    // ───────── multi-deal isolation ─────────

    function test_Flow_IndependentDeals() public {
        uint256 a = _bountyFull(payee, 100e6, 0);
        uint256 b = _bountyFull(payee, 200e6, 0);
        uint256 c = _bountyFull(payee, 300e6, 0);
        _release(a);
        _dispute(b, payee);
        assertEq(_vaultBal(), 500e6);
        assertEq(uint8(_status(c)), uint8(BountyVault.Status.Open));
        _resolve(b, false);
        assertEq(_vaultBal(), 300e6);
        assertEq(usdc.balanceOf(payee), 100e6);
    }
}
