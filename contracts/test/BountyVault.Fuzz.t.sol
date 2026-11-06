// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

contract BountyVaultFuzzTest is BountyVaultTestBase {
    function testFuzz_CreateBounty_EscrowsExactAmount(uint256 amount, address to, uint64 dlOffset) public {
        amount = bound(amount, 1, FUNDS);
        vm.assume(to != address(0) && to != payer && to != arbitrator && to != address(vault));
        dlOffset = uint64(bound(dlOffset, 0, 3650 days));
        uint64 dl = dlOffset == 0 ? 0 : t0 + dlOffset;
        uint256 id = _bountyFull(to, amount, dl);
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, payer);
        assertEq(w, to);
        assertEq(a, amount);
        assertEq(uint8(s), uint8(BountyVault.Status.Open));
        assertEq(_vaultBal(), amount);
        assertEq(usdc.balanceOf(payer), FUNDS - amount);
    }

    function testFuzz_CreateBounty_DeadlineValidation(uint64 deadline, uint64 nowTs) public {
        nowTs = uint64(bound(nowTs, 1, type(uint64).max - 1));
        vm.warp(nowTs);
        vm.prank(payer);
        if (deadline != 0 && deadline <= nowTs) {
            vm.expectRevert(BountyVault.DeadlinePassed.selector);
        }
        vault.createBounty(payee, uint128(AMT), deadline, CRIT);
    }

    function testFuzz_CreateOpenTask_DeadlineValidation(uint64 deadline) public {
        vm.prank(payer);
        if (deadline == 0) {
            vm.expectRevert(BountyVault.DeadlineRequired.selector);
        } else if (deadline <= t0) {
            vm.expectRevert(BountyVault.DeadlinePassed.selector);
        }
        vault.createOpenTask(uint128(AMT), deadline, CRIT);
    }

    function testFuzz_ClaimThenRelease_PaysClaimerFullAmount(uint256 amount, address who) public {
        amount = bound(amount, 1, FUNDS);
        vm.assume(who != address(0) && who != payer && who != arbitrator && who != address(vault));
        uint256 id = _taskAmt(amount, t0 + DAY);
        _claim(id, who);
        _release(id);
        assertEq(usdc.balanceOf(who), amount);
        assertEq(_vaultBal(), 0);
        assertEq(usdc.balanceOf(payer), FUNDS - amount);
    }

    function testFuzz_ClaimWindow_ClaimableIffNotAfterDeadline(uint64 dlOffset, uint64 warpBy) public {
        dlOffset = uint64(bound(dlOffset, 1, 365 days));
        warpBy = uint64(bound(warpBy, 0, 400 days));
        uint64 dl = t0 + dlOffset;
        uint256 id = _task(dl);
        vm.warp(t0 + warpBy);
        vm.prank(claimer);
        if (block.timestamp > dl) vm.expectRevert(BountyVault.DeadlinePassed.selector);
        vault.claimTask(id);
    }

    function testFuzz_RefundWindow_RefundableIffStrictlyAfterDeadline(uint64 dlOffset, uint64 warpBy, bool claimed)
        public
    {
        dlOffset = uint64(bound(dlOffset, 1, 365 days));
        warpBy = uint64(bound(warpBy, 0, 400 days));
        uint64 dl = t0 + dlOffset;
        uint256 id = _task(dl);
        if (claimed) _claim(id, claimer);
        vm.warp(t0 + warpBy);
        vm.prank(stranger);
        if (block.timestamp <= dl) vm.expectRevert(BountyVault.NotYetExpired.selector);
        vault.refundExpired(id);
        if (block.timestamp > dl) {
            assertEq(usdc.balanceOf(payer), FUNDS);
            assertEq(usdc.balanceOf(claimer), 0);
        } else {
            assertEq(_vaultBal(), AMT);
        }
    }

    function testFuzz_CancelWindow_CancellableIffUnclaimedAndNotAfterDeadline(
        uint64 dlOffset,
        uint64 warpBy,
        bool claimed
    ) public {
        dlOffset = uint64(bound(dlOffset, 1, 365 days));
        warpBy = uint64(bound(warpBy, 0, dlOffset)); // claim must still be possible
        uint64 dl = t0 + dlOffset;
        uint256 id = _task(dl);
        if (claimed) _claim(id, claimer);
        vm.warp(t0 + warpBy);
        vm.prank(payer);
        if (claimed) vm.expectRevert(BountyVault.AlreadyClaimed.selector);
        vault.cancel(id);
        assertEq(usdc.balanceOf(payer), claimed ? FUNDS - AMT : FUNDS);
    }

    function testFuzz_Release_OnlyPayer(address caller) public {
        vm.assume(caller != payer);
        uint256 id = _bounty();
        vm.prank(caller);
        vm.expectRevert(BountyVault.OnlyPayer.selector);
        vault.release(id);
        assertEq(_vaultBal(), AMT);
    }

    function testFuzz_ResolveDispute_ConservesAndPaysOneParty(uint256 amount, bool toPayee) public {
        amount = bound(amount, 1, FUNDS);
        uint256 id = _bountyFull(payee, amount, 0);
        _dispute(id, payee);
        _resolve(id, toPayee);
        assertEq(usdc.balanceOf(toPayee ? payee : payer), toPayee ? amount : FUNDS);
        assertEq(usdc.balanceOf(toPayee ? payer : payee), toPayee ? FUNDS - amount : 0);
        assertEq(_vaultBal(), 0);
    }

    function testFuzz_ConservationAcrossManyDeals(uint8 n, uint256 seed) public {
        n = uint8(bound(n, 1, 12));
        for (uint256 i; i < n; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            uint256 amount = bound(r, 1, 10_000e6);
            uint256 id = r % 2 == 0 ? _bountyFull(payee, amount, t0 + DAY) : _taskAmt(amount, t0 + DAY);
            uint256 action = (r >> 8) % 5;
            if (action == 1 && _payeeOf(id) == address(0)) {
                _claim(id, claimer);
            }
            if (action == 1 && _payeeOf(id) != address(0)) _release(id);
            if (action == 2 && _payeeOf(id) != address(0)) _dispute(id, payer);
            if (action == 3) {
                vm.prank(payer);
                vault.cancel(id);
            }
            assertEq(_vaultBal(), _liveEscrow());
        }
        vm.warp(t0 + DAY + 1);
        for (uint256 i; i < n; i++) {
            if (_status(i) == BountyVault.Status.Open) vault.refundExpired(i);
            assertEq(_vaultBal(), _liveEscrow());
        }
    }
}
