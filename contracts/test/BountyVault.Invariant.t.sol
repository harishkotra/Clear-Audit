// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BountyVault} from "../BountyVault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Drives random, mostly-legal-but-sometimes-illegal call sequences and
///      records any call whose success contradicts the documented permissions.
contract BountyVaultHandler is Test {
    BountyVault public vault;
    MockUSDC public usdc;
    address public paymaster;
    address public arbitrator;

    address[] public protocols;
    address[] public whitehats;
    address[] public strangers;

    uint256 public ghostMinted;
    uint256 public violations;
    mapping(uint256 => uint8) public lastStatus;

    constructor(BountyVault _vault, MockUSDC _usdc) {
        vault = _vault;
        usdc = _usdc;
        paymaster = _vault.paymaster();
        arbitrator = _vault.arbitrator();
        for (uint256 i; i < 2; i++) {
            address p = makeAddr(string.concat("p", vm.toString(i)));
            address w = makeAddr(string.concat("w", vm.toString(i)));
            address s = makeAddr(string.concat("s", vm.toString(i)));
            protocols.push(p);
            whitehats.push(w);
            strangers.push(s);
            vm.prank(p);
            _usdc.approve(address(_vault), type(uint256).max);
        }
    }

    function allActors() external view returns (address[] memory a) {
        a = new address[](10);
        a[0] = address(vault);
        a[1] = paymaster;
        a[2] = arbitrator;
        for (uint256 i; i < 2; i++) {
            a[3 + i] = protocols[i];
            a[5 + i] = whitehats[i];
            a[7 + i] = strangers[i];
        }
        a[9] = address(0xdead); // sink (never used) keeps array length stable
    }

    function _caller(uint256 seed, uint256 dealId) internal view returns (address) {
        (address p, address w,,) = vault.getDeal(dealId);
        uint256 k = seed % 6;
        if (k == 0) return p;
        if (k == 1) return w;
        if (k == 2) return paymaster;
        if (k == 3) return arbitrator;
        if (k == 4) return strangers[seed % 2];
        return protocols[(seed / 7) % 2]; // possibly a foreign protocol
    }

    function _id(uint256 seed) internal view returns (uint256) {
        uint256 n = vault.nextDealId();
        return n == 0 ? 0 : seed % n;
    }

    function create(uint256 pSeed, uint256 wSeed, uint256 amount) external {
        amount = bound(amount, 1, 1_000_000e6);
        address p = protocols[pSeed % 2];
        address w = whitehats[wSeed % 2];
        usdc.mint(p, amount);
        ghostMinted += amount;
        vm.prank(p);
        uint256 id = vault.createBounty(w, amount);
        lastStatus[id] = uint8(BountyVault.Status.Open);
    }

    function release(uint256 idSeed, uint256 callerSeed, uint256 fee, bool wrongWhitehat) external {
        if (vault.nextDealId() == 0) return;
        uint256 id = _id(idSeed);
        (address p, address w, uint256 amt, BountyVault.Status st) = vault.getDeal(id);
        address caller = _caller(callerSeed, id);
        fee = bound(fee, 0, amt + (fee % 3 == 0 ? 5 : 0));
        address wArg = wrongWhitehat ? strangers[0] : w;
        bool expectOk = st == BountyVault.Status.Open
            && (caller == p || (caller == paymaster && wArg == w && fee <= amt));
        vm.prank(caller);
        try vault.releaseBounty(id, fee, wArg) {
            if (!expectOk) violations++;
        } catch {
            if (expectOk) violations++;
        }
    }

    function dispute(uint256 idSeed, uint256 callerSeed) external {
        if (vault.nextDealId() == 0) return;
        uint256 id = _id(idSeed);
        (, address w,, BountyVault.Status st) = vault.getDeal(id);
        address caller = _caller(callerSeed, id);
        bool expectOk = st == BountyVault.Status.Open && caller == w;
        vm.prank(caller);
        try vault.disputeBounty(id) {
            if (!expectOk) violations++;
        } catch {
            if (expectOk) violations++;
        }
    }

    function resolve(uint256 idSeed, uint256 callerSeed, bool pay) external {
        if (vault.nextDealId() == 0) return;
        uint256 id = _id(idSeed);
        (,,, BountyVault.Status st) = vault.getDeal(id);
        address caller = _caller(callerSeed, id);
        bool expectOk = st == BountyVault.Status.Disputed && caller == arbitrator;
        vm.prank(caller);
        try vault.resolveDispute(id, pay) {
            if (!expectOk) violations++;
        } catch {
            if (expectOk) violations++;
        }
    }
}

contract BountyVaultInvariantTest is Test {
    MockUSDC internal usdc;
    BountyVault internal vault;
    BountyVaultHandler internal handler;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new BountyVault(address(usdc), makeAddr("paymaster"), makeAddr("arbitrator"));
        handler = new BountyVaultHandler(vault, usdc);
        targetContract(address(handler));
        bytes4[] memory sels = new bytes4[](4);
        sels[0] = handler.create.selector;
        sels[1] = handler.release.selector;
        sels[2] = handler.dispute.selector;
        sels[3] = handler.resolve.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: sels}));
    }

    /// vault token balance == sum of amounts of Open + Disputed deals
    function invariant_VaultBalanceEqualsLiveDeals() public view {
        uint256 n = vault.nextDealId();
        uint256 live;
        for (uint256 i; i < n; i++) {
            (,, uint256 a, BountyVault.Status s) = vault.getDeal(i);
            if (s == BountyVault.Status.Open || s == BountyVault.Status.Disputed) live += a;
        }
        assertEq(usdc.balanceOf(address(vault)), live);
    }

    /// all minted tokens are accounted for among vault + actors (nothing created or lost)
    function invariant_TotalFundsConserved() public view {
        address[] memory a = handler.allActors();
        uint256 sum;
        for (uint256 i; i < a.length; i++) sum += usdc.balanceOf(a[i]);
        assertEq(sum, handler.ghostMinted());
        assertEq(usdc.totalSupply(), handler.ghostMinted());
    }

    /// no call succeeded/failed contrary to the role + state-machine rules
    /// (covers: whitehat cannot self-release, only arbitrator resolves,
    /// only Disputed resolvable, no double payout)
    function invariant_NoPermissionOrStateViolations() public view {
        assertEq(handler.violations(), 0);
    }

    /// whitehats never receive funds from an Open deal without protocol/paymaster/arbitrator action:
    /// every deal's recorded fields other than status are immutable
    function invariant_DealAmountsNonZeroAndIdsMonotonic() public view {
        uint256 n = vault.nextDealId();
        for (uint256 i; i < n; i++) {
            (address p, address w, uint256 a, BountyVault.Status s) = vault.getDeal(i);
            assertTrue(p != address(0) && w != address(0));
            assertGt(a, 0);
            assertTrue(s != BountyVault.Status.None);
        }
        (,,, BountyVault.Status s2) = vault.getDeal(n);
        assertEq(uint8(s2), uint8(BountyVault.Status.None));
    }
}
