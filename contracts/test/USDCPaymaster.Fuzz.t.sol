// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {USDCPaymasterTestBase} from "./USDCPaymaster.Base.t.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";
import {PackedUserOperation} from "../interfaces/IPaymaster.sol";

contract USDCPaymasterFuzzTest is USDCPaymasterTestBase {
    function testFuzz_MaxCostBoundary(uint256 cap, uint256 maxCost) public {
        uint256 id = _create();
        pm.setMaxSponsoredCost(cap);
        PackedUserOperation memory op = _goodOp(id);
        vm.prank(entryPoint);
        if (maxCost > cap) {
            vm.expectRevert(USDCPaymaster.MaxCostExceeded.selector);
            pm.validatePaymasterUserOp(op, bytes32(0), maxCost);
            assertEq(pm.sponsoredAttempts(id), 0);
        } else {
            pm.validatePaymasterUserOp(op, bytes32(0), maxCost);
            assertEq(pm.sponsoredAttempts(id), 1);
        }
    }

    function testFuzz_AnyNonZeroFeeRejected(uint256 fee) public {
        fee = bound(fee, 1, type(uint256).max);
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(address(vault), 0, _inner(id, fee, whitehat)));
        vm.prank(entryPoint);
        vm.expectRevert(USDCPaymaster.InvalidFee.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
    }

    function testFuzz_AnyNonZeroValueRejected(uint256 value) public {
        value = bound(value, 1, type(uint256).max);
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(address(vault), value, _inner(id, 0, whitehat)));
        vm.prank(entryPoint);
        vm.expectRevert(USDCPaymaster.NonZeroValue.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
    }

    function testFuzz_AnyOtherTargetRejected(address target) public {
        vm.assume(target != address(vault));
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(target, 0, _inner(id, 0, whitehat)));
        vm.prank(entryPoint);
        vm.expectRevert(USDCPaymaster.InvalidTarget.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
    }

    function testFuzz_AnyOtherSenderRejected(address sender) public {
        vm.assume(sender != protocol && sender != address(0));
        pm.setSponsoredProtocol(sender, true); // approved, yet not the bounty's protocol
        uint256 id = _create();
        PackedUserOperation memory op = _op(sender, _exec(address(vault), 0, _inner(id, 0, whitehat)));
        vm.prank(entryPoint);
        vm.expectRevert(USDCPaymaster.IneligibleBounty.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
        assertEq(pm.sponsoredAttempts(id), 0);
    }

    function testFuzz_UnapprovedSenderRejectedWithoutConsumingAttempt(address sender) public {
        vm.assume(sender != protocol);
        uint256 id = _create();
        PackedUserOperation memory op = _op(sender, _exec(address(vault), 0, _inner(id, 0, whitehat)));
        vm.prank(entryPoint);
        vm.expectRevert(USDCPaymaster.ProtocolNotApproved.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
        assertEq(pm.sponsoredAttempts(id), 0);
    }

    function testFuzz_SetSponsoredProtocol_StoresFlag(address who, bool approved) public {
        vm.assume(who != address(0));
        pm.setSponsoredProtocol(who, approved);
        assertEq(pm.sponsoredProtocols(who), approved);
    }

    function testFuzz_SetSponsoredProtocol_OnlyOwner(address caller, address who, bool approved) public {
        vm.assume(caller != address(this));
        vm.prank(caller);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setSponsoredProtocol(who, approved);
    }

    function testFuzz_AnyOtherCallerCannotValidate(address caller) public {
        vm.assume(caller != entryPoint);
        uint256 id = _create();
        PackedUserOperation memory op = _goodOp(id);
        vm.prank(caller);
        vm.expectRevert(USDCPaymaster.OnlyEntryPoint.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
    }

    function testFuzz_VaultFeeFlowsToPaymasterAndOwner(uint256 amount, uint256 fee) public {
        amount = bound(amount, 1, 500_000e6);
        fee = bound(fee, 0, amount);
        vm.prank(protocol);
        uint256 id = vault.createBounty(whitehat, amount);
        vm.prank(address(pm));
        vault.releaseBounty(id, fee, whitehat);
        pm.withdrawFees();
        assertEq(usdc.balanceOf(address(this)), fee);
        assertEq(usdc.balanceOf(whitehat), amount - fee);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}
