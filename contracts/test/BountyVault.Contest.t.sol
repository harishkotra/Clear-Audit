// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

contract BountyVaultContestTest is BountyVaultTestBase {
    address internal w1;
    address internal w2;

    function setUp() public override {
        super.setUp();
        w1 = makeAddr("winner1");
        w2 = makeAddr("winner2");
    }

    function test_CreateContest_RecordsContestModeNoPayee() public {
        uint256 id = _contest(t0 + DAY);
        (address p, address w,, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, payer);
        assertEq(w, address(0));
        assertEq(uint8(s), uint8(BountyVault.Status.Open));
        (,,,,,,,,,,, bool contest) = vault.deals(id);
        assertTrue(contest);
        assertEq(_vaultBal(), AMT);
    }

    function test_EnterContest_SelfAndSponsor() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vault.enterContest(id);
        vm.prank(payer);
        vault.registerEntrant(id, w2);
        assertTrue(vault.contestEntered(id, w1));
        assertTrue(vault.contestEntered(id, w2));
        assertEq(vault.contestEntrants(id), 2);
    }

    function test_EnterContest_RevertsForPayerOrArbitrator() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(payer);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.enterContest(id);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.RoleConflict.selector);
        vault.enterContest(id);
    }

    function test_EnterContest_RevertsTwice() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vault.enterContest(id);
        vm.prank(w1);
        vm.expectRevert(BountyVault.AlreadyEntered.selector);
        vault.enterContest(id);
    }

    function test_ClaimAndAssign_RevertOnContest() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vm.expectRevert(BountyVault.NotContest.selector);
        vault.claimTask(id);
        vm.prank(payer);
        vm.expectRevert(BountyVault.NotContest.selector);
        vault.assignPayee(id, w1);
    }

    function test_Release_RevertsOnContest() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(payer);
        vault.registerEntrant(id, w1);
        _commit(id);
        vm.prank(payer);
        vm.expectRevert(BountyVault.NotContest.selector);
        vault.release(id);
    }

    function test_Award_SplitsEscrowToEntrants() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vault.enterContest(id);
        vm.prank(payer);
        vault.registerEntrant(id, w2);
        _commit(id);

        address[] memory winners = new address[](2);
        winners[0] = w1;
        winners[1] = w2;
        uint128[] memory amounts = new uint128[](2);
        amounts[0] = uint128(AMT * 2 / 3);
        amounts[1] = uint128(AMT - amounts[0]);

        vm.prank(arbitrator);
        vault.award(id, winners, amounts);

        assertEq(usdc.balanceOf(w1), amounts[0]);
        assertEq(usdc.balanceOf(w2), amounts[1]);
        assertEq(_vaultBal(), 0);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
        assertFalse(vault.canSettle(id));
    }

    function test_Award_RevertsIfAmountsDoNotSum() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vault.enterContest(id);
        _commit(id);
        address[] memory winners = new address[](1);
        winners[0] = w1;
        uint128[] memory amounts = new uint128[](1);
        amounts[0] = uint128(AMT - 1);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.AmountMismatch.selector);
        vault.award(id, winners, amounts);
    }

    function test_Award_RevertsIfNotEntered() public {
        uint256 id = _contest(t0 + DAY);
        _commit(id);
        address[] memory winners = new address[](1);
        winners[0] = w1;
        uint128[] memory amounts = new uint128[](1);
        amounts[0] = uint128(AMT);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.NotClaimable.selector);
        vault.award(id, winners, amounts);
    }

    function test_Award_RevertsWithoutEvidence() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vault.enterContest(id);
        address[] memory winners = new address[](1);
        winners[0] = w1;
        uint128[] memory amounts = new uint128[](1);
        amounts[0] = uint128(AMT);
        vm.prank(arbitrator);
        vm.expectRevert(BountyVault.EvidenceMissing.selector);
        vault.award(id, winners, amounts);
    }

    function test_Award_OnlyArbitrator() public {
        uint256 id = _contest(t0 + DAY);
        vm.prank(w1);
        vault.enterContest(id);
        _commit(id);
        address[] memory winners = new address[](1);
        winners[0] = w1;
        uint128[] memory amounts = new uint128[](1);
        amounts[0] = uint128(AMT);
        vm.prank(payer);
        vm.expectRevert(BountyVault.OnlyArbitrator.selector);
        vault.award(id, winners, amounts);
    }

    function test_CommitEvidence_AllowedOnContestWithoutPayee() public {
        uint256 id = _contest(t0 + DAY);
        _commit(id);
        assertTrue(vault.canSettle(id));
    }
}
