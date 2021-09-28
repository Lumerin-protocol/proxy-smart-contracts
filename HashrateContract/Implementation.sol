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
  uint public validationFee; //fee required to fund the validator
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
    approved[buyer] = true;
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
  function setPurchaseContract(string memory _ipaddress, string memory _username, string memory _password) external payable {
    require(msg.value == validationFee, "validation fee is incorrect");
    require(contractState == ContractState.Available, "contract is not in an available state");
    payable(contractManager).transfer(msg.value); //sending funds to contract manager address
    ipaddress = _ipaddress;
    username = _username;
    password = _password;
    contractState = ContractState.Running;
    //set the values for the escrow portion of the contract
    createEscrow(seller, msg.sender, price);
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

  }

  //called by the contract manager when the contractCanceled event is emitted
  //determines how many lumerin tokens should go to the buyer and how many should go to the seller
  function setPenaltyCloseOut(uint _hashesCompleted) external onlyContractManager {
    uint sellerReimbursement = price*(limit-_hashesCompleted)/limit;
    uint buyerReimbursement = price*_hashesCompleted/limit;
    uint difference = Math.max(sellerReimbursement, buyerReimbursement) - Math.min(sellerReimbursement, buyerReimbursement);

    if (penaltyTarget == seller) {
      //seller looses out on the rounding error
      buyerReimbursement += difference;
    } else {
      sellerReimbursement += difference;
    }
    withdrawFunds(sellerReimbursement, buyerReimbursement);
    contractState = ContractState.Complete;
  }
}
