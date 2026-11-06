// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {USDCPaymasterTestBase} from "./USDCPaymaster.Base.t.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";
import {BountyVault} from "../BountyVault.sol";
import {PackedUserOperation, PostOpMode} from "../interfaces/IPaymaster.sol";

contract USDCPaymasterValidateTest is USDCPaymasterTestBase {
    function _expectValidateRevert(PackedUserOperation memory op, uint256 maxCost, bytes memory err) internal {
        vm.prank(entryPoint);
        if (err.length == 0) vm.expectRevert();
        else vm.expectRevert(err);
        pm.validatePaymasterUserOp(op, bytes32(0), maxCost);
    }

    // ───────── constructor ─────────

    function test_Constructor_SetsState() public view {
        assertEq(pm.entryPoint(), entryPoint);
        assertEq(pm.vault(), address(vault));
        assertEq(address(pm.usdc()), address(usdc));
        assertEq(pm.owner(), address(this));
        assertEq(pm.maxSponsoredCost(), 5e16);
        assertEq(pm.MAX_SPONSORED_ATTEMPTS_PER_BOUNTY(), 3);
    }

    function test_Constructor_RevertsOnZeroAddresses() public {
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        new USDCPaymaster(address(0), address(vault), address(usdc));
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        new USDCPaymaster(entryPoint, address(0), address(usdc));
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        new USDCPaymaster(entryPoint, address(vault), address(0));
    }

    // ───────── validation: happy path ─────────

    function test_Validate_AcceptsReleaseOfOwnOpenBounty() public {
        uint256 id = _create();
        (bytes memory ctx, uint256 vd) = _validate(_goodOp(id), 1);
        assertEq(vd, 0);
        (uint256 cid, address cwh) = abi.decode(ctx, (uint256, address));
        assertEq(cid, id);
        assertEq(cwh, whitehat);
        assertEq(pm.sponsoredAttempts(id), 1);
    }

    function test_Validate_AcceptsMaxCostEqualToCap() public {
        uint256 id = _create();
        _validate(_goodOp(id), pm.maxSponsoredCost());
    }

    function test_Validate_ThenProtocolReleaseIsFreeAndPaysWhitehatInFull() public {
        uint256 id = _create();
        _validate(_goodOp(id), 1);
        // smart-account execute() calls the vault AS the protocol account => zero-fee branch
        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        assertEq(usdc.balanceOf(whitehat), AMT);
        assertEq(usdc.balanceOf(address(pm)), 0);
    }

    // ───────── validation: reverts ─────────

    function test_Validate_OnlyEntryPoint() public {
        uint256 id = _create();
        PackedUserOperation memory op = _goodOp(id);
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyEntryPoint.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
        // even the owner is not the entry point
        vm.expectRevert(USDCPaymaster.OnlyEntryPoint.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
    }

    function test_Validate_RejectsWrongOuterSelector() public {
        uint256 id = _create();
        bytes memory cd = abi.encodeWithSelector(
            bytes4(keccak256("executeBatch(address[],uint256[],bytes[])")), new address[](0), new uint256[](0), new bytes[](0)
        );
        _expectValidateRevert(_op(protocol, cd), 1, abi.encodeWithSelector(USDCPaymaster.InvalidCallData.selector));
        // the bare inner call (no execute wrapper) is also rejected
        _expectValidateRevert(
            _op(protocol, _inner(id, 0, whitehat)), 1, abi.encodeWithSelector(USDCPaymaster.InvalidCallData.selector)
        );
    }

    function test_Validate_RevertsOnCallDataShorterThanSelector() public {
        _expectValidateRevert(_op(protocol, hex"b61d"), 1, "");
        _expectValidateRevert(_op(protocol, ""), 1, "");
    }

    function test_Validate_RejectsWrongTarget() public {
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(address(usdc), 0, _inner(id, 0, whitehat)));
        _expectValidateRevert(op, 1, abi.encodeWithSelector(USDCPaymaster.InvalidTarget.selector));
    }

    function test_Validate_RejectsNonZeroOuterValue() public {
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(address(vault), 1, _inner(id, 0, whitehat)));
        _expectValidateRevert(op, 1, abi.encodeWithSelector(USDCPaymaster.NonZeroValue.selector));
    }

    function test_Validate_RejectsInnerCallDataTooShort() public {
        PackedUserOperation memory op = _op(protocol, _exec(address(vault), 0, hex"aabbcc"));
        _expectValidateRevert(op, 1, abi.encodeWithSelector(USDCPaymaster.InvalidCallData.selector));
        op = _op(protocol, _exec(address(vault), 0, ""));
        _expectValidateRevert(op, 1, abi.encodeWithSelector(USDCPaymaster.InvalidCallData.selector));
    }

    function test_Validate_RejectsNonReleaseSelectors() public {
        uint256 id = _create();
        bytes[4] memory inners = [
            abi.encodeWithSelector(BountyVault.disputeBounty.selector, id),
            abi.encodeWithSelector(BountyVault.resolveDispute.selector, id, true),
            abi.encodeWithSelector(BountyVault.createBounty.selector, whitehat, AMT),
            abi.encodeWithSelector(bytes4(keccak256("releaseBounty(uint256)")), id)
        ];
        for (uint256 i; i < inners.length; i++) {
            _expectValidateRevert(
                _op(protocol, _exec(address(vault), 0, inners[i])),
                1,
                abi.encodeWithSelector(USDCPaymaster.InvalidCallData.selector)
            );
        }
    }

    function test_Validate_RevertsOnTruncatedReleaseArgs() public {
        bytes memory inner = abi.encodePacked(RELEASE, uint256(0)); // missing fee + whitehat
        _expectValidateRevert(_op(protocol, _exec(address(vault), 0, inner)), 1, "");
    }

    function test_Validate_RejectsNonZeroFee() public {
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(address(vault), 0, _inner(id, 1, whitehat)));
        _expectValidateRevert(op, 1, abi.encodeWithSelector(USDCPaymaster.InvalidFee.selector));
    }

    function test_Validate_RejectsSenderThatIsNotBountyProtocol() public {
        uint256 id = _create();
        for (uint256 i; i < 3; i++) {
            address s = i == 0 ? stranger : i == 1 ? whitehat : arbitrator;
            // approved by the owner, but still not the bounty's protocol
            pm.setSponsoredProtocol(s, true);
            _expectValidateRevert(
                _op(s, _exec(address(vault), 0, _inner(id, 0, whitehat))),
                1,
                abi.encodeWithSelector(USDCPaymaster.IneligibleBounty.selector)
            );
        }
    }

    function test_Validate_RejectsWhitehatMismatch() public {
        uint256 id = _create();
        PackedUserOperation memory op = _op(protocol, _exec(address(vault), 0, _inner(id, 0, stranger)));
        _expectValidateRevert(op, 1, abi.encodeWithSelector(USDCPaymaster.IneligibleBounty.selector));
    }

    function test_Validate_RejectsNonexistentDeal() public {
        _expectValidateRevert(_goodOp(99), 1, abi.encodeWithSelector(USDCPaymaster.IneligibleBounty.selector));
    }

    function test_Validate_RejectsDisputedDeal() public {
        uint256 id = _create();
        vm.prank(whitehat);
        vault.disputeBounty(id);
        _expectValidateRevert(_goodOp(id), 1, abi.encodeWithSelector(USDCPaymaster.IneligibleBounty.selector));
    }

    function test_Validate_RejectsReleasedDeal() public {
        uint256 id = _create();
        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        _expectValidateRevert(_goodOp(id), 1, abi.encodeWithSelector(USDCPaymaster.IneligibleBounty.selector));
    }

    function test_Validate_RejectsResolvedDeal() public {
        uint256 id = _create();
        vm.prank(whitehat);
        vault.disputeBounty(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, true);
        _expectValidateRevert(_goodOp(id), 1, abi.encodeWithSelector(USDCPaymaster.IneligibleBounty.selector));
    }

    function test_Validate_RejectsMaxCostAboveCap() public {
        uint256 id = _create();
        uint256 cap = pm.maxSponsoredCost();
        _expectValidateRevert(_goodOp(id), cap + 1, abi.encodeWithSelector(USDCPaymaster.MaxCostExceeded.selector));
        assertEq(pm.sponsoredAttempts(id), 0);
    }

    function test_Validate_AttemptsCapIsThree() public {
        uint256 id = _create();
        _validate(_goodOp(id), 1);
        _validate(_goodOp(id), 1);
        _validate(_goodOp(id), 1);
        assertEq(pm.sponsoredAttempts(id), 3);
        _expectValidateRevert(_goodOp(id), 1, abi.encodeWithSelector(USDCPaymaster.AttemptsExhausted.selector));
        assertEq(pm.sponsoredAttempts(id), 3);
    }

    function test_Validate_AttemptsTrackedPerBounty() public {
        uint256 a = _create();
        uint256 b = _create();
        for (uint256 i; i < 3; i++) _validate(_goodOp(a), 1);
        _validate(_goodOp(b), 1); // b unaffected by a's exhaustion
        assertEq(pm.sponsoredAttempts(a), 3);
        assertEq(pm.sponsoredAttempts(b), 1);
    }

    function test_Validate_LoweredCapAppliesImmediately() public {
        uint256 id = _create();
        pm.setMaxSponsoredCost(10);
        _validate(_goodOp(id), 10);
        _expectValidateRevert(_goodOp(id), 11, abi.encodeWithSelector(USDCPaymaster.MaxCostExceeded.selector));
    }

    // ───────── postOp ─────────

    function test_PostOp_OnlyEntryPoint() public {
        bytes memory ctx = abi.encode(uint256(0), whitehat);
        vm.prank(stranger);
        vm.expectRevert(USDCPaymaster.OnlyEntryPoint.selector);
        pm.postOp(PostOpMode.opSucceeded, ctx, 0, 0);
    }

    function test_PostOp_EmitsGasSponsoredOnSuccess() public {
        bytes memory ctx = abi.encode(uint256(5), whitehat);
        vm.expectEmit(true, true, false, false, address(pm));
        emit USDCPaymaster.GasSponsored(whitehat, 5);
        vm.prank(entryPoint);
        pm.postOp(PostOpMode.opSucceeded, ctx, 1, 1);
    }

    function test_PostOp_EmitsGasSponsoredOnPostOpReverted() public {
        bytes memory ctx = abi.encode(uint256(5), whitehat);
        vm.expectEmit(true, true, false, false, address(pm));
        emit USDCPaymaster.GasSponsored(whitehat, 5);
        vm.prank(entryPoint);
        pm.postOp(PostOpMode.postOpReverted, ctx, 1, 1);
    }

    function test_PostOp_NoEventWhenOpReverted() public {
        bytes memory ctx = abi.encode(uint256(5), whitehat);
        vm.recordLogs();
        vm.prank(entryPoint);
        pm.postOp(PostOpMode.opReverted, ctx, 1, 1);
        assertEq(vm.getRecordedLogs().length, 0);
    }
}
