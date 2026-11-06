// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BountyVaultTestBase} from "./BountyVault.Base.t.sol";
import {BountyVault} from "../BountyVault.sol";

contract BountyVaultEvidenceTest is BountyVaultTestBase {
    function test_Release_RevertsWithoutEvidence() public {
        uint256 id = _bounty();
        vm.prank(payer);
        vm.expectRevert(BountyVault.EvidenceMissing.selector);
        vault.release(id);
        assertEq(_vaultBal(), AMT);
    }

    function test_CommitThenRelease_PaysPayee() public {
        uint256 id = _bounty();
        _commit(id);
        assertTrue(vault.canSettle(id));
        vm.prank(payer);
        vault.release(id);
        assertEq(usdc.balanceOf(payee), AMT);
        assertFalse(vault.canSettle(id));
    }

    function test_Commit_RevertsTwice() public {
        uint256 id = _bounty();
        _commit(id);
        vm.prank(payer);
        vm.expectRevert(BountyVault.AlreadyCommitted.selector);
        vault.commitEvidence(id, keccak256("other"), uint64(block.timestamp + 30 days));
    }

    function test_Commit_RevertsIfExpired() public {
        uint256 id = _bounty();
        vm.prank(payer);
        vm.expectRevert(BountyVault.EvidenceExpired.selector);
        vault.commitEvidence(id, EV, uint64(block.timestamp));
    }

    function test_Release_RevertsAfterEvidenceExpiry() public {
        uint256 id = _bounty();
        vm.prank(payer);
        vault.commitEvidence(id, EV, uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 1 hours);
        vm.prank(payer);
        vm.expectRevert(BountyVault.EvidenceExpired.selector);
        vault.release(id);
    }

    function test_SettleAfterChallenge_PaysAnyoneCanCall() public {
        uint256 id = _bounty();
        _commit(id);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.ChallengePending.selector);
        vault.settleAfterChallenge(id);

        vm.warp(block.timestamp + WINDOW);
        vm.prank(stranger);
        vault.settleAfterChallenge(id);
        assertEq(usdc.balanceOf(payee), AMT);
        assertEq(uint8(_status(id)), uint8(BountyVault.Status.Released));
    }

    function test_SettleAfterChallenge_RevertsIfDisputed() public {
        uint256 id = _bounty();
        _commit(id);
        _dispute(id, payee);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(stranger);
        vm.expectRevert(BountyVault.BountyNotOpen.selector);
        vault.settleAfterChallenge(id);
    }

    function test_CanSettle_FalseUntilCommit() public {
        uint256 id = _bounty();
        assertFalse(vault.canSettle(id));
        _commit(id);
        assertTrue(vault.canSettle(id));
    }
}
