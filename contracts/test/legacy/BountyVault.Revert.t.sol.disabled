// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";
import {MockFalseToken} from "../test-helpers/MockFalseToken.sol";

/// @dev Revert paths, access control, state-machine guards, no double payout.
contract BountyVaultRevertTest is BountyVaultTestBase {
    // ───────── createBounty ─────────

    function test_Create_RevertsZeroWhitehat() public {
        vm.prank(protocol);
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        vault.createBounty(address(0), AMT);
    }

    function test_Create_RevertsZeroAmount() public {
        vm.prank(protocol);
        vm.expectRevert(BountyVault.ZeroAmount.selector);
        vault.createBounty(whitehat, 0);
    }

    function test_Create_RevertsWhitehatIsProtocol() public {
        vm.prank(protocol);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createBounty(protocol, AMT);
    }

    function test_Create_RevertsCallerIsArbitrator() public {
        usdc.mint(arbitrator, AMT);
        vm.startPrank(arbitrator);
        usdc.approve(address(vault), AMT);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createBounty(whitehat, AMT);
        vm.stopPrank();
    }

    function test_Create_RevertsWhitehatIsArbitrator() public {
        vm.prank(protocol);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.createBounty(arbitrator, AMT);
    }

    function test_Create_RevertsWithoutAllowance() public {
        vm.prank(stranger);
        vm.expectRevert(); // MockUSDC: "Insufficient balance"
        vault.createBounty(whitehat, AMT);
        assertEq(vault.nextDealId(), 0);
    }

    function test_Create_RevertsInsufficientAllowance() public {
        usdc.mint(stranger, AMT);
        vm.startPrank(stranger);
        usdc.approve(address(vault), AMT - 1);
        vm.expectRevert(bytes("Insufficient allowance"));
        vault.createBounty(whitehat, AMT);
        vm.stopPrank();
    }

    function test_Create_RevertsTransferFailedOnFalseReturn() public {
        MockFalseToken ft = new MockFalseToken();
        BountyVault v = new BountyVault(address(ft), paymaster, arbitrator);
        ft.mint(protocol, AMT);
        vm.prank(protocol);
        ft.approve(address(v), AMT);
        ft.setFailing(true);
        vm.prank(protocol);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        v.createBounty(whitehat, AMT);
        assertEq(v.nextDealId(), 0, "effects rolled back");
    }

    // ───────── releaseBounty ─────────

    function test_Release_WhitehatCannotSelfRelease() public {
        uint256 id = _create();
        vm.prank(whitehat);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(id, 0, whitehat);
        assertEq(usdc.balanceOf(whitehat), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
    }

    function test_Release_ArbitratorCannotRelease() public {
        uint256 id = _create();
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_Release_StrangerCannotRelease() public {
        uint256 id = _create();
        vm.prank(stranger);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_Release_OtherProtocolCannotReleaseForeignDeal() public {
        uint256 id = _create();
        address other = makeAddr("otherProtocol");
        vm.prank(other);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_Release_NonexistentDealByStrangerUnauthorized() public {
        vm.prank(stranger);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(42, 0, whitehat);
    }

    function test_Release_NonexistentDealByPaymasterNotOpen() public {
        vm.prank(paymaster);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.releaseBounty(42, 0, address(0));
    }

    function test_Release_PaymasterWhitehatMismatch() public {
        uint256 id = _create();
        vm.prank(paymaster);
        vm.expectRevert(BountyVault.WhitehatMismatch.selector);
        vault.releaseBounty(id, 0, stranger);
    }

    function test_Release_PaymasterFeeExceedsAmount() public {
        uint256 id = _create();
        vm.prank(paymaster);
        vm.expectRevert(BountyVault.FeeExceedsAmount.selector);
        vault.releaseBounty(id, AMT + 1, whitehat);
    }

    function test_Release_NoDoublePayoutByProtocol() public {
        uint256 id = _create();
        _create(); // second deal funds remain in vault
        vm.startPrank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.releaseBounty(id, 0, whitehat);
        vm.stopPrank();
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(address(vault)), AMT);
    }

    function test_Release_NoDoublePayoutByPaymaster() public {
        uint256 id = _create();
        vm.startPrank(paymaster);
        vault.releaseBounty(id, 1e6, whitehat);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.releaseBounty(id, 1e6, whitehat);
        vm.stopPrank();
    }

    function test_Release_DisputedCannotBeReleasedByProtocol() public {
        uint256 id = _create();
        _dispute(id);
        vm.prank(protocol);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_Release_DisputedCannotBeReleasedByPaymaster() public {
        uint256 id = _create();
        _dispute(id);
        vm.prank(paymaster);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_Release_ResolvedCannotBeReleased() public {
        uint256 id = _create();
        _dispute(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, false);
        vm.prank(protocol);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_Release_RevertsTransferFailedOnFalseReturn() public {
        MockFalseToken ft = new MockFalseToken();
        BountyVault v = new BountyVault(address(ft), paymaster, arbitrator);
        ft.mint(protocol, AMT);
        vm.startPrank(protocol);
        ft.approve(address(v), AMT);
        uint256 id = v.createBounty(whitehat, AMT);
        vm.stopPrank();
        ft.setFailing(true);
        vm.prank(protocol);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        v.releaseBounty(id, 0, whitehat);
        (,,, BountyVault.Status s) = v.getDeal(id);
        assertEq(uint8(s), uint8(BountyVault.Status.Open), "status rolled back");
    }

    // ───────── disputeBounty ─────────

    function test_Dispute_OnlyWhitehat() public {
        uint256 id = _create();
        vm.prank(protocol);
        vm.expectRevert(BountyVault.OnlyWhitehat.selector);
        vault.disputeBounty(id);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.OnlyWhitehat.selector);
        vault.disputeBounty(id);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.OnlyWhitehat.selector);
        vault.disputeBounty(id);
        vm.prank(paymaster);
        vm.expectRevert(BountyVault.OnlyWhitehat.selector);
        vault.disputeBounty(id);
    }

    function test_Dispute_NonexistentDeal() public {
        vm.prank(whitehat);
        vm.expectRevert(BountyVault.OnlyWhitehat.selector);
        vault.disputeBounty(7);
        vm.prank(address(0));
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.disputeBounty(7); // address(0) matches empty whitehat; status None blocks it
    }

    function test_Dispute_TwiceReverts() public {
        uint256 id = _create();
        _dispute(id);
        vm.prank(whitehat);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.disputeBounty(id);
    }

    function test_Dispute_AfterReleaseReverts() public {
        uint256 id = _create();
        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        vm.prank(whitehat);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.disputeBounty(id);
    }

    // ───────── resolveDispute ─────────

    function test_Resolve_OnlyArbitrator() public {
        uint256 id = _create();
        _dispute(id);
        address[5] memory callers = [protocol, whitehat, paymaster, stranger, address(this)];
        for (uint256 i; i < callers.length; i++) {
            vm.prank(callers[i]);
            vm.expectRevert(BountyVault.OnlyArbitrator.selector);
            vault.resolveDispute(id, true);
        }
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
    }

    function test_Resolve_OpenNotResolvable() public {
        uint256 id = _create();
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, true);
    }

    function test_Resolve_NonexistentNotResolvable() public {
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(55, false);
    }

    function test_Resolve_ReleasedNotResolvable() public {
        uint256 id = _create();
        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, true);
    }

    function test_Resolve_NoDoublePayout() public {
        uint256 id = _create();
        _create();
        _dispute(id);
        vm.startPrank(arbitrator);
        vault.resolveDispute(id, true);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, true);
        vm.expectRevert(BountyVault.NotDisputed.selector);
        vault.resolveDispute(id, false);
        vm.stopPrank();
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(address(vault)), AMT);
    }

    function test_Resolve_RevertsTransferFailedOnFalseReturn() public {
        MockFalseToken ft = new MockFalseToken();
        BountyVault v = new BountyVault(address(ft), paymaster, arbitrator);
        ft.mint(protocol, AMT);
        vm.startPrank(protocol);
        ft.approve(address(v), AMT);
        uint256 id = v.createBounty(whitehat, AMT);
        vm.stopPrank();
        vm.prank(whitehat);
        v.disputeBounty(id);
        ft.setFailing(true);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        v.resolveDispute(id, true);
        (,,, BountyVault.Status s) = v.getDeal(id);
        assertEq(uint8(s), uint8(BountyVault.Status.Disputed), "status rolled back");
    }
}
