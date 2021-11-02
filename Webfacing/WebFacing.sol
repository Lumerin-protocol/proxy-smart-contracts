//SPDX-License-Identifier: MIT

pragma solidity >0.8.0;

import './Ledger.sol';
import './CloneFactory.sol';
import './Implementation.sol';
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title WebFacing
/// @author Josh Kean (Lumerin)
/// @notice Additional functions may be added as project needs evolve

contract WebFacing is Ownable{
  Ledger l; //contract object for the ledger
  CloneFactory cf; //contract object for the clone factory

  constructor(address _ledgerAddress, address _cloneFactoryAddress) {
    l = Ledger(_ledgerAddress); //accesses the deployed ledger smart contract
    cf = CloneFactory(_cloneFactoryAddress); //accesses the deployed ledger smart contract
  }

  //event which is listened to by the proxy server and by the validator
  event contractPurchase(address _contract);

  function setCreateRentalContract(
    uint _price, 
    uint _limit, 
    uint _speed, 
    uint _length,
    uint _validationFee
  ) 
    external returns (address){
    address newAddress = cf.setCreateNewRentalContract(_price, _limit, _speed, _length, _validationFee, msg.sender); 
    l.setAddContractToStorage(newAddress); 
    return newAddress;
  }


  function getListOfContracts() public view returns (address[] memory) {
    return l.getListOfContractsLedger();
  }

  
  function setPurchaseContract(address _contract, 
                              address _buyer, 
                              address _validator, 
                              bool _withValidator, 
                              string memory _encryptedPoolData
			      )
    public payable { 
    Implementation(_contract).setPurchaseContract(_encryptedPoolData, _buyer, _validator, _withValidator); 
    // add in function call to ledger to update contracts buyer variable
    emit contractPurchase(_contract); 
  }
}
