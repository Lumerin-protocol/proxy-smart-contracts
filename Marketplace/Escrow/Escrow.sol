// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Marketplace Escrow
/// @author Lance Seidman (Lumerin)
/// @notice This first version will be used to hold funds temporarily for the Marketplace Hash Rental.

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
    
   
    // @notice Run once the contract is created. Set contract owner, which is assumed to be the Validator.
    // @dev We're making the sender (releaser to the BC) the Validator and set the State of the contract.
    constructor() {
        escrow_validator = msg.sender;
        currentState = State.AWAITING_PAYMENT;
    }

    // @notice This will create a new escrow based on the seller, buyer, and total.
    // @dev Call this in order to make a new contract. Potentially this will have a database within the contract to store/call by 
    //      the validator ONLY.
    function createEscrow(address _escrow_seller, address _escrow_purchaser, uint256 _contractTotal) external validatorOnly {
        escrow_seller = _escrow_seller;
        escrow_purchaser = _escrow_purchaser;
        contractTotal = _contractTotal*10**18;
        
        emit dataEvent(block.timestamp, 'Escrow Created');
    }

    // @notice Function to accept incoming funds
    // @dev This exists to know how much is deposited and when the contract has been fullfilled, set the state it has been funded.
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
    
    // @notice Find out how much is left to fullfill the Escrow to say it's funded.
    // @dev This is used to determine if the contract amount has been fullfilled and return how much is left to be fullfilled. 
    function dueAmount() public view returns (uint256) {
        uint256 anyFunds = address(this).balance;
        
        if(anyFunds != 0) {
            anyFunds = address(this).balance - contractTotal;
        } 
        
        return anyFunds;
    }
    
    // @notice Validator can request the funds to be released once determined it's safe to do.
    // @dev Function makes sure the contract was fully funded by checking the State and if so, release the funds to the seller.
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
