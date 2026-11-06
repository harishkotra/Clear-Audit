// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {USDCPaymasterTestBase} from "./USDCPaymaster.Base.t.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";

/// @dev Owner functions, EntryPoint deposit management, fee withdrawal, vault fee path.
contract USDCPaymasterAdminTest is USDCPaymasterTestBase {
    receive() external payable {}

    // ───────── setMaxSponsoredCost ─────────

    function test_SetMaxSponsoredCost_UpdatesAndEmits() public {
        vm.expectEmit(false, false, false, true, address(pm));
        emit USDCPaymaster.MaxSponsoredCostUpdated(5e16, 123);
        pm.setMaxSponsoredCost(123);
        assertEq(pm.maxSponsoredCost(), 123);
    }

    function test_SetMaxSponsoredCost_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setMaxSponsoredCost(1);
        assertEq(pm.maxSponsoredCost(), 5e16);
    }

    // ───────── depositToEntryPoint ─────────

    function test_DepositToEntryPoint_ForwardsValueAndEmits() public {
        vm.deal(address(this), 1 ether);
        vm.expectEmit(false, false, false, true, address(pm));
        emit USDCPaymaster.Deposited(0.3 ether);
        pm.depositToEntryPoint{value: 0.3 ether}();
        assertEq(ep.deposits(address(pm)), 0.3 ether);
        assertEq(address(ep).balance, 0.3 ether);
    }

    function test_DepositToEntryPoint_OnlyOwner() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.depositToEntryPoint{value: 1}();
    }

    function test_DepositToEntryPoint_RevertsWhenEntryPointHasNoCode() public {
        USDCPaymaster bare = new USDCPaymaster(makeAddr("eoaEP"), address(vault), address(usdc));
        vm.deal(address(this), 1 ether);
        vm.expectRevert(USDCPaymaster.EntryPointNotContract.selector);
        bare.depositToEntryPoint{value: 1}();
    }

    function test_DepositToEntryPoint_RevertsWhenEntryPointFails() public {
        ep.setFailDeposit(true);
        vm.deal(address(this), 1 ether);
        vm.expectRevert(USDCPaymaster.EntryPointDepositFailed.selector);
        pm.depositToEntryPoint{value: 1}();
    }

    // ───────── depositBalanceToEntryPoint ─────────

    function test_DepositBalanceToEntryPoint_UsesExistingBalance() public {
        vm.deal(address(pm), 1 ether);
        vm.expectEmit(false, false, false, true, address(pm));
        emit USDCPaymaster.Deposited(0.4 ether);
        pm.depositBalanceToEntryPoint(0.4 ether);
        assertEq(ep.deposits(address(pm)), 0.4 ether);
        assertEq(address(pm).balance, 0.6 ether);
    }

    function test_DepositBalanceToEntryPoint_OnlyOwner() public {
        vm.deal(address(pm), 1 ether);
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.depositBalanceToEntryPoint(1);
    }

    function test_DepositBalanceToEntryPoint_RevertsOnInsufficientBalance() public {
        vm.deal(address(pm), 1 ether);
        vm.expectRevert(USDCPaymaster.EntryPointDepositFailed.selector);
        pm.depositBalanceToEntryPoint(2 ether);
    }

    function test_DepositBalanceToEntryPoint_RevertsWhenNoCode() public {
        USDCPaymaster bare = new USDCPaymaster(makeAddr("eoaEP"), address(vault), address(usdc));
        vm.expectRevert(USDCPaymaster.EntryPointNotContract.selector);
        bare.depositBalanceToEntryPoint(0);
    }

    function test_Receive_AcceptsEth() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(pm).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(pm).balance, 1 ether);
    }

    // ───────── withdrawFromEntryPoint ─────────

    function test_WithdrawFromEntryPoint_SendsToRecipientAndEmits() public {
        vm.deal(address(pm), 1 ether);
        pm.depositBalanceToEntryPoint(1 ether);
        address payable to = payable(makeAddr("recipient"));
        vm.expectEmit(true, false, false, true, address(pm));
        emit USDCPaymaster.EntryPointWithdrawn(to, 0.25 ether);
        pm.withdrawFromEntryPoint(to, 0.25 ether);
        assertEq(to.balance, 0.25 ether);
        assertEq(ep.deposits(address(pm)), 0.75 ether);
    }

    function test_WithdrawFromEntryPoint_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.withdrawFromEntryPoint(payable(stranger), 1);
    }

    function test_WithdrawFromEntryPoint_RevertsZeroRecipient() public {
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        pm.withdrawFromEntryPoint(payable(address(0)), 1);
    }

    function test_WithdrawFromEntryPoint_RevertsOnOverdraw() public {
        vm.expectRevert(USDCPaymaster.EntryPointWithdrawFailed.selector);
        pm.withdrawFromEntryPoint(payable(stranger), 1);
    }

    function test_WithdrawFromEntryPoint_RevertsWhenNoCode() public {
        USDCPaymaster bare = new USDCPaymaster(makeAddr("eoaEP"), address(vault), address(usdc));
        vm.expectRevert(USDCPaymaster.EntryPointNotContract.selector);
        bare.withdrawFromEntryPoint(payable(stranger), 1);
    }

    // ───────── withdrawFees + vault paymaster-caller fee path ─────────

    function test_VaultFeePath_PaymasterCollectsFeeThenOwnerWithdraws() public {
        uint256 id = _create();
        uint256 fee = 25e6;
        vm.prank(address(pm)); // the vault's immutable paymaster
        vault.releaseBounty(id, fee, whitehat);
        assertEq(usdc.balanceOf(address(pm)), fee);
        assertEq(usdc.balanceOf(whitehat), AMT - fee);

        vm.expectEmit(true, false, false, true, address(pm));
        emit USDCPaymaster.Withdrawn(address(this), fee);
        pm.withdrawFees();
        assertEq(usdc.balanceOf(address(this)), fee);
        assertEq(usdc.balanceOf(address(pm)), 0);
    }

    function test_WithdrawFees_OnlyOwner() public {
        usdc.mint(address(pm), 5e6);
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.withdrawFees();
        assertEq(usdc.balanceOf(address(pm)), 5e6);
    }

    function test_WithdrawFees_ZeroBalanceIsNoOpWithoutEvent() public {
        vm.recordLogs();
        pm.withdrawFees();
        assertEq(vm.getRecordedLogs().length, 0);
    }
}
