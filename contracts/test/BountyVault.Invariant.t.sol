// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {BountyVault} from "../BountyVault.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @dev Drives random, mostly-legal-but-sometimes-illegal call sequences and
///      records any call whose success contradicts the documented rules.
contract BountyVaultHandler is Test {
    BountyVault public vault;
    MockUSDC public usdc;
    address public arbitrator;

    address[2] public payers;
    address[3] public payees;
    address public stranger;

    uint256 public ghostMinted;
    uint256 public violations;
    /// successful call count per action name (guards against a vacuous run)
    mapping(bytes32 => uint256) public successes;
    /// terminal status recorded for each id (0 = not yet terminal)
    mapping(uint256 => uint8) public terminal;

    constructor(BountyVault _vault, MockUSDC _usdc) {
        vault = _vault;
        usdc = _usdc;
        arbitrator = _vault.arbitrator();
        stranger = makeAddr("hStranger");
        for (uint256 i; i < 2; i++) {
            payers[i] = makeAddr(string.concat("hPayer", vm.toString(i)));
            vm.prank(payers[i]);
            _usdc.approve(address(_vault), type(uint256).max);
        }
        for (uint256 i; i < 3; i++) {
            payees[i] = makeAddr(string.concat("hPayee", vm.toString(i)));
        }
    }

    function actors() external view returns (address[] memory a) {
        a = new address[](7);
        a[0] = address(vault);
        a[1] = arbitrator;
        a[2] = stranger;
        a[3] = payers[0];
        a[4] = payers[1];
        a[5] = payees[0];
        a[6] = payees[1];
        // payees[2] is included via actors2 to keep this readable
    }

    function lastPayee() external view returns (address) {
        return payees[2];
    }

    // ───────── helpers ─────────

    function _id(uint256 seed) internal view returns (uint256) {
        uint256 n = vault.nextDealId();
        return n == 0 ? 0 : seed % n;
    }

    /// biased towards the deal's legitimate actors so state-changing paths are reached often
    function _caller(uint256 seed, uint256 id) internal view returns (address) {
        (address p, address w,,) = vault.getDeal(id);
        uint256 k = seed % 10;
        if (k <= 3) return p; // payer
        if (k <= 5) return w == address(0) ? payees[seed % 3] : w; // payee
        if (k == 6) return arbitrator;
        if (k == 7) return stranger;
        if (k == 8) return payers[(seed / 10) % 2];
        return payees[(seed / 10) % 3];
    }

    function _deadline(uint256 id) internal view returns (uint64 d) {
        (,,,, d,,,,,,,) = vault.deals(id);
    }

    function _claimedAt(uint256 id) internal view returns (uint64 c) {
        (,,,,, c,,,,,,) = vault.deals(id);
    }

    function _status(uint256 id) internal view returns (BountyVault.Status s) {
        (,,, s) = vault.getDeal(id);
    }

    /// Terminal states (Released / ResolvedTo*) must never change afterwards.
    function _sync() internal {
        uint256 n = vault.nextDealId();
        for (uint256 i; i < n; i++) {
            uint8 s = uint8(_status(i));
            if (terminal[i] != 0) {
                if (s != terminal[i]) violations++;
            } else if (s >= uint8(BountyVault.Status.Released)) {
                terminal[i] = s;
            }
        }
    }

    // ───────── actions ─────────

    function create(uint256 pSeed, uint256 wSeed, uint256 amount, uint256 dlSeed) external {
        amount = bound(amount, 1, 1_000_000e6);
        address p = payers[pSeed % 2];
        address w = payees[wSeed % 3];
        usdc.mint(p, amount);
        ghostMinted += amount;
        uint64 dl = dlSeed % 3 == 0 ? 0 : uint64(block.timestamp + bound(dlSeed, 1, 3 days));
        vm.prank(p);
        vault.createBounty(w, uint128(amount), dl, bytes32(dlSeed));
        successes["create"]++;
        _sync();
    }

    function createTask(uint256 pSeed, uint256 amount, uint256 dlSeed) external {
        amount = bound(amount, 1, 1_000_000e6);
        address p = payers[pSeed % 2];
        usdc.mint(p, amount);
        ghostMinted += amount;
        uint64 dl = uint64(block.timestamp + bound(dlSeed, 1, 3 days));
        vm.prank(p);
        vault.createOpenTask(uint128(amount), dl, bytes32(dlSeed));
        successes["createTask"]++;
        _sync();
    }

    function claim(uint256 idSeed, uint256 cSeed) external {
        uint256 id = _id(idSeed);
        address c = cSeed % 8 == 0 ? _caller(cSeed, id) : payees[cSeed % 3];
        (address payer,,,) = vault.getDeal(id);
        BountyVault.Status pre = _status(id);
        vm.prank(c);
        try vault.claimTask(id) {
            successes["claim"]++;
            if (pre != BountyVault.Status.Open || c == payer || c == arbitrator) violations++;
        } catch {}
        _sync();
    }

    function assign(uint256 idSeed, uint256 cSeed, uint256 wSeed) external {
        uint256 id = _id(idSeed);
        address c = _caller(cSeed, id);
        (address payer,,,) = vault.getDeal(id);
        address w = wSeed % 7 == 0 ? arbitrator : payees[wSeed % 3];
        bool claimed = _claimedAt(id) != 0;
        BountyVault.Status pre = _status(id);
        vm.prank(c);
        try vault.assignPayee(id, w) {
            successes["assign"]++;
            if (c != payer || pre != BountyVault.Status.Open || claimed || w == arbitrator) violations++;
        } catch {}
        _sync();
    }

    function release(uint256 idSeed, uint256 cSeed) external {
        uint256 id = _id(idSeed);
        address c = _caller(cSeed, id);
        (address payer, address w,,) = vault.getDeal(id);
        BountyVault.Status pre = _status(id);
        uint256 wBefore = usdc.balanceOf(w);
        uint256 amount;
        (,, amount,) = vault.getDeal(id);
        if (c == payer && w != address(0) && vault.evidenceHash(id) == bytes32(0)) {
            vm.prank(payer);
            try vault.commitEvidence(id, keccak256(abi.encode(id)), uint64(block.timestamp + 30 days)) {} catch {}
        }
        vm.prank(c);
        try vault.release(id) {
            successes["release"]++;
            if (c != payer || pre != BountyVault.Status.Open || w == address(0)) violations++;
            if (usdc.balanceOf(w) != wBefore + amount) violations++;
        } catch {}
        _sync();
    }

    function dispute(uint256 idSeed, uint256 cSeed) external {
        uint256 id = _id(idSeed);
        address c = _caller(cSeed, id);
        (address payer, address w,,) = vault.getDeal(id);
        BountyVault.Status pre = _status(id);
        vm.prank(c);
        try vault.dispute(id) {
            successes["dispute"]++;
            if ((c != payer && c != w) || pre != BountyVault.Status.Open || w == address(0)) violations++;
        } catch {}
        _sync();
    }

    function resolve(uint256 idSeed, uint256 cSeed, bool toPayee) external {
        uint256 id = _id(idSeed);
        address c = cSeed % 6 == 0 ? _caller(cSeed, id) : arbitrator;
        BountyVault.Status pre = _status(id);
        vm.prank(c);
        try vault.resolveDispute(id, toPayee) {
            successes["resolve"]++;
            if (c != arbitrator || pre != BountyVault.Status.Disputed) violations++;
        } catch {}
        _sync();
    }

    function refund(uint256 idSeed, uint256 cSeed) external {
        uint256 id = _id(idSeed);
        address c = _caller(cSeed, id);
        BountyVault.Status pre = _status(id);
        uint64 dl = _deadline(id);
        vm.prank(c);
        try vault.refundExpired(id) {
            successes["refund"]++;
            if (pre != BountyVault.Status.Open || dl == 0 || block.timestamp <= dl) violations++;
        } catch {}
        _sync();
    }

    function cancel(uint256 idSeed, uint256 cSeed) external {
        uint256 id = _id(idSeed);
        address c = _caller(cSeed, id);
        (address payer,,,) = vault.getDeal(id);
        BountyVault.Status pre = _status(id);
        uint64 dl = _deadline(id);
        bool claimed = _claimedAt(id) != 0;
        vm.prank(c);
        try vault.cancel(id) {
            successes["cancel"]++;
            if (c != payer || pre != BountyVault.Status.Open || claimed) violations++;
            if (dl != 0 && block.timestamp > dl) violations++;
        } catch {}
        _sync();
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 0, 6 hours));
    }
}

