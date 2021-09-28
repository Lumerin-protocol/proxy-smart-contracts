// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Marketplace Escrow
/// @author Lance Seidman (Lumerin)
/// @author Josh Kean(Lumerin)
/// @notice This first version will be used to hold lumerin temporarily for the Marketplace Hash Rental.

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract Escrow {
    
    enum State {AWAITING_PAYMENT, COMPLETE, FUNDED}
    State public currentState;

    address public escrow_purchaser; // Entity making a payment...
    address public escrow_seller;  // Entity to receive funds...
    //@dev would it make sense to have the escrow_validator also be public so people know the history of this mediator
    //@dev would it make sense to consider the escrow_validator and the hashrate validator to be the same entity?
    address escrow_validator;  // For dispute management...
    address titanToken;
    uint256 public contractTotal; // How much should be escrowed...
    uint256 public receivedTotal; // Optional; Keep a balance for how much has been received...
    ERC20 myToken;
    
    modifier validatorOnly() { require(msg.sender == escrow_validator); _; } // Will throw an exception if it's not true...
    
    event dataEvent(uint256 date, string val);
    
   
    // @notice Run once the contract is created. Set contract owner, which is assumed to be the Validator.
    // @dev We're making the sender (releaser to the BC) the Validator and set the State of the contract.
    constructor() {
        currentState = State.AWAITING_PAYMENT;
    }

    //internal function which will be called by the hashrate contract
    function setParameters(address _validator, address _titanToken) internal { 
        escrow_validator = _validator;
        titanToken = _titanToken;
        myToken = ERC20(titanToken);
    }

    // @notice This will create a new escrow based on the seller, buyer, and total.
    // @dev Call this in order to make a new contract. Potentially this will have a database within the contract to store/call by 
    //      the validator ONLY.
    function createEscrow(address _escrow_seller, address _escrow_purchaser, uint256 _lumerinTotal) internal {
        escrow_seller = _escrow_seller;
        escrow_purchaser = _escrow_purchaser;
        contractTotal = _lumerinTotal;
        
        emit dataEvent(block.timestamp, 'Escrow Created');
    }

    // @notice Function to accept incoming funds
    // @dev This exists to know how much is deposited and when the contract has been fullfilled, set the state it has been funded.
    // @dev this is no longer possible to implement since the transfer function must be directly called by the token holder
    function checkForDepositedTokens() public payable {
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
    // @dev only works if underpayment. overpayment won't work
    function dueAmount() public view returns (uint256) {
        //(bool _success, bytes memory returnData) = address(titanToken).call(abi.encodeWithSignature("balanceOf(address)",address(this)));
        
        uint256 anyFunds = myToken.balanceOf(address(this));
        
        if(uint256(anyFunds) != 0) {
            return uint256(anyFunds) - contractTotal;
        } 
        
        return uint256(anyFunds);
    }
    
    // @notice Validator can request the funds to be released once determined it's safe to do.
    // @dev Function makes sure the contract was fully funded by checking the State and if so, release the funds to the seller.
    // sends lumerin tokens to the appropriate entities. _buyer will obtain a 0 value unless theres a penalty involved
    function withdrawFunds(uint _seller, uint _buyer) internal {
        
        if(currentState != State.FUNDED) { 
            emit dataEvent(block.timestamp, 'Error, not fully funded!');  
            
        } else { 
            //address(titanToken).call(abi.encodeWithSignature("transfer(address,address)",escrow_seller, _seller));
            //address(titanToken).call(abi.encodeWithSignature("transfer(address,address)",escrow_purchaser, _buyer));
            myToken.transfer(escrow_seller, _seller);
            myToken.transfer(escrow_purchaser, _buyer);
            currentState = State.COMPLETE; 
            emit dataEvent(block.timestamp, 'Contract Completed');
            
        }
    }
}
