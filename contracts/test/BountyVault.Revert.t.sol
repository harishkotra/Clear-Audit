// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

/// @dev Every require/revert path of BountyVault v2, plus deadline boundaries.
contract BountyVaultRevertTest is BountyVaultTestBase {
    // ───────── createBounty ─────────

    function test_CreateBounty_RevertsOnZeroPayee() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        vault.createBounty(address(0), uint128(AMT), 0, CRIT);
    }

    function test_CreateBounty_RevertsWhenPayeeIsPayer() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createBounty(payer, uint128(AMT), 0, CRIT);
    }

    function test_CreateBounty_RevertsOnZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.ZeroAmount.selector);
        vault.createBounty(payee, 0, 0, CRIT);
    }

    function test_CreateBounty_RevertsOnPastDeadline() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.createBounty(payee, uint128(AMT), t0 - 1, CRIT);
    }

    function test_CreateBounty_RevertsWhenDeadlineIsNow() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.createBounty(payee, uint128(AMT), t0, CRIT);
    }

    function test_CreateBounty_AllowsDeadlineOneSecondAhead() public {
        uint256 id = _bountyD(t0 + 1);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
    }

    function test_CreateBounty_RevertsWithoutAllowanceAndConsumesNoId() public {
        vm.prank(stranger); // no funds, no allowance
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.createBounty(payee, uint128(AMT), 0, CRIT);
        assertEq(vault.nextDealId(), 0);
    }

    // ───────── createOpenTask ─────────

    function test_CreateOpenTask_RevertsOnZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.ZeroAmount.selector);
        vault.createOpenTask(0, t0 + DAY, CRIT);
    }

    function test_CreateOpenTask_RevertsOnZeroDeadline() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlineRequired.selector);
        vault.createOpenTask(uint128(AMT), 0, CRIT);
    }

    function test_CreateOpenTask_RevertsOnPastDeadline() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.createOpenTask(uint128(AMT), t0 - 1, CRIT);
    }

    function test_CreateOpenTask_RevertsWhenDeadlineIsNow() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.createOpenTask(uint128(AMT), t0, CRIT);
    }

    function test_CreateOpenTask_RevertsWithoutAllowance() public {
        vm.prank(stranger);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.createOpenTask(uint128(AMT), t0 + DAY, CRIT);
        assertEq(vault.nextDealId(), 0);
    }

    // ───────── claimTask ─────────

    function test_ClaimTask_RevertsOnUnknownDeal() public {
        vm.prank(claimer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.claimTask(42);
    }

    function test_ClaimTask_RevertsOnNamedDeal() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.prank(claimer);
        vm.expectRevert(BountyVault.NotClaimable.selector);
        vault.claimTask(id);
    }

    function test_ClaimTask_RevertsOnNamedDealEvenForPayee() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.prank(payee);
        vm.expectRevert(BountyVault.NotClaimable.selector);
        vault.claimTask(id);
    }

    function test_ClaimTask_RevertsWhenAlreadyClaimed() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.AlreadyClaimed.selector);
        vault.claimTask(id);
    }

    function test_ClaimTask_RevertsForPayer() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.claimTask(id);
    }

    function test_ClaimTask_RevertsForArbitrator() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.claimTask(id);
    }

    function test_ClaimTask_RevertsAfterRelease() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        _release(id);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.claimTask(id);
    }

    function test_ClaimTask_RevertsOnDisputedDeal() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        vm.prank(claimer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.claimTask(id);
    }

    // ───────── deadline boundaries ─────────

    function test_ClaimTask_BoundaryBeforeAtAfterDeadline() public {
        uint64 dl = t0 + DAY;
        uint256 a = _task(dl);
        uint256 b = _task(dl);
        uint256 c = _task(dl);

        vm.warp(dl - 1);
        _claim(a, claimer); // before: ok

        vm.warp(dl);
        _claim(b, claimer); // exactly at: ok

        vm.warp(dl + 1);
        vm.prank(claimer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.claimTask(c); // after: DeadlinePassed
    }

    function test_AssignPayee_BoundaryBeforeAtAfterDeadline() public {
        uint64 dl = t0 + DAY;
        uint256 a = _bountyD(dl);
        uint256 b = _bountyD(dl);
        uint256 c = _bountyD(dl);

        vm.warp(dl - 1);
        vm.prank(payer);
        vault.assignPayee(a, claimer);
        vm.warp(dl);
        vm.prank(payer);
        vault.assignPayee(b, claimer);
        vm.warp(dl + 1);
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.assignPayee(c, claimer);
    }

    function test_Cancel_BoundaryBeforeAtAfterDeadline() public {
        uint64 dl = t0 + DAY;
        uint256 a = _bountyD(dl);
        uint256 b = _bountyD(dl);
        uint256 c = _bountyD(dl);

        vm.warp(dl - 1);
        vm.prank(payer);
        vault.cancel(a);
        vm.warp(dl);
        vm.prank(payer);
        vault.cancel(b);
        vm.warp(dl + 1);
        vm.prank(payer);
        vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.cancel(c);
    }

    function test_Refund_BoundaryBeforeAtAfterDeadline() public {
        uint64 dl = t0 + DAY;
        uint256 id = _bountyD(dl);

        vm.warp(dl - 1);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.NotYetExpired.selector);
        vault.refundExpired(id);

        vm.warp(dl);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.NotYetExpired.selector);
        vault.refundExpired(id);

        vm.warp(dl + 1);
        vm.prank(stranger);
        vault.refundExpired(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
        assertEq(usdc.balanceOf(payer), FUNDS);
    }

    function test_Refund_RevertsWhenDeadlineZeroEvenMuchLater() public {
        uint256 id = _bounty();
        vm.warp(t0 + 3650 days);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.NotYetExpired.selector);
        vault.refundExpired(id);
    }

    // ───────── assignPayee ─────────

    function test_AssignPayee_RevertsForNonPayer() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.OnlyPayer.selector);
        vault.assignPayee(id, claimer);
    }

    function test_AssignPayee_RevertsOnUnknownDeal() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.OnlyPayer.selector);
        vault.assignPayee(7, claimer);
    }

    function test_AssignPayee_RevertsWhenNotOpen() public {
        uint256 id = _bounty();
        _release(id);
        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.assignPayee(id, claimer);
    }

    function test_AssignPayee_RevertsAfterClaim() public {
        uint256 id = _task(t0 + DAY);
        _claim(id, claimer);
        vm.prank(payer);
        vm.expectRevert(BountyVault.AlreadyClaimed.selector);
        vault.assignPayee(id, stranger);
    }

    function test_AssignPayee_RevertsOnZeroPayee() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        vault.assignPayee(id, address(0));
    }

    function test_AssignPayee_RevertsToPayerOrArbitrator() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.assignPayee(id, payer);
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.assignPayee(id, arbitrator);
    }

    // ───────── release ─────────

    function test_Release_RevertsForNonPayer() public {
        uint256 id = _bounty();
        address[4] memory callers = [payee, stranger, paymaster, arbitrator];
        for (uint256 i; i < callers.length; i++) {
            vm.prank(callers[i]);
            vm.expectRevert(BountyVault.OnlyPayer.selector);
            vault.release(id);
        }
        assertEq(_vaultBal(), AMT);
    }

    function test_Release_RevertsWhenPayeeUnset() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.PayeeNotSet.selector);
        vault.release(id);
    }

    function test_Release_RevertsWithoutEvidence() public {
        uint256 id = _bounty();
        vm.prank(payer);
        vm.expectRevert(BountyVault.EvidenceMissing.selector);
        vault.release(id);
    }

    function test_Release_RevertsTwice() public {
        uint256 id = _bounty();
        _release(id);
        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.release(id);
        assertEq(usdc.balanceOf(payee), AMT);
    }

    function test_Release_RevertsOnDisputedDeal() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.release(id);
    }

    function test_Release_RevertsOnUnknownDeal() public {
        vm.prank(payer);
        vm.expectRevert(BountyVault.OnlyPayer.selector);
        vault.release(99);
    }

    // ───────── dispute ─────────

    function test_Dispute_RevertsForStranger() public {
        uint256 id = _bounty();
        address[3] memory callers = [stranger, arbitrator, paymaster];
        for (uint256 i; i < callers.length; i++) {
            vm.prank(callers[i]);
            vm.expectRevert(BountyVault.OnlyParty.selector);
            vault.dispute(id);
        }
    }

    function test_Dispute_RevertsWhenPayeeUnset() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.PayeeNotSet.selector);
        vault.dispute(id);
    }

    function test_Dispute_StrangerOnUnclaimedTaskIsOnlyParty() public {
        uint256 id = _task(t0 + DAY);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.OnlyParty.selector);
        vault.dispute(id);
    }

    function test_Dispute_RevertsWhenNotOpen() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.dispute(id);
    }

    function test_Dispute_RevertsAfterRelease() public {
        uint256 id = _bounty();
        _release(id);
        vm.prank(payee);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.dispute(id);
    }

    // ───────── resolveDispute ─────────

    function test_Resolve_RevertsForNonArbitrator() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        address[4] memory callers = [payer, payee, stranger, paymaster];
        for (uint256 i; i < callers.length; i++) {
            vm.prank(callers[i]);
            vm.expectRevert(BountyVault.OnlyArbitrator.selector);
            vault.resolveDispute(id, true);
        }
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
    }

    function test_Resolve_RevertsWhenNotDisputed() public {
        uint256 id = _bounty();
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, true);
    }

    function test_Resolve_RevertsTwice() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        _resolve(id, true);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, false);
    }

    function test_Resolve_RevertsOnReleasedAndUnknownDeals() public {
        uint256 id = _bounty();
        _release(id);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, true);
        // an unknown id has no recorded arbitrator, so even the arbitrator is rejected
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.OnlyArbitrator.selector);
        vault.resolveDispute(500, true);
    }

    // ───────── cancel ─────────

    function test_Cancel_RevertsForNonPayer() public {
        uint256 id = _bounty();
        address[3] memory callers = [payee, stranger, arbitrator];
        for (uint256 i; i < callers.length; i++) {
            vm.prank(callers[i]);
            vm.expectRevert(BountyVault.OnlyPayer.selector);
            vault.cancel(id);
        }
    }

    function test_Cancel_RevertsWhenNotOpen() public {
        uint256 id = _bounty();
        _dispute(id, payee);
        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.cancel(id);
    }

    function test_Cancel_RevertsTwice() public {
        uint256 id = _bounty();
        vm.prank(payer);
        vault.cancel(id);
        vm.prank(payer);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.cancel(id);
        assertEq(usdc.balanceOf(payer), FUNDS);
    }

    // ───────── refundExpired ─────────

    function test_Refund_RevertsOnUnknownDeal() public {
        vm.prank(stranger);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.refundExpired(123);
    }

    function test_Refund_RevertsTwice() public {
        uint256 id = _bountyD(t0 + DAY);
        vm.warp(t0 + DAY + 1);
        vault.refundExpired(id);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.refundExpired(id);
    }
}
