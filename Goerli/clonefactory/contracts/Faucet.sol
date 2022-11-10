pragma solidity >=0.8.0;

import "./LumerinToken.sol";

contract Faucet {
    /*
       this is a token faucet
       it allows people to claim tokens in a controlled manner
       */
      address owner;
      uint public cooldownPeriod;
      uint public startOfDay;
      uint public dailyLimitCount;
      uint public txAmount;
      uint public gethAmount;
      mapping(address => uint) lastClaimed;
      Lumerin lumerin;

      constructor(address _lmr) payable {
          owner = payable(msg.sender);
          startOfDay = block.timestamp;
          dailyLimitCount = 0;
          cooldownPeriod = 24*60*60;
          lumerin = Lumerin(_lmr); //lumerin token address
          txAmount = 10*10**lumerin.decimals();
          gethAmount = 5e16;
      }

      modifier canClaim {
          require(lastClaimed[msg.sender] + cooldownPeriod <= block.timestamp, "you need to wait before claiming");
          _;
      }

      modifier onlyOwner {
        require(msg.sender == owner, "you are not authorized to call this function");
        _;
      }

      modifier dailyLimit {
        require(dailyLimitCount < 800, "the daily limit of test lumerin has been distributed");
        _;
      }

      receive() external payable {}

      //function to allow people to claim a set amount of tokens 
      //checks to make sure that they have a proof of existance token
      //checks to make sure they haven't claime in the cooldown period
      function claim() public canClaim dailyLimit {
          lumerin.transfer(msg.sender, txAmount);
          payable(msg.sender).transfer(gethAmount);//sends amount in wei to recipient
          lastClaimed[msg.sender] = block.timestamp;
          dailyLimitCount = dailyLimitCount + 10;
          refreshDailyLimit();
      }

      //allows the owner of this contract to send tokens to the claiment
      function supervisedClaim(address _claiment) public onlyOwner dailyLimit {
          require(lastClaimed[_claiment] + cooldownPeriod <= block.timestamp, "you need to wait before claiming");
          lumerin.transfer(_claiment, txAmount);
          payable(_claiment).transfer(gethAmount);//sends amount in wei to recipient
          lastClaimed[_claiment] = block.timestamp;
          dailyLimitCount = dailyLimitCount + 10;
          refreshDailyLimit();
      }

      function refreshDailyLimit() internal {
        if (startOfDay + 24*60*60 < block.timestamp) {
          startOfDay = block.timestamp;
          dailyLimitCount = 0;
        }
      }

      function setUpdateCooldownPeriod(uint _cooldownPeriod) public onlyOwner {
          cooldownPeriod = _cooldownPeriod;
      }

      function setUpdateGWEIAmount(uint _gwei) public onlyOwner {
          gethAmount = _gwei;
      }

      function setUpdateTxAmount(uint _txAmount) public onlyOwner {
          txAmount = _txAmount*10**lumerin.decimals();
      }

      function setUpdateLumerin(address _lmr) public onlyOwner {
        lumerin = Lumerin(_lmr);
      }

      function setUpdateOwner(address _newOwner) public onlyOwner {
        owner = _newOwner;
      }

      function setTransferLumerin(address _to, uint _amount) public onlyOwner {
        lumerin.transfer(_to, _amount);
      }

      function emptyGeth() public onlyOwner {
          payable(owner).transfer(address(this).balance);//sends amount in wei to recipient
      }

}
