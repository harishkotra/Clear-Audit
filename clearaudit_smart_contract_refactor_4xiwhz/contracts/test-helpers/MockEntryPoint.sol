// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Minimal EntryPoint stand-in: native deposits keyed by account.
contract MockEntryPoint {
    mapping(address => uint256) public deposits;
    bool public failDeposit;

    function setFailDeposit(bool f) external {
        failDeposit = f;
    }

    function depositTo(address account) external payable {
        require(!failDeposit, "deposit disabled");
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable to, uint256 amount) external {
        require(deposits[msg.sender] >= amount, "insufficient deposit");
        deposits[msg.sender] -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "send failed");
    }
}
