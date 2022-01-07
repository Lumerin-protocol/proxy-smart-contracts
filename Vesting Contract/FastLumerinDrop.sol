pragma solidity ^0.8.7;
// SPDX-License-Identifier: MIT
/**
 * @title Contract for Fast Lumerin Token Widthdrawl
 *
 * @notice ERC20 support for beneficiary wallets to quickly obtain Tokens without following vesting schedule.
 *
 * @author Lance Seidman (Titan Mining/Lumerin Protocol)
*/

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FastLumerinDrop {
    address public owner;
    uint256 public balance;
    IERC20 Lumerin = IERC20(0x162ec44F7B0aF0A02F45258DCd177Ec329d9d4bA);
    
    event TransferReceived(address _from, uint _amount);
    event TransferSent(address _from, address _destAddr, uint _amount);
    
    constructor() {
        owner = msg.sender;
    }
    
    receive() payable external {
        balance += msg.value;
        emit TransferReceived(msg.sender, msg.value);
    }    
    
    function withdraw(uint amount, address payable destAddr) public {
        require(msg.sender == owner, "Sorry, only the Vesting Contract Owner can do this!"); 
        require(amount <= balance, "Yikes! Not enough Tokens!");
        
        destAddr.transfer(amount);
        balance -= amount;
        emit TransferSent(msg.sender, destAddr, amount);
    }

    function VestingTokenBalance() view public returns (uint) {
        return Lumerin.balanceOf(address(this));
    }
    
    function TransferLumerin(address to, uint256 amount) public {
        require(msg.sender == owner, "Vesting Contract Owner can transfer Tokens, not you!"); 
        uint256 LumerinBalance = Lumerin.balanceOf(address(this));
        require(amount <= LumerinBalance, "Token balance is low!");
        Lumerin.transfer(to, amount);
        emit TransferSent(msg.sender, to, amount);
    }    
}
