//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

import {CloneFactory} from "./CloneFactory.sol";

/// @title CloneFactory2
/// @notice This contract is used to test Clonefactory update

contract CloneFactory2 is CloneFactory {
    function doesNothing() external pure returns (bool) {
        return true;
    }
}
