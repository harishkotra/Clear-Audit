// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BountyVault} from "../BountyVault.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";
import {PackedUserOperation} from "../interfaces/IPaymaster.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockEntryPoint} from "../test-helpers/MockEntryPoint.sol";

/// @dev Shared fixtures. The vault's `paymaster` is the real USDCPaymaster
///      (address pre-computed via CREATE nonce), so the fee path is end-to-end.
abstract contract USDCPaymasterTestBase is Test {
    MockUSDC internal usdc;
    MockEntryPoint internal ep;
    BountyVault internal vault;
    USDCPaymaster internal pm;

    address internal arbitrator = makeAddr("arbitrator");
    address internal protocol = makeAddr("protocol");
    address internal whitehat = makeAddr("whitehat");
    address internal stranger = makeAddr("stranger");
    address internal entryPoint;

    uint256 internal constant AMT = 1_000e6;
    bytes4 internal constant EXECUTE = bytes4(keccak256("execute(address,uint256,bytes)"));
    bytes4 internal constant RELEASE = bytes4(keccak256("releaseBounty(uint256,uint256,address)"));

    function setUp() public virtual {
        usdc = new MockUSDC();
        ep = new MockEntryPoint();
        entryPoint = address(ep);

        address predictedPm = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        vault = new BountyVault(address(usdc), predictedPm, arbitrator);
        pm = new USDCPaymaster(entryPoint, address(vault), address(usdc));
        assertEq(address(pm), predictedPm);

        usdc.mint(protocol, 1_000_000e6);
        vm.prank(protocol);
        usdc.approve(address(vault), type(uint256).max);

        // Test contract is the paymaster owner; admit the protocol account.
        pm.setSponsoredProtocol(protocol, true);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(protocol);
        id = vault.createBounty(whitehat, AMT);
    }

    function _inner(uint256 id, uint256 fee, address wh) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(RELEASE, id, fee, wh);
    }

    function _exec(address dest, uint256 value, bytes memory inner) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(EXECUTE, dest, value, inner);
    }

    function _op(address sender, bytes memory callData) internal pure returns (PackedUserOperation memory op) {
        op.sender = sender;
        op.callData = callData;
    }

    function _goodOp(uint256 id) internal view returns (PackedUserOperation memory) {
        return _op(protocol, _exec(address(vault), 0, _inner(id, 0, whitehat)));
    }

    function _validate(PackedUserOperation memory op, uint256 maxCost)
        internal
        returns (bytes memory ctx, uint256 vd)
    {
        vm.prank(entryPoint);
        return pm.validatePaymasterUserOp(op, bytes32(0), maxCost);
    }
}
