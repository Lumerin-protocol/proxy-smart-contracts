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

  ContractState public contractState; //input and output will be treated as uints corresponding to occurnce
  uint public price; //cost to purchase contract
  uint public limit; //max th provided
  uint public speed; //th/s of contract
  uint public length; //how long the contract will last in days
  uint public port; //port provided by buyer
  uint public validationFee; //validator fee, may not be included in the contract depending on future state of documentation
  address public buyer; //address of the current purchaser of the contract
  address public seller; //address of the seller of the contract
  address contractManager; //should be hardcoded somewhere...
  address penaltyTarget; //will only have a value assigned if a a penalty is called
  string public ipaddress; //ipaddress that hashrate power should be credited to
  string public username; //mining pool username
  string public password; //mining pool password

  mapping(address => bool) approved;

  function initialize(
    uint _price,
    uint _limit,
    uint _speed,
    uint _length,
    address _seller,
    address _contractManager,
    address _lmn
  ) public initializer(){
    price = _price;
    limit = _limit;
    speed = _speed;
    length = _length;
    seller = _seller;
    contractManager = _contractManager;
    contractState = ContractState.Available;
    approved[seller] = true;
    setParameters(contractManager, _lmn);
  }


  modifier onlyContractManager() {
    require(msg.sender == contractManager, "this function must be called by the contract manager");
    _;
  }

  modifier onlyApproved() { //look into replacing this in open zeppelin
    require(approved[msg.sender] == true, "this address is not allowed to call this function");
    _;
  }

  event contractPurchased(address _buyer);
  event contractClosed();
  event contractCanceled();
  

  //need to remove lmn from contract call, also need to remove from webfacing
  function setPurchaseContract(string memory _ipaddress, string memory _username, string memory _password, address _buyer) external payable {
    require(contractState == ContractState.Available, "contract is not in an available state");
    ipaddress = _ipaddress;
    username = _username;
    password = _password;
    buyer = _buyer;
    createEscrow(seller, buyer, price);
    approved[_buyer] = true;
    emit contractPurchased(msg.sender); //might need to replace this with an additional passed in variable for the contract purchaser
  }


  //this is the closeout function which will be called upon successful completion of the contract
  function setContractCloseOut() external onlyContractManager {
    withdrawFunds(price, 0);
    contractState = ContractState.Complete;
    emit contractClosed();
  }


  //early cancelation, can be called by buyer or seller
  function setEarlyCloseOut() external onlyApproved {
    penaltyTarget = msg.sender;
    emit contractCanceled();
  }

  //function which checks to see if lumerin has been sent to the contracts address
  function setFundContract() external {
    //if escrow is fully funded, set contract state to running
    require(dueAmount() == 0, "lumerin tokens need to be sent to the contract");
    contractState = ContractState.Running;

  }

  //called by the contract manager when the contractCanceled event is emitted
  //determines how many lumerin tokens should go to the buyer and how many should go to the seller
  function setPenaltyCloseOut(uint _hashesCompleted) external onlyContractManager {
    uint sellerReimbursement = price*(limit-_hashesCompleted)/limit; //will always return the floor
    uint buyerReimbursement = price*_hashesCompleted/limit; //will always return the floor
    uint difference = price-(sellerReimbursement+buyerReimbursement);

    if (penaltyTarget == seller) {
      buyerReimbursement += difference;
    } else {
      sellerReimbursement += difference;
    }
    withdrawFunds(sellerReimbursement, buyerReimbursement);
    contractState = ContractState.Complete;
  }
}

