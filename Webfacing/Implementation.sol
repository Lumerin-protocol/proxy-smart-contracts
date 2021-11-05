//SPDX-License-Identifier: UNLICENSED

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./Escrow.sol";


//MyToken is place holder for actual lumerin token, purely for testing purposes
contract Implementation is Initializable, Escrow{
  enum ContractState {
    Available,
    Active,
    Running,
    Complete
  }

  ContractState public contractState; 
  uint public price; //cost to purchase contract
  uint public limit; //max th provided
  uint public speed; //th/s of contract
  uint public length; //how long the contract will last in seconds
  uint public port; //port provided by buyer
  uint public validationFee; //validator fee, may not be included in the contract depending on future state of documentation
  uint public startingBlockTimestamp; //the timestamp of the block when the contract was purchased
  address public buyer; //address of the current purchaser of the contract
  address public seller; //address of the seller of the contract
  address contractManager; //should be hardcoded somewhere...
  address penaltyTarget; //will only have a value assigned if a a penalty is called
  string public encryptedPoolData; //encrypted data for pool target info

  mapping(address => bool) approved;

  function initialize(
    uint _price,
    uint _limit,
    uint _speed,
    uint _length,
    uint _validationFee,
    address _seller,
    address _contractManager,
    address _lmn
  ) public initializer(){
    price = _price;
    limit = _limit;
    speed = _speed;
    length = _length;
    seller = _seller;
    validationFee = _validationFee;
    contractManager = _contractManager;
    contractState = ContractState.Available;
    setParameters(_lmn);
  }


  modifier onlyApproved() { //look into replacing this in open zeppelin
    require(approved[msg.sender] == true, "this address is not allowed to call this function");
    _;
  }

  event contractPurchased(address _buyer);
  event contractClosed(address caller);
  

  //need to remove lmn from contract call, also need to remove from webfacing
  function setPurchaseContract( string memory _encryptedPoolData, address _buyer, address _validator, bool _withValidator) 
    payable external {
    require(contractState == ContractState.Available, "contract is not in an available state");
    encryptedPoolData = _encryptedPoolData;
    buyer = _buyer;
    contractManager = _validator;
    createEscrow(seller, buyer, price);
    if (_withValidator == true) {
      approved[_validator] = true;
      require(msg.value == validationFee, "validation fee not sent");
    } 
	approved[_buyer] = true;
	approved[seller] = true;
    emit contractPurchased(msg.sender); //might need to replace this with an additional passed in variable for the contract purchaser
  }


  //this is the closeout function which will be called upon successful completion of the contract
  function setContractCloseOut() external onlyApproved {
    uint durationOfContract = block.timestamp - startingBlockTimestamp;
    uint buyerPayOut;
    uint sellerPayOut;
    if (durationOfContract >= length) {
      buyerPayOut = 0;
    } else {
      buyerPayOut = uint(price*uint(length-durationOfContract))/uint(length); 
    }
    sellerPayOut = price - buyerPayOut;
    withdrawFunds(sellerPayOut, buyerPayOut);
    contractState = ContractState.Complete;
    emit contractClosed(msg.sender);
  }

  //function which checks to see if lumerin has been sent to the contracts address
  //this call is necessary since somebody could fund a contract with lumerin before setPurchaseContract
  //and then another person could call the setPurchaseContract function, essentially "stealing" the contract
  function setFundContract() external {
    //if escrow is fully funded, set contract state to running
    require(dueAmount() == 0, "lumerin tokens need to be sent to the contract");
    require(approved[buyer] == true, "the contract has not been purchased");
    startingBlockTimestamp = block.timestamp;
    contractState = ContractState.Running;
  }
}

