// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

contract BountyVaultFuzzTest is BountyVaultTestBase {
    function testFuzz_Create_EscrowsExactAmount(uint256 amount, address wh) public {
        amount = bound(amount, 1, FUNDS);
        vm.assume(wh != address(0) && wh != protocol && wh != arbitrator);
        vm.assume(wh != address(vault));
        vm.prank(protocol);
        uint256 id = vault.createBounty(wh, amount);
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, protocol);
        assertEq(w, wh);
        assertEq(a, amount);
        assertEq(uint8(s), uint8(BountyVault.Status.Open));
        assertEq(usdc.balanceOf(address(vault)), amount);
        assertEq(usdc.balanceOf(protocol), FUNDS - amount);
    }

    function testFuzz_PaymasterRelease_FeeSplitConserves(uint256 amount, uint256 fee) public {
        amount = bound(amount, 1, FUNDS);
        fee = bound(fee, 0, amount);
        uint256 id = _create(amount);
        vm.prank(paymaster);
        vault.releaseBounty(id, fee, whitehat);
        assertEq(usdc.balanceOf(whitehat), amount - fee);
        assertEq(usdc.balanceOf(paymaster), fee);
        assertEq(usdc.balanceOf(whitehat) + usdc.balanceOf(paymaster), amount);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function testFuzz_PaymasterRelease_FeeAboveAmountReverts(uint256 amount, uint256 fee) public {
        amount = bound(amount, 1, FUNDS);
        fee = bound(fee, amount + 1, type(uint256).max);
        uint256 id = _create(amount);
        vm.prank(paymaster);
        vm.expectRevert(BountyVault.FeeExceedsAmount.selector);
        vault.releaseBounty(id, fee, whitehat);
    }

    function testFuzz_ProtocolRelease_AlwaysPaysFullToRecordedWhitehat(
        uint256 amount,
        uint256 fee,
        address fakeRecipient
    ) public {
        amount = bound(amount, 1, FUNDS);
        uint256 id = _create(amount);
        vm.prank(protocol);
        vault.releaseBounty(id, fee, fakeRecipient);
        assertEq(usdc.balanceOf(whitehat), amount);
        assertEq(usdc.balanceOf(paymaster), 0);
    }

    function testFuzz_Resolve_PaysFullAmountToChosenParty(uint256 amount, bool payWhitehat) public {
        amount = bound(amount, 1, FUNDS);
        uint256 id = _create(amount);
        _dispute(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, payWhitehat);
        assertEq(usdc.balanceOf(address(vault)), 0);
        if (payWhitehat) {
            assertEq(usdc.balanceOf(whitehat), amount);
            assertEq(usdc.balanceOf(protocol), FUNDS - amount);
        } else {
            assertEq(usdc.balanceOf(whitehat), 0);
            assertEq(usdc.balanceOf(protocol), FUNDS);
        }
    }

    function testFuzz_AnyOtherCallerCannotRelease(address caller, uint256 fee) public {
        vm.assume(caller != protocol && caller != paymaster);
        uint256 id = _create();
        vm.prank(caller);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(id, fee, whitehat);
    }

    function testFuzz_AnyNonArbitratorCannotResolve(address caller, bool pay) public {
        vm.assume(caller != arbitrator);
        uint256 id = _create();
        _dispute(id);
        vm.prank(caller);
        vm.expectRevert(BountyVault.OnlyArbitrator.selector);
        vault.resolveDispute(id, pay);
    }

    function testFuzz_AnyNonWhitehatCannotDispute(address caller) public {
        vm.assume(caller != whitehat);
        uint256 id = _create();
        vm.prank(caller);
        vm.expectRevert(BountyVault.OnlyWhitehat.selector);
        vault.disputeBounty(id);
    }
}
