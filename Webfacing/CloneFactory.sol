//SPDX-License-Identifier: MIT

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import './Implementation.sol';
import './LumerinToken.sol';

/// @title CloneFactory
/// @author Josh Kean (Lumerin)
/// @notice Variables passed into contract initializer are subject to change based on the design of the hashrate contract

//CloneFactory now responsible for minting, purchasing, and tracking contracts
contract CloneFactory {
	address baseImplementation;
	address validator;
	address proxy;
	address lmnDeploy;
	address webfacingAddress;
	address[] public rentalContracts; //dynamically allocated list of rental contracts
	Lumerin lumerin;

	constructor(address _lmn, address _validator, address _proxy) {
		Implementation _imp = new Implementation();
		baseImplementation = address(_imp);
		lmnDeploy = _lmn; //deployed address of lumeirn token
		validator = _validator;
		proxy = _proxy;
		lumerin = Lumerin(_lmn);
	}

	event contractCreated(address indexed _address); //emitted whenever a contract is created

	//function to create a new Implementation contract
	function setCreateNewRentalContract(
		uint _price,
		uint _limit,
		uint _speed,
		uint _length,
		address _validator
	) external returns(address){
		address _newContract = Clones.clone(baseImplementation);
		Implementation(_newContract).initialize(_price, _limit, _speed, _length, msg.sender, lmnDeploy, address(this), _validator);
		rentalContracts.push(_newContract); //add clone to list of contracts
		emit contractCreated(_newContract);
		return _newContract;
	}


	//function to purchase a hashrate contract
	//requires the clonefactory to be able to spend tokens on behalf of the purchaser
	function setPurchaseRentalContract(
		address contractAddress,
		string memory _cipherText
	) external {
		Implementation targetContract = Implementation(contractAddress);
		uint _price = targetContract.price();
		require(lumerin.allowance(msg.sender, address(this)) >= _price, "not authorized to spend required funds");
		lumerin.transferFrom(msg.sender, contractAddress, _price);
		targetContract.setPurchaseContract(
			_cipherText, msg.sender
		);
	}


	function getContractList() public view returns(address[] memory) {
		address[] memory _rentalContracts = rentalContracts;
		return _rentalContracts;
	}

}