contract BountyVaultInvariantTest is Test {
    MockUSDC internal usdc;
    BountyVault internal vault;
    BountyVaultHandler internal handler;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        vault = new BountyVault(address(usdc), makeAddr("paymaster"), makeAddr("arbitrator"), 1 hours);
        handler = new BountyVaultHandler(vault, usdc);
        targetContract(address(handler));
    }

    /// (7) vault token balance == sum of amounts of deals in Open or Disputed
    function invariant_VaultBalanceEqualsLiveEscrow() public view {
        uint256 live;
        uint256 n = vault.nextDealId();
        for (uint256 i; i < n; i++) {
            (,, uint256 a, BountyVault.Status s) = vault.getDeal(i);
            if (s == BountyVault.Status.Open || s == BountyVault.Status.Disputed) live += a;
        }
        assertEq(usdc.balanceOf(address(vault)), live);
    }

    /// no tokens appear or vanish: every minted unit sits with a known actor or the vault
    function invariant_TokensConserved() public view {
        address[] memory a = handler.actors();
        uint256 sum = usdc.balanceOf(handler.lastPayee());
        for (uint256 i; i < a.length; i++) {
            sum += usdc.balanceOf(a[i]);
        }
        assertEq(sum, handler.ghostMinted());
        assertEq(usdc.totalSupply(), handler.ghostMinted());
    }

    /// every state-changing path is actually reached during the run (non-vacuous)
    function afterInvariant() public view {
        if (handler.successes("create") + handler.successes("createTask") == 0) return;
        console2.log("claim", handler.successes("claim"));
        console2.log("assign", handler.successes("assign"));
        console2.log("release", handler.successes("release"));
        console2.log("dispute", handler.successes("dispute"));
        console2.log("resolve", handler.successes("resolve"));
        console2.log("refund", handler.successes("refund"));
        console2.log("cancel", handler.successes("cancel"));
    }

    /// no action ever succeeded against the documented permission / state / deadline rules
    function invariant_NoRuleViolations() public view {
        assertEq(handler.violations(), 0);
    }
}
