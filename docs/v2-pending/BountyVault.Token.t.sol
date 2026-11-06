// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BountyVault} from "../BountyVault.sol";
import {MockFalseToken} from "../test-helpers/MockFalseToken.sol";

/// @dev ERC-20 that returns no data at all (USDT style).
contract NoReturnToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external {
        balanceOf[to] += a;
    }

    function approve(address s, uint256 a) external {
        allowance[msg.sender][s] = a;
    }

    function transfer(address to, uint256 a) external {
        balanceOf[msg.sender] -= a;
        balanceOf[to] += a;
    }

    function transferFrom(address f, address to, uint256 a) external {
        allowance[f][msg.sender] -= a;
        balanceOf[f] -= a;
        balanceOf[to] += a;
    }
}

/// @dev ERC-20 whose transfers return a malformed (short) payload.
contract ShortReturnToken {
    fallback() external {
        assembly {
            mstore(0, 1)
            return(0, 1)
        }
    }
}

/// @dev A token returning `false` must surface TransferFailed and roll back all state.
contract BountyVaultTokenTest is Test {
    MockFalseToken internal tok;
    BountyVault internal vault;

    address internal arbitrator = makeAddr("arbitrator");
    address internal paymaster = makeAddr("paymaster");
    address internal payer = makeAddr("payer");
    address internal payee = makeAddr("payee");
    address internal stranger = makeAddr("stranger");

    uint128 internal constant AMT = 1_000e6;
    uint64 internal t0;

    function setUp() public {
        vm.warp(1_700_000_000);
        t0 = uint64(block.timestamp);
        tok = new MockFalseToken();
        vault = new BountyVault(address(tok), paymaster, arbitrator);
        tok.mint(payer, 10 * uint256(AMT));
        vm.prank(payer);
        tok.approve(address(vault), type(uint256).max);
    }

    function _mk(uint64 deadline) internal returns (uint256 id) {
        vm.prank(payer);
        id = vault.createBounty(payee, AMT, deadline, bytes32(0));
    }

    function _status(uint256 id) internal view returns (BountyVault.Status s) {
        (,,, s) = vault.getDeal(id);
    }

    function test_Create_ReturnsFalseRevertsTransferFailedAndRollsBack() public {
        tok.setFailing(true);
        vm.prank(payer);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.createBounty(payee, AMT, 0, bytes32(0));
        assertEq(vault.nextDealId(), 0);
        (address p,,, BountyVault.Status s) = vault.getDeal(0);
        assertEq(p, address(0));
        assertEq(uint8(s), uint8(BountyVault.Status.None));
        assertEq(tok.balanceOf(payer), 10 * uint256(AMT));
    }

    function test_CreateOpenTask_ReturnsFalseRevertsTransferFailedAndRollsBack() public {
        tok.setFailing(true);
        vm.prank(payer);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.createOpenTask(AMT, t0 + 1 days, bytes32(0));
        assertEq(vault.nextDealId(), 0);
    }

    function test_Release_ReturnsFalseRollsBackToOpenThenRetrySucceeds() public {
        uint256 id = _mk(0);
        tok.setFailing(true);
        vm.prank(payer);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.release(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
        assertEq(tok.balanceOf(address(vault)), AMT);

        tok.setFailing(false);
        vm.prank(payer);
        vault.release(id);
        assertEq(tok.balanceOf(payee), AMT);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
    }

    function test_Resolve_ReturnsFalseRollsBackToDisputed() public {
        uint256 id = _mk(0);
        vm.prank(payee);
        vault.dispute(id);
        tok.setFailing(true);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.resolveDispute(id, true);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Disputed));
        assertEq(tok.balanceOf(address(vault)), AMT);

        tok.setFailing(false);
        vm.prank(arbitrator);
        vault.resolveDispute(id, true);
        assertEq(tok.balanceOf(payee), AMT);
    }

    function test_Refund_ReturnsFalseRollsBackToOpen() public {
        uint256 id = _mk(t0 + 1 days);
        vm.warp(t0 + 1 days + 1);
        tok.setFailing(true);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.refundExpired(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));

        tok.setFailing(false);
        vm.prank(stranger);
        vault.refundExpired(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.ResolvedToPayer));
        assertEq(tok.balanceOf(payer), 10 * uint256(AMT));
    }

    function test_Cancel_ReturnsFalseRollsBackToOpen() public {
        uint256 id = _mk(0);
        tok.setFailing(true);
        vm.prank(payer);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        vault.cancel(id);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Open));
        assertEq(tok.balanceOf(address(vault)), AMT);
    }

    function test_NoReturnToken_IsAccepted() public {
        NoReturnToken nr = new NoReturnToken();
        BountyVault v = new BountyVault(address(nr), paymaster, arbitrator);
        nr.mint(payer, AMT);
        vm.startPrank(payer);
        nr.approve(address(v), AMT);
        uint256 id = v.createBounty(payee, AMT, 0, bytes32(0));
        v.release(id);
        vm.stopPrank();
        assertEq(nr.balanceOf(payee), AMT);
        assertEq(nr.balanceOf(address(v)), 0);
    }

    function test_MalformedShortReturn_RevertsTransferFailed() public {
        ShortReturnToken sr = new ShortReturnToken();
        BountyVault v = new BountyVault(address(sr), paymaster, arbitrator);
        vm.prank(payer);
        vm.expectRevert(BountyVault.TransferFailed.selector);
        v.createBounty(payee, AMT, 0, bytes32(0));
        assertEq(v.nextDealId(), 0);
    }
}
