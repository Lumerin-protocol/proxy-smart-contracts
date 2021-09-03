//SPDX-License-Identifier: MIT

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import './Implementation.sol';

/// @title CloneFactory
/// @author Josh Kean (Lumerin)
/// @notice Variables passed into contract initializer are subject to change based on the design of the hashrate contract

contract CloneFactory {
  address baseImplementation; 
  address validator;
  address proxy;

  constructor() {
    Implementation _imp = new Implementation();
    baseImplementation = address(_imp);
  }

  //function to create a new Implementation contract
  function setCreateNewRentalContract(
    uint _price,
    uint _limit,
    uint _speed,
    uint _length,
    address _seller
  ) external returns (address) {
    address _newContract = Clones.clone(baseImplementation); 
    Implementation(_newContract).initialize(_price, _limit, _speed, _length, _seller, validator);
    return _newContract;
  }


  function getHashRateContractParameters(address _contract) public returns (uint[] memory) {
    return Implementation(_contract).getContractVariables();
  }


  function setChangeValidatorAddress(address _validator) public { //add modifier to specify owner
    validator = _validator;
  }


  function setChangeProxyAddress(address _proxy) public { //add modifier to specify owner
    proxy = _proxy;
  }
}
