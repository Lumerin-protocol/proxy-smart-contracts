// SPDX-License-Identifier: MIT
pragma solidity >=0.8.26;

interface Versionable {
    function VERSION() external view returns (string memory);
}
