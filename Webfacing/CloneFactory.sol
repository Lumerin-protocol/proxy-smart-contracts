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
  address lmnDeploy;
  address webfacingAddress;

  constructor(address _lmn, address _validator, address _proxy) {
    Implementation _imp = new Implementation();
    baseImplementation = address(_imp);
    lmnDeploy = _lmn;
    validator = _validator;
    proxy = _proxy;
  }

  event contractCreated(address indexed _address); //emitted whenever a contract is created

  //function to create a new Implementation contract
  function setCreateNewRentalContract(
    uint _price,
    uint _limit,
    uint _speed,
    uint _length,
    uint _validationFee,
    address _seller
  ) external returns (address) {
    address _newContract = Clones.clone(baseImplementation); 
    Implementation(_newContract).initialize(_price, _limit, _speed, _length, _validationFee, _seller, validator, lmnDeploy);
    emit contractCreated(_newContract);
    return _newContract;
  }

}
