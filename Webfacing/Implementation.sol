//SPDX-License-Identifier: UNLICENSED

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./Escrow.sol";


//MyToken is place holder for actual lumerin token, purely for testing purposes
contract Implementation is Initializable, Escrow{
	enum ContractState {
		Available,
		Running
	}

	ContractState public contractState;
	uint public price; //cost to purchase contract
	//consider deprecating limit variable since it can be obtained from speed and length/duration
	uint public limit; //max th provided
	uint public speed; //th/s of contract
	uint public length; //how long the contract will last in seconds
	uint public startingBlockTimestamp; //the timestamp of the block when the contract was purchased
	address public buyer; //address of the current purchaser of the contract
	address public seller; //address of the seller of the contract
	address cloneFactory; //used to limit where the purchase can be made
	address validator; //validator to be used. Can be set to 0 address if validator not being used
	string public encryptedPoolData; //encrypted data for pool target info

	event contractPurchased(address indexed _buyer); //make indexed
	event contractClosed();
	event purchaseInfoUpdated();
	event cipherTextUpdated(string newCipherText);


	function initialize(
		uint _price,
		uint _limit,
		uint _speed,
		uint _length,
		address _seller,
		address _lmn,
		address _cloneFactory, //used to restrict purchasing power to only the clonefactory
		address _validator
	) public initializer(){
		price = _price;
		limit = _limit;
		speed = _speed;
		length = _length;
		seller = _seller;
		cloneFactory = _cloneFactory;
		validator = _validator;
		contractState = ContractState.Available;
		/*
		internal to the escrow contract. Used to initialize lumerin token
		and move tokens as contract logic dictates
		*/
		setParameters(_lmn);
	}

	//for demo purposes, returns all public variables
	function getPublicVariables() 
		public 
		view 
		returns (
			ContractState,
			uint,
			uint,
			uint,
			uint,
			string memory
		) {
			return (
				contractState,
				price,
				limit,
				speed,
				length,
				encryptedPoolData
			);
		}

	//function that the clone factory calls to purchase the contract
	function setPurchaseContract(
		string memory _encryptedPoolData,
		address _buyer
	)
	public {
		require(contractState == ContractState.Available, 
			"contract is not in an available state"
		       );
		require(msg.sender == cloneFactory,
			"this address is not approved to call the purchase function"
		       );
		encryptedPoolData = _encryptedPoolData;
		buyer = _buyer;
		startingBlockTimestamp = block.timestamp;
		contractState = ContractState.Running;
		createEscrow(seller, buyer, price);
		emit contractPurchased(msg.sender);
	}

	//allows the buyers to update their mining pool information
	//during the lifecycle of the contract
	function setUpdateMiningInformation(string memory _newEncryptedPoolData) external {
		require(msg.sender == buyer, 
			"this account is not authorized to update the ciphertext information"
		       );
		require(contractState == ContractState.Running, 
			"the contract is not in the running state"
		       );
		encryptedPoolData = _newEncryptedPoolData;
		emit cipherTextUpdated(_newEncryptedPoolData);
	}


	//function which can edit the cost, length, and hashrate of a given contract
	function setUpdatePurchaseInformation(
		uint _price,
		uint _limit,
		uint _speed,
		uint _length,
		uint _closeoutType
	) external {
		require(msg.sender == seller, "this is account is not authorized to update the contract parameters");
		require(contractState == ContractState.Running, "this is account is not in the running state");
		require(_closeoutType == 2 || _closeoutType == 3, "you can only use closeout options 2 or 3");
		price = _price;
		limit = _limit;
		speed = _speed;
		length = _length;
		setContractCloseOut(_closeoutType);
		emit purchaseInfoUpdated();
	}


	//temporarily set buyer to seller until contract is purchased again
	function setContractVariableUpdate() internal {
		buyer = seller;
		encryptedPoolData = "";
		contractState = ContractState.Available;
	}


	function setContractCloseOut(uint closeOutType) public {
		if (closeOutType == 0) {
			require(msg.sender == buyer || msg.sender == validator, "this account is not authorized to trigger an early closeout");
			uint durationOfContract = block.timestamp - startingBlockTimestamp;
			uint buyerPayOut = uint(price*uint(length-durationOfContract))/uint(length);
			uint sellerPayOut = price - buyerPayOut;
			withdrawFunds(sellerPayOut, buyerPayOut);
			setContractVariableUpdate();
			emit contractClosed();
		} else if (closeOutType == 1) {
			uint durationOfContract = block.timestamp - startingBlockTimestamp;
			uint buyerPayOut = uint(price*uint(length-durationOfContract))/uint(length);
			require(msg.sender == seller, "this account is not authorized to trigger a mid-contract closeout");
			getDepositContractHodlingsToSeller(buyerPayOut);
		} else if (closeOutType == 2 || closeOutType == 3) {
			uint durationOfContract = block.timestamp - startingBlockTimestamp;
			require(durationOfContract >= length, "the contract has yet to be carried to term");
			if (closeOutType == 3) {
				uint buyerPayOut = 0;
				uint sellerPayOut = price;
				withdrawFunds(sellerPayOut, buyerPayOut);
			}
			setContractVariableUpdate();
			emit contractClosed();
		} else {
			require(closeOutType < 4, "you must make a selection between 0 and 3");
		}
	}

}

