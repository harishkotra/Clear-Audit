// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {USDCPaymasterTestBase} from "./USDCPaymaster.Base.t.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";
import {BountyVault} from "../BountyVault.sol";
import {PackedUserOperation} from "../interfaces/IPaymaster.sol";

/// @dev Owner-managed sponsorship allowlist (`sponsoredProtocols`).
contract USDCPaymasterAllowlistTest is USDCPaymasterTestBase {
    address internal newProtocol = makeAddr("newProtocol");

    function _expectValidateRevert(PackedUserOperation memory op, uint256 maxCost, bytes4 sel) internal {
        vm.prank(entryPoint);
        vm.expectRevert(sel);
        pm.validatePaymasterUserOp(op, bytes32(0), maxCost);
    }

    /// bounty created by `p`, with `p` as the protocol
    function _createFor(address p) internal returns (uint256 id) {
        usdc.mint(p, AMT);
        vm.startPrank(p);
        usdc.approve(address(vault), type(uint256).max);
        id = vault.createBounty(whitehat, AMT);
        vm.stopPrank();
    }

    function _opFor(address p, uint256 id) internal view returns (PackedUserOperation memory) {
        return _op(p, _exec(address(vault), 0, _inner(id, 0, whitehat)));
    }

    // ───────── setSponsoredProtocol ─────────

    function test_SetSponsoredProtocol_DefaultsToFalse() public view {
        assertFalse(pm.sponsoredProtocols(newProtocol));
        assertFalse(pm.sponsoredProtocols(stranger));
    }

    function test_SetSponsoredProtocol_SetupApprovedProtocol() public view {
        assertTrue(pm.sponsoredProtocols(protocol));
    }

    function test_SetSponsoredProtocol_ApproveSetsFlag() public {
        pm.setSponsoredProtocol(newProtocol, true);
        assertTrue(pm.sponsoredProtocols(newProtocol));
    }

    function test_SetSponsoredProtocol_RevokeClearsFlag() public {
        pm.setSponsoredProtocol(newProtocol, true);
        pm.setSponsoredProtocol(newProtocol, false);
        assertFalse(pm.sponsoredProtocols(newProtocol));
    }

    function test_SetSponsoredProtocol_DoesNotAffectOthers() public {
        pm.setSponsoredProtocol(newProtocol, true);
        assertTrue(pm.sponsoredProtocols(protocol));
        assertFalse(pm.sponsoredProtocols(stranger));
        pm.setSponsoredProtocol(newProtocol, false);
        assertTrue(pm.sponsoredProtocols(protocol));
    }

    function test_SetSponsoredProtocol_EmitsOnApprove() public {
        vm.expectEmit(true, false, false, true, address(pm));
        emit USDCPaymaster.ProtocolSponsorshipSet(newProtocol, true);
        pm.setSponsoredProtocol(newProtocol, true);
    }

    function test_SetSponsoredProtocol_EmitsOnRevoke() public {
        vm.expectEmit(true, false, false, true, address(pm));
        emit USDCPaymaster.ProtocolSponsorshipSet(protocol, false);
        pm.setSponsoredProtocol(protocol, false);
    }

    function test_SetSponsoredProtocol_EmitsEvenWhenUnchanged() public {
        vm.expectEmit(true, false, false, true, address(pm));
        emit USDCPaymaster.ProtocolSponsorshipSet(protocol, true);
        pm.setSponsoredProtocol(protocol, true);
        assertTrue(pm.sponsoredProtocols(protocol));
    }

    function test_SetSponsoredProtocol_OnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setSponsoredProtocol(newProtocol, true);
        assertFalse(pm.sponsoredProtocols(newProtocol));
    }

    function test_SetSponsoredProtocol_ProtocolItselfCannotSelfApprove() public {
        vm.prank(newProtocol);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setSponsoredProtocol(newProtocol, true);
    }

    function test_SetSponsoredProtocol_EntryPointCannotApprove() public {
        vm.prank(entryPoint);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setSponsoredProtocol(newProtocol, true);
    }

    function test_SetSponsoredProtocol_OnlyOwnerCheckedBeforeZeroAddress() public {
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setSponsoredProtocol(address(0), true);
    }

    function test_SetSponsoredProtocol_RevertsOnZeroAddress() public {
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        pm.setSponsoredProtocol(address(0), true);
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        pm.setSponsoredProtocol(address(0), false);
        assertFalse(pm.sponsoredProtocols(address(0)));
    }

    // ───────── validation gating ─────────

    function test_Validate_UnapprovedSenderRevertsProtocolNotApproved() public {
        uint256 id = _createFor(newProtocol); // real, open bounty owned by the sender
        _expectValidateRevert(_opFor(newProtocol, id), 1, USDCPaymaster.ProtocolNotApproved.selector);
    }

    function test_Validate_UnapprovedSenderConsumesNoAttempt() public {
        uint256 id = _createFor(newProtocol);
        _expectValidateRevert(_opFor(newProtocol, id), 1, USDCPaymaster.ProtocolNotApproved.selector);
        _expectValidateRevert(_opFor(newProtocol, id), 1, USDCPaymaster.ProtocolNotApproved.selector);
        assertEq(pm.sponsoredAttempts(id), 0);

        // after approval the full three-attempt allowance is still available
        pm.setSponsoredProtocol(newProtocol, true);
        for (uint256 i; i < 3; i++) {
            vm.prank(entryPoint);
            pm.validatePaymasterUserOp(_opFor(newProtocol, id), bytes32(0), 1);
        }
        assertEq(pm.sponsoredAttempts(id), 3);
    }

    function test_Validate_UnapprovedCheckedBeforeVaultCall() public {
        uint256 id = _createFor(newProtocol);
        vm.expectCall(address(vault), abi.encodeWithSelector(BountyVault.getDeal.selector, id), 0);
        _expectValidateRevert(_opFor(newProtocol, id), 1, USDCPaymaster.ProtocolNotApproved.selector);
    }

    function test_Validate_UnapprovedBeatsIneligibleBounty() public {
        // nonexistent deal would give IneligibleBounty if the vault were consulted first
        _expectValidateRevert(_opFor(newProtocol, 999), 1, USDCPaymaster.ProtocolNotApproved.selector);
        // same for a whitehat mismatch on an unapproved sender
        uint256 id = _createFor(newProtocol);
        PackedUserOperation memory op = _op(newProtocol, _exec(address(vault), 0, _inner(id, 0, stranger)));
        _expectValidateRevert(op, 1, USDCPaymaster.ProtocolNotApproved.selector);
    }

    function test_Validate_UnapprovedBeatsAttemptsExhaustedAndMaxCost() public {
        uint256 id = _create();
        for (uint256 i; i < 3; i++) _validate(_goodOp(id), 1);
        pm.setSponsoredProtocol(protocol, false);
        _expectValidateRevert(_goodOp(id), 1, USDCPaymaster.ProtocolNotApproved.selector);
        _expectValidateRevert(_goodOp(id), pm.maxSponsoredCost() + 1, USDCPaymaster.ProtocolNotApproved.selector);
        assertEq(pm.sponsoredAttempts(id), 3);
    }

    function test_Validate_StructuralChecksStillPrecedeApproval() public {
        // wrong target / fee / value are rejected on their own errors, even for an unapproved sender
        uint256 id = _createFor(newProtocol);
        _expectValidateRevert(
            _op(newProtocol, _exec(address(usdc), 0, _inner(id, 0, whitehat))),
            1,
            USDCPaymaster.InvalidTarget.selector
        );
        _expectValidateRevert(
            _op(newProtocol, _exec(address(vault), 0, _inner(id, 1, whitehat))), 1, USDCPaymaster.InvalidFee.selector
        );
        _expectValidateRevert(
            _op(newProtocol, _exec(address(vault), 1, _inner(id, 0, whitehat))),
            1,
            USDCPaymaster.NonZeroValue.selector
        );
    }

    function test_Validate_ApprovedSenderIsSponsored() public {
        uint256 id = _createFor(newProtocol);
        pm.setSponsoredProtocol(newProtocol, true);
        vm.prank(entryPoint);
        (bytes memory ctx, uint256 vd) = pm.validatePaymasterUserOp(_opFor(newProtocol, id), bytes32(0), 1);
        assertEq(vd, 0);
        (uint256 cid, address cwh) = abi.decode(ctx, (uint256, address));
        assertEq(cid, id);
        assertEq(cwh, whitehat);
        assertEq(pm.sponsoredAttempts(id), 1);
    }

    function test_Validate_ApprovalIsPerSender() public {
        uint256 id = _createFor(newProtocol);
        // approving a different account does not admit newProtocol
        pm.setSponsoredProtocol(stranger, true);
        _expectValidateRevert(_opFor(newProtocol, id), 1, USDCPaymaster.ProtocolNotApproved.selector);
    }

    function test_Validate_RevokeBlocksLaterValidation() public {
        uint256 id = _create();
        _validate(_goodOp(id), 1);
        assertEq(pm.sponsoredAttempts(id), 1);

        pm.setSponsoredProtocol(protocol, false);
        _expectValidateRevert(_goodOp(id), 1, USDCPaymaster.ProtocolNotApproved.selector);
        assertEq(pm.sponsoredAttempts(id), 1); // unchanged, not reset
    }

    function test_Validate_ReapprovalRestoresSponsorshipWithoutResettingAttempts() public {
        uint256 id = _create();
        _validate(_goodOp(id), 1);
        pm.setSponsoredProtocol(protocol, false);
        pm.setSponsoredProtocol(protocol, true);
        _validate(_goodOp(id), 1);
        _validate(_goodOp(id), 1);
        assertEq(pm.sponsoredAttempts(id), 3);
        _expectValidateRevert(_goodOp(id), 1, USDCPaymaster.AttemptsExhausted.selector);
    }

    function test_Validate_RevokingOneProtocolDoesNotBlockAnother() public {
        uint256 a = _create();
        uint256 b = _createFor(newProtocol);
        pm.setSponsoredProtocol(newProtocol, true);
        pm.setSponsoredProtocol(protocol, false);
        _expectValidateRevert(_goodOp(a), 1, USDCPaymaster.ProtocolNotApproved.selector);
        vm.prank(entryPoint);
        pm.validatePaymasterUserOp(_opFor(newProtocol, b), bytes32(0), 1);
        assertEq(pm.sponsoredAttempts(b), 1);
    }

    function test_Validate_BountyRotationByUnapprovedAccountIsNotSponsored() public {
        // an unapproved account creating many fresh tiny bounties never gains sponsorship
        for (uint256 i; i < 5; i++) {
            uint256 id = _createFor(newProtocol);
            _expectValidateRevert(_opFor(newProtocol, id), 1, USDCPaymaster.ProtocolNotApproved.selector);
            assertEq(pm.sponsoredAttempts(id), 0);
        }
    }

    function test_Validate_OnlyEntryPointStillCheckedFirst() public {
        uint256 id = _createFor(newProtocol);
        PackedUserOperation memory op = _opFor(newProtocol, id);
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyEntryPoint.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
    }
}
