// SPDX-License-Identifier:UNLICENSED
pragma solidity ^0.8.0;

contract Escrow {
    
    enum State {AWAITING_PAYMENT, COMPLETE, FUNDED}
    State public currentState;

    address public escrow_purchaser; // Entity making a payment...
    address public escrow_seller;  // Entity to receive funds...
    address escrow_validator;  // For dispute management...
    uint256 public contractTotal; // How much should be escrowed...
    uint256 public receivedTotal; // Optional; Keep a balance for how much has been received...
    
    modifier validatorOnly() { require(msg.sender == escrow_validator); _; } // Will throw an exception if it's not true...
    
    event dataEvent(uint256 date, string val);
    
   
    // Run once the contract is created. Set contract owner, which is assumed to be the Validator (vali)...
    constructor() {
        escrow_validator = msg.sender;
        currentState = State.AWAITING_PAYMENT;
    }
    
    function createEscrow(address _escrow_seller, address _escrow_purchaser, uint256 _contractTotal) external validatorOnly {
        escrow_seller = _escrow_seller;
        escrow_purchaser = _escrow_purchaser;
        contractTotal = _contractTotal*10**18;
        
        emit dataEvent(block.timestamp, 'Escrow Created');
    }
    
    function depositFunds() public payable {
       receivedTotal += msg.value;
       
       if(dueAmount() == 0) {
           currentState = State.FUNDED; 
           emit dataEvent(block.timestamp, 'Contract fully funded!');
           
       } else {
           currentState = State.AWAITING_PAYMENT; 
           emit dataEvent(block.timestamp, 'Contract is not fully funded!');
       }
        
    }
    
    function dueAmount() public view returns (uint256) {
        return address(this).balance - contractTotal;
    }
    
    function withdrawFunds() public validatorOnly {
        
        if(currentState != State.FUNDED) { 
            emit dataEvent(block.timestamp, 'Error, not fully funded!');  
            
        } else { 
            payable(escrow_seller).transfer(contractTotal);
            currentState = State.COMPLETE; 
            emit dataEvent(block.timestamp, 'Contract Completed');
            
        }
    }
}
