// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Marketplace Escrow
/// @author Lance Seidman (Lumerin)
/// @notice This first version will be used to hold lumerin temporarily for the Marketplace Hash Rental.

import "./LumerinToken.sol";


contract Escrow {
    

    address public escrow_purchaser; // Entity making a payment...
    address public escrow_seller;  // Entity to receive funds...
    address titanToken;
    uint256 public contractTotal; // How much should be escrowed...
    uint256 public receivedTotal; // Optional; Keep a balance for how much has been received...
    Lumerin myToken;
    
    //internal function which will be called by the hashrate contract
    function setParameters(address _titanToken) internal { 
        titanToken = _titanToken;
        myToken = Lumerin(titanToken);
    }

    // @notice This will create a new escrow based on the seller, buyer, and total.
    // @dev Call this in order to make a new contract. Potentially this will have a database within the contract to store/call by 
    //      the validator ONLY.
    function createEscrow(address _escrow_seller, address _escrow_purchaser, uint256 _lumerinTotal) internal {
        escrow_seller = _escrow_seller;
        escrow_purchaser = _escrow_purchaser;
        contractTotal = _lumerinTotal;
    }

    
    // @notice Find out how much is left to fullfill the Escrow to say it's funded.
    // @dev This is used to determine if the contract amount has been fullfilled and return how much is left to be fullfilled. 
    function dueAmount() internal returns (uint256) {
       if (myToken.balanceOf(address(this)) > contractTotal ) {
		myToken.transfer(escrow_purchaser, myToken.balanceOf(address(this)) - contractTotal); 
		return 0;
       }
       return contractTotal - myToken.balanceOf(address(this));
    }
    
    // @notice Validator can request the funds to be released once determined it's safe to do.
    // @dev Function makes sure the contract was fully funded by checking the State and if so, release the funds to the seller.
    // sends lumerin tokens to the appropriate entities. _buyer will obtain a 0 value unless theres a penalty involved
    function withdrawFunds(uint _seller, uint _buyer) internal {
            myToken.transfer(escrow_seller, _seller);
            myToken.transfer(escrow_purchaser, _buyer);
    }
}
