//SPDX-License-Identifier: MIT


pragma solidity >0.8.0;

/// @title Ledger
/// @author Josh Kean (Lumerin)
/// @notice mappings may be removed based on final form of hashrate contract

contract Ledger{

  address[] rentalContracts; //dynamically allocated list of rental contracts

  //function to push an address to storage and update mappings
  //performed after a seller deploys their contract to the blockchain
  function setAddContractToStorage(address _rentalContract) external {
    rentalContracts.push(_rentalContract);
  }


  //function to return a list of all existing contracts
  function getListOfContractsLedger() external view returns(address[] memory) {
    return rentalContracts;
  }
}
