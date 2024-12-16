// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Marketplace Escrow
/// @author Lance Seidman (Lumerin)
/// @notice This first version will be used to hold lumerin temporarily for the Marketplace Hash Rental.

import {ReentrancyGuardUpgradeable, Initializable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {Lumerin} from "./LumerinToken.sol";

// Keep it for consistency of the storage layout
contract Escrow is Initializable, ReentrancyGuardUpgradeable {
    address public escrow_purchaser; // Entity making a payment...
    address public escrow_seller; // Entity to receive funds...
    uint256 public contractTotal; // How much should be escrowed...
    Lumerin lumerin;

    //internal function which will be called by the hashrate contract
    function initialize(address _lmrAddress) internal onlyInitializing {
        lumerin = Lumerin(_lmrAddress);
        __ReentrancyGuard_init();
    }
}
