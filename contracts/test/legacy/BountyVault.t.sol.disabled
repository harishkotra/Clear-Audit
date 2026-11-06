// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

/// @dev Deployment + happy paths + events.
contract BountyVaultTest is BountyVaultTestBase {
    // ───────── constructor ─────────

    function test_Constructor_StoresImmutables() public view {
        assertEq(address(vault.token()), address(usdc));
        assertEq(vault.paymaster(), paymaster);
        assertEq(vault.arbitrator(), arbitrator);
        assertEq(vault.nextDealId(), 0);
    }

    function test_Constructor_RevertsOnZeroToken() public {
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        new BountyVault(address(0), paymaster, arbitrator);
    }

    function test_Constructor_RevertsOnZeroPaymaster() public {
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        new BountyVault(address(usdc), address(0), arbitrator);
    }

    function test_Constructor_RevertsOnZeroArbitrator() public {
        vm.expectRevert(BountyVault.ZeroAddress.selector);
        new BountyVault(address(usdc), paymaster, address(0));
    }

    // ───────── createBounty ─────────

    function test_CreateBounty_RecordsDealAndEscrows() public {
        uint256 id = _create();
        assertEq(id, 0);
        assertEq(vault.nextDealId(), 1);
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, protocol);
        assertEq(w, whitehat);
        assertEq(a, AMT);
        assertEq(uint8(s), uint8(BountyVault.Status.Open));
        assertEq(usdc.balanceOf(address(vault)), AMT);
        assertEq(usdc.balanceOf(protocol), FUNDS - AMT);
    }

    function test_CreateBounty_IncrementsIds() public {
        assertEq(_create(), 0);
        assertEq(_create(), 1);
        assertEq(_create(), 2);
        assertEq(vault.nextDealId(), 3);
    }

    function test_CreateBounty_EmitsEvent() public {
        vm.expectEmit(true, true, true, true, address(vault));
        emit BountyVault.BountyCreated(0, protocol, whitehat, AMT);
        _create();
    }

    function test_GetDeal_UnknownIdIsNone() public view {
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(999);
        assertEq(p, address(0));
        assertEq(w, address(0));
        assertEq(a, 0);
        assertEq(uint8(s), uint8(BountyVault.Status.None));
    }

    // ───────── releaseBounty: protocol path ─────────

    function test_Release_ByProtocolPaysWhitehatInFull() public {
        uint256 id = _create();
        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
    }

    function test_Release_ByProtocolIgnoresFeeAndRecipientArgs() public {
        uint256 id = _create();
        vm.prank(protocol);
        vault.releaseBounty(id, AMT, stranger); // would be fee-all/other recipient if honoured
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(stranger), 0);
        assertEq(usdc.balanceOf(paymaster), 0);
    }

    function test_Release_ByProtocolEmitsEvent() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.BountyReleased(id, whitehat, AMT, 0);
        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
    }

    // ───────── releaseBounty: paymaster fee path ─────────

    function test_Release_ByPaymasterTakesFee() public {
        uint256 id = _create();
        uint256 fee = 10e6;
        vm.prank(paymaster);
        vault.releaseBounty(id, fee, whitehat);
        assertEq(usdc.balanceOf(whitehat), AMT - fee);
        assertEq(usdc.balanceOf(paymaster), fee);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
    }

    function test_Release_ByPaymasterEmitsFeeEvent() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, true, address(vault));
        emit BountyVault.BountyReleased(id, whitehat, AMT - 10e6, 10e6);
        vm.prank(paymaster);
        vault.releaseBounty(id, 10e6, whitehat);
    }

    function test_Release_ByPaymasterZeroFee() public {
        uint256 id = _create();
        vm.prank(paymaster);
        vault.releaseBounty(id, 0, whitehat);
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(paymaster), 0);
    }

    function test_Release_ByPaymasterFeeEqualsAmount() public {
        uint256 id = _create();
        vm.prank(paymaster);
        vault.releaseBounty(id, AMT, whitehat);
        assertEq(usdc.balanceOf(whitehat), 0);
        assertEq(usdc.balanceOf(paymaster), AMT);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
    }

    // ───────── disputeBounty ─────────

    function test_Dispute_ByWhitehatFreezesBounty() public {
        uint256 id = _create();
        _dispute(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
        assertEq(usdc.balanceOf(address(vault)), AMT); // no funds move
    }

    function test_Dispute_EmitsEvent() public {
        uint256 id = _create();
        vm.expectEmit(true, true, false, false, address(vault));
        emit BountyVault.BountyDisputed(id, whitehat);
        _dispute(id);
    }

    // ───────── resolveDispute ─────────

    function test_Resolve_ToWhitehat() public {
        uint256 id = _create();
        _dispute(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, true);
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToWhitehat));
    }

    function test_Resolve_ToProtocolRefunds() public {
        uint256 id = _create();
        _dispute(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, false);
        assertEq(usdc.balanceOf(protocol), FUNDS);
        assertEq(usdc.balanceOf(whitehat), 0);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToProtocol));
    }

    function test_Resolve_EmitsEventWhitehat() public {
        uint256 id = _create();
        _dispute(id);
        vm.expectEmit(true, false, true, true, address(vault));
        emit BountyVault.DisputeResolved(id, true, whitehat, AMT);
        vm.prank(arbitrator);
        vault.resolveDispute(id, true);
    }

    function test_Resolve_EmitsEventProtocol() public {
        uint256 id = _create();
        _dispute(id);
        vm.expectEmit(true, false, true, true, address(vault));
        emit BountyVault.DisputeResolved(id, false, protocol, AMT);
        vm.prank(arbitrator);
        vault.resolveDispute(id, false);
    }

    // ───────── multi-deal isolation ─────────

    function test_Flow_IndependentDeals() public {
        uint256 a = _create(100e6);
        uint256 b = _create(200e6);
        uint256 c = _create(300e6);
        vm.prank(protocol);
        vault.releaseBounty(a, 0, whitehat);
        _dispute(b);
        assertEq(usdc.balanceOf(address(vault)), 500e6);
        assertEq(uint8(_status(c)), uint8(BountyVault.Status.Open));
        vm.prank(arbitrator);
        vault.resolveDispute(b, false);
        assertEq(usdc.balanceOf(address(vault)), 300e6);
        assertEq(usdc.balanceOf(whitehat), 100e6);
    }
}
