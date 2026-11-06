// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {USDCPaymasterTestBase} from "./USDCPaymaster.Base.t.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";
import {PackedUserOperation} from "../interfaces/IPaymaster.sol";
import {Test} from "forge-std/Test.sol";

/// @dev Hammers validatePaymasterUserOp (as the EntryPoint) on a few bounties.
contract PaymasterHandler is Test {
    USDCPaymaster public pm;
    address public entryPoint;
    address public vault;
    address public protocol;
    address public whitehat;
    uint256 public ids;
    uint256 public admitted; // count of successful validations (ghost)

    constructor(USDCPaymaster _pm, address _protocol, address _whitehat, uint256 _ids) {
        pm = _pm;
        entryPoint = _pm.entryPoint();
        vault = _pm.vault();
        protocol = _protocol;
        whitehat = _whitehat;
        ids = _ids;
    }

    function validate(uint256 idSeed, uint256 maxCost) external {
        uint256 id = idSeed % ids;
        PackedUserOperation memory op;
        op.sender = protocol;
        op.callData = abi.encodeWithSelector(
            bytes4(keccak256("execute(address,uint256,bytes)")),
            vault,
            uint256(0),
            abi.encodeWithSelector(bytes4(keccak256("releaseBounty(uint256,uint256,address)")), id, uint256(0), whitehat)
        );
        maxCost = bound(maxCost, 0, pm.maxSponsoredCost());
        vm.prank(entryPoint);
        try pm.validatePaymasterUserOp(op, bytes32(0), maxCost) {
            admitted++;
        } catch {}
    }
}

contract USDCPaymasterInvariantTest is USDCPaymasterTestBase {
    PaymasterHandler internal handler;
    uint256 internal constant N = 3;

    function setUp() public override {
        super.setUp();
        for (uint256 i; i < N; i++) _create();
        handler = new PaymasterHandler(pm, protocol, whitehat, N);
        targetContract(address(handler));
    }

    /// no bounty ever accrues more than 3 admitted sponsorship attempts
    function invariant_AttemptsNeverExceedCap() public view {
        uint256 total;
        for (uint256 i; i < N; i++) {
            uint256 a = pm.sponsoredAttempts(i);
            assertLe(a, pm.MAX_SPONSORED_ATTEMPTS_PER_BOUNTY());
            total += a;
        }
        assertEq(total, handler.admitted());
    }
}
