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
  // top level smart contract which will provide access to the 
  // entire smart contract deployment ecosystem

  Ledger l; //contract object for the ledger
  CloneFactory cf; //contract object for the clone factory

  constructor(address _ledgerAddress, address _cloneFactoryAddress, address _validator, address _proxy) {
    l = Ledger(_ledgerAddress); //accesses the deployed ledger smart contract
    cf = CloneFactory(_cloneFactoryAddress); //accesses the deployed ledger smart contract
    cf.setChangeValidatorAddress(_validator);
    cf.setChangeProxyAddress(_proxy);
  }

  //event which is listened to by the proxy server and by the validator
  event contractPurchase(address _contract);

  function setCreateRentalContract(uint _price, uint _limit, uint _speed, uint _length) public {
    address newAddress = cf.setCreateNewRentalContract(_price, _limit, _speed, _length, msg.sender); 
    l.setAddContractToStorage(newAddress, msg.sender); 
  }


  function getListOfContracts() public view returns (address[] memory) {
    return l.getListOfContractsLedger();
  }

  
  function setPurchaseContract(address _contract, string memory _ip_address, uint _port, string memory _username) 
    public payable { 
    require(msg.value == Implementation(_contract).price(), "inadequate funds");
    Implementation(_contract).setPurchaseContract(_ip_address, _port); 
    // add in function call to ledger to update contracts buyer variable
    emit contractPurchase(_contract); 
  }

  function setUpdateLedgerAddress(address _ledgerAddress) public onlyOwner {
    l = Ledger(_ledgerAddress);
  }


  function setUpdateCloneFactoryAddress(address _cfAddress) public onlyOwner {
    cf = CloneFactory(_cfAddress);
  }
}
