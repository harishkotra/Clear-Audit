// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ClearAuditDeployer} from "../ClearAuditDeployer.sol";
import {BountyVault} from "../BountyVault.sol";
import {USDCPaymaster} from "../USDCPaymaster.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {MockEntryPoint} from "../test-helpers/MockEntryPoint.sol";
import {MockFalseToken} from "../test-helpers/MockFalseToken.sol";

contract ClearAuditDeployerTest is Test {
    event Deployed(
        address indexed vault,
        address indexed paymaster,
        address indexed arbitrator,
        address admin,
        address token,
        address entryPoint
    );

    ClearAuditDeployer internal d;
    BountyVault internal vault;
    USDCPaymaster internal pm;
    MockUSDC internal usdc;
    MockEntryPoint internal ep;

    address internal admin = makeAddr("admin");
    address internal arbitrator = makeAddr("arbitrator");
    address internal protocol = makeAddr("protocol");
    address internal whitehat = makeAddr("whitehat");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        usdc = new MockUSDC();
        ep = new MockEntryPoint();
        d = new ClearAuditDeployer(address(usdc), address(ep), arbitrator, admin);
        vault = d.vault();
        pm = d.paymaster();
    }

    // ───────────────────────── constructor ─────────────────────────

    function test_ConstructorWiring() public view {
        assertEq(d.admin(), admin);
        assertEq(address(vault.token()), address(usdc));
        assertEq(vault.paymaster(), address(pm));
        assertEq(vault.arbitrator(), arbitrator);
        assertEq(pm.entryPoint(), address(ep));
        assertEq(pm.vault(), address(vault));
        assertEq(address(pm.usdc()), address(usdc));
        assertEq(pm.owner(), address(d), "relayer owns paymaster");
    }

    function test_AddressesNonZeroAndHaveCode() public view {
        assertTrue(address(vault) != address(0));
        assertTrue(address(pm) != address(0));
        assertGt(address(vault).code.length, 0);
        assertGt(address(pm).code.length, 0);
    }

    function test_AddressesMatchCreatePredictions() public view {
        assertEq(address(vault), vm.computeCreateAddress(address(d), 1));
        assertEq(address(pm), vm.computeCreateAddress(address(d), 2));
    }

    function test_EmitsDeployed() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        address pVault = vm.computeCreateAddress(predicted, 1);
        address pPm = vm.computeCreateAddress(predicted, 2);
        vm.expectEmit(true, true, true, true, predicted);
        emit Deployed(pVault, pPm, arbitrator, admin, address(usdc), address(ep));
        ClearAuditDeployer d2 = new ClearAuditDeployer(address(usdc), address(ep), arbitrator, admin);
        assertEq(address(d2), predicted);
    }

    function test_RevertWhen_TokenZero() public {
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        new ClearAuditDeployer(address(0), address(ep), arbitrator, admin);
    }

    function test_RevertWhen_EntryPointZero() public {
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        new ClearAuditDeployer(address(usdc), address(0), arbitrator, admin);
    }

    function test_RevertWhen_ArbitratorZero() public {
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        new ClearAuditDeployer(address(usdc), address(ep), address(0), admin);
    }

    function test_RevertWhen_AdminZero() public {
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        new ClearAuditDeployer(address(usdc), address(ep), arbitrator, address(0));
    }

    // ───────────────────────── callPaymaster ─────────────────────────

    function test_CallPaymaster_SetsSponsoredProtocol() public {
        assertFalse(pm.sponsoredProtocols(protocol));
        vm.prank(admin);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.setSponsoredProtocol, (protocol, true)));
        assertTrue(pm.sponsoredProtocols(protocol));

        vm.prank(admin);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.setSponsoredProtocol, (protocol, false)));
        assertFalse(pm.sponsoredProtocols(protocol));
    }

    function test_CallPaymaster_SetMaxCostAndEvent() public {
        vm.expectEmit(true, true, true, true, address(pm));
        emit USDCPaymaster.MaxSponsoredCostUpdated(5e16, 123);
        vm.prank(admin);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.setMaxSponsoredCost, (123)));
        assertEq(pm.maxSponsoredCost(), 123);
    }

    function test_CallPaymaster_ReturnsPaymasterReturnData() public {
        vm.prank(admin);
        bytes memory ret = d.callPaymaster(abi.encodeWithSignature("maxSponsoredCost()"));
        assertEq(abi.decode(ret, (uint256)), 5e16);
    }

    function test_CallPaymaster_RevertWhen_NotAdmin() public {
        vm.prank(stranger);
        vm.expectRevert(ClearAuditDeployer.OnlyAdmin.selector);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.setSponsoredProtocol, (protocol, true)));
        assertFalse(pm.sponsoredProtocols(protocol));
    }

    function test_CallPaymaster_RelayerItselfNotAdmin() public {
        // The paymaster owner (relayer) address is not the admin; direct EOA
        // control of the paymaster is impossible, only via the adapter.
        vm.prank(admin);
        vm.expectRevert(USDCPaymaster.OnlyOwner.selector);
        pm.setSponsoredProtocol(protocol, true);
    }

    function test_CallPaymaster_ForwardsValueToEntryPoint() public {
        vm.deal(admin, 3 ether);
        vm.prank(admin);
        d.callPaymaster{value: 2 ether}(abi.encodeCall(USDCPaymaster.depositToEntryPoint, ()));
        assertEq(ep.deposits(address(pm)), 2 ether);
        assertEq(address(ep).balance, 2 ether);
        assertEq(admin.balance, 1 ether);
        assertEq(address(d).balance, 0, "relayer retains nothing");
    }

    function test_CallPaymaster_WithdrawFromEntryPoint() public {
        vm.deal(admin, 1 ether);
        vm.startPrank(admin);
        d.callPaymaster{value: 1 ether}(abi.encodeCall(USDCPaymaster.depositToEntryPoint, ()));
        d.callPaymaster(abi.encodeCall(USDCPaymaster.withdrawFromEntryPoint, (payable(stranger), 0.4 ether)));
        vm.stopPrank();
        assertEq(stranger.balance, 0.4 ether);
        assertEq(ep.deposits(address(pm)), 0.6 ether);
    }

    function test_CallPaymaster_BubblesCustomError() public {
        ep.setFailDeposit(true);
        vm.deal(admin, 1 ether);
        vm.prank(admin);
        vm.expectRevert(USDCPaymaster.EntryPointDepositFailed.selector);
        d.callPaymaster{value: 1 ether}(abi.encodeCall(USDCPaymaster.depositToEntryPoint, ()));
        assertEq(admin.balance, 1 ether, "value refunded on revert");
    }

    function test_CallPaymaster_BubblesZeroAddressError() public {
        vm.prank(admin);
        vm.expectRevert(USDCPaymaster.ZeroAddress.selector);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.setSponsoredProtocol, (address(0), true)));
    }

    function test_CallPaymaster_EmptyRevertDataGivesCallFailed() public {
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.CallFailed.selector);
        d.callPaymaster(hex"deadbeef"); // unknown selector, no fallback => empty revert
    }

    function test_CallPaymaster_EmptyDataSendsValueViaReceive() public {
        vm.deal(admin, 1 ether);
        vm.prank(admin);
        d.callPaymaster{value: 1 ether}("");
        assertEq(address(pm).balance, 1 ether);
    }

    function test_Receive_AcceptsNative() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(d).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(d).balance, 1 ether);
    }

    function testFuzz_CallPaymaster_OnlyAdmin(address caller, bytes calldata data, uint96 value) public {
        vm.assume(caller != admin);
        vm.deal(caller, value);
        vm.prank(caller);
        vm.expectRevert(ClearAuditDeployer.OnlyAdmin.selector);
        d.callPaymaster{value: value}(data);
        assertEq(address(pm).balance, 0);
        assertEq(address(d).balance, 0);
    }

    function testFuzz_SweepToken_OnlyAdmin(address caller, address to, uint256 amount) public {
        vm.assume(caller != admin);
        vm.prank(caller);
        vm.expectRevert(ClearAuditDeployer.OnlyAdmin.selector);
        d.sweepToken(address(usdc), to, amount);
    }

    // ───────────────────────── sweepToken ─────────────────────────

    function test_SweepToken_FeesFromPaymasterGoToRelayerThenAdmin() public {
        usdc.mint(address(pm), 500e6);

        vm.startPrank(admin);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.withdrawFees, ()));
        vm.stopPrank();
        assertEq(usdc.balanceOf(address(pm)), 0);
        assertEq(usdc.balanceOf(address(d)), 500e6, "fees land on relayer");
        assertEq(usdc.balanceOf(admin), 0);

        vm.prank(admin);
        d.sweepToken(address(usdc), admin, 500e6);
        assertEq(usdc.balanceOf(address(d)), 0);
        assertEq(usdc.balanceOf(admin), 500e6);
    }

    function test_SweepToken_PartialToThirdParty() public {
        usdc.mint(address(d), 100e6);
        vm.prank(admin);
        d.sweepToken(address(usdc), stranger, 40e6);
        assertEq(usdc.balanceOf(stranger), 40e6);
        assertEq(usdc.balanceOf(address(d)), 60e6);
    }

    function test_SweepToken_RevertWhen_NotAdmin() public {
        usdc.mint(address(d), 100e6);
        vm.prank(stranger);
        vm.expectRevert(ClearAuditDeployer.OnlyAdmin.selector);
        d.sweepToken(address(usdc), stranger, 100e6);
        assertEq(usdc.balanceOf(address(d)), 100e6);
    }

    function test_SweepToken_RevertWhen_ZeroTo() public {
        usdc.mint(address(d), 100e6);
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        d.sweepToken(address(usdc), address(0), 100e6);
    }

    function test_SweepToken_RevertWhen_TokenReturnsFalse() public {
        MockFalseToken ft = new MockFalseToken();
        ft.mint(address(d), 100e6);
        ft.setFailing(true);
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.TransferFailed.selector);
        d.sweepToken(address(ft), admin, 100e6);
        assertEq(ft.balanceOf(address(d)), 100e6);
    }

    function test_SweepToken_RevertWhen_InsufficientBalance() public {
        usdc.mint(address(d), 10e6);
        vm.prank(admin);
        vm.expectRevert(bytes("Insufficient balance"));
        d.sweepToken(address(usdc), admin, 11e6);
    }

    // ───────────────────────── burn address ─────────────────────────

    address internal constant BURN = 0x000000000000000000000000000000000000dEaD;

    function test_BurnConstant() public view {
        assertEq(d.BURN(), BURN);
    }

    function test_RevertWhen_ArbitratorIsBurn() public {
        vm.expectRevert(ClearAuditDeployer.BurnAddress.selector);
        new ClearAuditDeployer(address(usdc), address(ep), BURN, admin);
    }

    function test_RevertWhen_AdminIsBurn() public {
        vm.expectRevert(ClearAuditDeployer.BurnAddress.selector);
        new ClearAuditDeployer(address(usdc), address(ep), arbitrator, BURN);
    }

    function test_RevertWhen_ArbitratorAndAdminAreBurn() public {
        vm.expectRevert(ClearAuditDeployer.BurnAddress.selector);
        new ClearAuditDeployer(address(usdc), address(ep), BURN, BURN);
    }

    function test_ZeroAddressTakesPrecedenceOverBurn() public {
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        new ClearAuditDeployer(address(0), address(ep), BURN, BURN);
    }

    function testFuzz_ConstructorAcceptsAnyNonZeroNonBurnRoles(address arb, address adm) public {
        vm.assume(arb != address(0) && arb != BURN && adm != address(0) && adm != BURN);
        ClearAuditDeployer d2 = new ClearAuditDeployer(address(usdc), address(ep), arb, adm);
        assertEq(d2.admin(), adm);
        assertEq(d2.vault().arbitrator(), arb);
    }

    // ───────────────────────── sweepNative ─────────────────────────

    function test_SweepNative_SendsToRecipientAndAccounts() public {
        vm.deal(address(d), 5 ether);
        uint256 before = stranger.balance;
        vm.prank(admin);
        d.sweepNative(payable(stranger), 2 ether);
        assertEq(stranger.balance, before + 2 ether);
        assertEq(address(d).balance, 3 ether);
        assertEq(admin.balance, 0, "admin not paid unless it is the recipient");
    }

    function test_SweepNative_FullBalanceToAdmin() public {
        vm.deal(address(d), 1 ether);
        vm.prank(admin);
        d.sweepNative(payable(admin), 1 ether);
        assertEq(admin.balance, 1 ether);
        assertEq(address(d).balance, 0);
    }

    function test_SweepNative_SubE12Amount() public {
        // Arc native has 18 decimals; ERC-20 view has 6. A remainder below 1e12
        // native units is invisible to ERC-20 but must be recoverable here.
        uint256 dust = 999_999_999_999;
        vm.deal(address(d), dust + 1e12);
        vm.prank(admin);
        d.sweepNative(payable(stranger), dust);
        assertEq(stranger.balance, dust);
        assertEq(address(d).balance, 1e12);

        vm.deal(address(d), 1);
        vm.prank(admin);
        d.sweepNative(payable(stranger), 1);
        assertEq(stranger.balance, dust + 1);
        assertEq(address(d).balance, 0);
    }

    function test_SweepNative_ZeroAmountSucceeds() public {
        vm.deal(address(d), 1 ether);
        vm.prank(admin);
        d.sweepNative(payable(stranger), 0);
        assertEq(stranger.balance, 0);
        assertEq(address(d).balance, 1 ether);
    }

    function test_SweepNative_RevertWhen_NotAdmin() public {
        vm.deal(address(d), 1 ether);
        vm.prank(stranger);
        vm.expectRevert(ClearAuditDeployer.OnlyAdmin.selector);
        d.sweepNative(payable(stranger), 1 ether);
        assertEq(address(d).balance, 1 ether);
        assertEq(stranger.balance, 0);
    }

    function test_SweepNative_RevertWhen_ZeroTo() public {
        vm.deal(address(d), 1 ether);
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.ZeroAddress.selector);
        d.sweepNative(payable(address(0)), 1 ether);
        assertEq(address(d).balance, 1 ether);
    }

    function test_SweepNative_RevertWhen_ReceiverReverts() public {
        NativeRejecter r = new NativeRejecter();
        vm.deal(address(d), 1 ether);
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.NativeTransferFailed.selector);
        d.sweepNative(payable(address(r)), 1 ether);
        assertEq(address(d).balance, 1 ether);
        assertEq(address(r).balance, 0);
    }

    function test_SweepNative_RevertWhen_ReceiverHasNoReceive() public {
        NoReceive r = new NoReceive();
        vm.deal(address(d), 1 ether);
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.NativeTransferFailed.selector);
        d.sweepNative(payable(address(r)), 1);
        assertEq(address(d).balance, 1 ether);
    }

    function test_SweepNative_RevertWhen_InsufficientBalance() public {
        vm.deal(address(d), 1 ether);
        vm.prank(admin);
        vm.expectRevert(ClearAuditDeployer.NativeTransferFailed.selector);
        d.sweepNative(payable(stranger), 1 ether + 1);
        assertEq(address(d).balance, 1 ether);
        assertEq(stranger.balance, 0);
    }

    function test_SweepNative_RecoversNativeSentViaReceive() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(d).call{value: 1 ether}("");
        assertTrue(ok);
        vm.prank(admin);
        d.sweepNative(payable(whitehat), 1 ether);
        assertEq(whitehat.balance, 1 ether);
        assertEq(address(d).balance, 0);
    }

    function testFuzz_SweepNative_Accounting(uint128 funded, uint128 amount) public {
        amount = uint128(bound(amount, 0, funded));
        vm.deal(address(d), funded);
        uint256 before = stranger.balance;
        vm.prank(admin);
        d.sweepNative(payable(stranger), amount);
        assertEq(stranger.balance, before + amount);
        assertEq(address(d).balance, uint256(funded) - amount);
    }

    function testFuzz_SweepNative_OnlyAdmin(address caller, address to, uint256 amount) public {
        vm.assume(caller != admin);
        vm.deal(address(d), 1 ether);
        vm.prank(caller);
        vm.expectRevert(ClearAuditDeployer.OnlyAdmin.selector);
        d.sweepNative(payable(to), amount);
        assertEq(address(d).balance, 1 ether);
    }

    // ───────────────────────── end-to-end bounty flow ─────────────────────────

    function _create(uint256 amount) internal returns (uint256 id) {
        usdc.mint(protocol, amount);
        vm.startPrank(protocol);
        usdc.approve(address(vault), amount);
        id = vault.createBounty(whitehat, amount);
        vm.stopPrank();
    }

    function test_E2E_CreateAndReleaseByProtocol() public {
        uint256 id = _create(1_000e6);
        assertEq(usdc.balanceOf(address(vault)), 1_000e6);
        (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(id);
        assertEq(p, protocol);
        assertEq(w, whitehat);
        assertEq(a, 1_000e6);
        assertEq(uint8(s), uint8(BountyVault.Status.Open));

        vm.prank(protocol);
        vault.releaseBounty(id, 0, whitehat);
        assertEq(usdc.balanceOf(whitehat), 1_000e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
        (,,, s) = vault.getDeal(id);
        assertEq(uint8(s), uint8(BountyVault.Status.Released));
    }

    function test_E2E_WhitehatCannotSelfRelease() public {
        uint256 id = _create(1_000e6);
        vm.prank(whitehat);
        vm.expectRevert(BountyVault.OnlyProtocolOrPaymaster.selector);
        vault.releaseBounty(id, 0, whitehat);
    }

    function test_E2E_DisputeResolveToWhitehat() public {
        uint256 id = _create(700e6);
        vm.prank(whitehat);
        vault.disputeBounty(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, true);
        assertEq(usdc.balanceOf(whitehat), 700e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
        (,,, BountyVault.Status s) = vault.getDeal(id);
        assertEq(uint8(s), uint8(BountyVault.Status.ResolvedToWhitehat));
    }

    function test_E2E_DisputeResolveToProtocol() public {
        uint256 id = _create(700e6);
        vm.prank(whitehat);
        vault.disputeBounty(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, false);
        assertEq(usdc.balanceOf(protocol), 700e6);
        assertEq(usdc.balanceOf(address(vault)), 0);
        (,,, BountyVault.Status s) = vault.getDeal(id);
        assertEq(uint8(s), uint8(BountyVault.Status.ResolvedToProtocol));
    }

    function test_E2E_AdminCannotResolve() public {
        uint256 id = _create(100e6);
        vm.prank(whitehat);
        vault.disputeBounty(id);
        vm.prank(admin);
        vm.expectRevert(BountyVault.OnlyArbitrator.selector);
        vault.resolveDispute(id, true);
    }

    function test_E2E_PaymasterRelayedReleaseFeeThenWithdrawAndSweep() public {
        uint256 id = _create(1_000e6);
        vm.prank(address(pm));
        vault.releaseBounty(id, 25e6, whitehat);
        assertEq(usdc.balanceOf(whitehat), 975e6);
        assertEq(usdc.balanceOf(address(pm)), 25e6);

        vm.startPrank(admin);
        d.callPaymaster(abi.encodeCall(USDCPaymaster.withdrawFees, ()));
        assertEq(usdc.balanceOf(address(d)), 25e6);
        d.sweepToken(address(usdc), admin, 25e6);
        vm.stopPrank();
        assertEq(usdc.balanceOf(admin), 25e6);
        assertEq(usdc.balanceOf(address(d)), 0);
        assertEq(usdc.balanceOf(address(pm)), 0);
    }

    function testFuzz_E2E_ConservationOnResolve(uint96 amount, bool payWhitehat) public {
        amount = uint96(bound(amount, 1, 1e12 * 1e6));
        uint256 id = _create(amount);
        vm.prank(whitehat);
        vault.disputeBounty(id);
        vm.prank(arbitrator);
        vault.resolveDispute(id, payWhitehat);
        assertEq(usdc.balanceOf(payWhitehat ? whitehat : protocol), amount);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }
}

contract NativeRejecter {
    receive() external payable {
        revert("no native");
    }
}

contract NoReceive {}
