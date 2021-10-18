//SPDX-License-Identifier: UNLICENSED

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
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
  string ipaddress; //ipaddress that hashrate power should be credited to
  string username; //mining pool username
  string password; //mining pool password

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
    setParameters(contractManager, _lmn);
  }


  modifier onlyApproved() { //look into replacing this in open zeppelin
    require(approved[msg.sender] == true, "this address is not allowed to call this function");
    _;
  }

  event contractPurchased(address _buyer);
  event contractClosed();
  event contractCanceled();
  
  //returns the ipaddress, username, and password
  function getMiningPoolInformation() external view onlyApproved returns (string memory, string memory, string memory) {
    return (ipaddress, username, password);
  }

  //need to remove lmn from contract call, also need to remove from webfacing
  function setPurchaseContract(
    string memory _ipaddress, 
    string memory _username, 
    string memory _password, 
    address _buyer,
    address _validator,
    bool _withValidator
  ) 
    payable external {
    require(contractState == ContractState.Available, "contract is not in an available state");
    ipaddress = _ipaddress;
    username = _username;
    password = _password;
    buyer = _buyer;
    contractManager = _validator;
    createEscrow(seller, buyer, price);
    if (_withValidator == true) {
      approved[_validator] = true;
      require(msg.value == 100, "validation fee not sent");
    } else {
      approved[_buyer] = true;
      approved[seller] = true;
    }
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
    emit contractClosed();
  }

  //function which checks to see if lumerin has been sent to the contracts address
  function setFundContract() external {
    //if escrow is fully funded, set contract state to running
    require(dueAmount() == 0, "lumerin tokens need to be sent to the contract");
    require(approved[buyer] == true || approved[contractManager] == true, "the buyer has not been set");
    startingBlockTimestamp = block.timestamp;
    contractState = ContractState.Running;
  }
}

