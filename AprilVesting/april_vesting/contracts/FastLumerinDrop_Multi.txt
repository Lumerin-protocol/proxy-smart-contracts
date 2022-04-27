// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0; 
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.3/contracts/token/ERC20/IERC20.sol";
import "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/release-v4.3/contracts/token/ERC20/utils/SafeERC20.sol";

contract FastLumerinDrop_Multi {
    using SafeERC20 for IERC20;
    address public owner;
    IERC20 Lumerin = IERC20(0xA24eCB5873D9dc76bA1cFED82B2A61831375AC72);

    event TransferReceived(address _from, uint _amount);
    event TransferSent(address _from, address _destAddr, uint _amount);
    event MSG(string _message);

    struct Whitelist {
        address wallet;
        uint qty;
    }
    mapping(address => Whitelist) public whitelist;

    constructor() {
        owner = msg.sender;                                                                                                                                                                                       
    }
    modifier onlyOwner() {
      require(msg.sender == owner, "Sorry, only owner of this contract can perform this task!");
      _;
    }
    receive() payable external {
        emit TransferReceived(msg.sender, msg.value);
    }    
    function addMultiWallet (address[] memory walletAddr, uint[] memory _qty) external onlyOwner {
        for (uint i=0; i< walletAddr.length; i++) {
            whitelist[walletAddr[i]].wallet = walletAddr[i]; 
            whitelist[walletAddr[i]].qty = _qty[i]; 
        }
    }
    function checkWallet (address walletAddress) external view returns (bool status) {
        if(whitelist[walletAddress].wallet == walletAddress) {
            status = true;
        }
        return status;
    }
    function VestingTokenBalance() view public returns (uint) {
        return Lumerin.balanceOf(address(this));
    }

    function multiSendFixedTokenFromContract(address[] memory recipients, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < recipients.length; i++) {
            Lumerin.safeTransfer(recipients[i], amount);
        }
    } 
}
