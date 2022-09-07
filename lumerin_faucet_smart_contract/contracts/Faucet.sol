pragma solidity >= 0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//contract must be sent lumerin from the address in the currently running faucet
contract Faucet {
    address tokenAddress = address(0x04fa90c64DAeEe83B22501c790D39B8B9f53878a);
    address proofOfExistence = address(0xE8B919615541c2Dda71EBc9d2B09E5349D3723A8); //actual address
    address owner;
    uint transferAmount = 100;
    uint cooldownPeriod = 24*60*60; //one days worth of seconds
    mapping(address => uint) claimBlock;
    ERC20 token = ERC20(tokenAddress);
    ERC20 existance = ERC20(proofOfExistence);

    constructor() {
        owner = msg.sender;
    }

    modifier timeLock() {
        require(claimBlock[msg.sender]+cooldownPeriod < block.timestamp, "not enough time has passed");
        _;
    }

    modifier isRealPerson() {
        require(existance.balanceOf(msg.sender) == 1, "you do not exist, perhaps you're a vampire?");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "you thief! keep ur dirty paws off of our administrative functions");
        _;
    }

    function withdraw() public timeLock isRealPerson{
        //send lumerin to recipient
        claimBlock[msg.sender] = block.timestamp;
        token.transfer(msg.sender, transferAmount*10**token.decimals());
    }


    //admin functions
    function changeOwner() external onlyOwner {
        owner = msg.sender;
    }

    function resetClaimBlock(address _customer) external onlyOwner {
        claimBlock[_customer] = 0;
    }

    function changeTransferAmount(uint _x) external onlyOwner {
        transferAmount = _x;
    }

    function changeCooldownTime(uint _x) external onlyOwner {
        cooldownPeriod = _x;
    }

    function changeLMRAddress(address _lumerin) external onlyOwner {
        tokenAddress = _lumerin;
        ERC20 token = ERC20(tokenAddress);
    }

    function changePOEAddress(address _poe) external onlyOwner {
        proofOfExistence = _poe;
        ERC20 existance = ERC20(proofOfExistence);
    }
}
