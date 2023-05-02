pragma solidity >=0.8.0;

import "./LumerinToken.sol";

contract Faucet {
    /*
       this is a token faucet
       it allows people to claim tokens in a controlled manner
       */
      address owner;
      uint public dayDuration;
      uint public startOfDay;
      uint public distributedTodayLmr;
      uint public dailyLimitLmr;
      uint public lmrAmount;
      uint public ethAmount;
      mapping(address => uint) lastClaimed;
      mapping(string => uint) lastClaimedIP;
      Lumerin lumerin;

      constructor(address _lmr, uint _dailyLimitLmr, uint _lmrAmount, uint _ethAmount) payable {
          owner = payable(msg.sender);
          startOfDay = block.timestamp;
          dayDuration = 24*60*60;
          
          lumerin = Lumerin(_lmr);
          distributedTodayLmr = 0;
          dailyLimitLmr = _dailyLimitLmr;
          lmrAmount = _lmrAmount;
          ethAmount = _ethAmount;
      }

      modifier onlyOwner {
        require(msg.sender == owner, "you are not authorized to call this function");
        _;
      }

      modifier dailyLimitLmrModifier {
        require(distributedTodayLmr < dailyLimitLmr, "the daily limit of test lumerin has been distributed");
        _;
      }

      receive() external payable {}

      //allows the owner of this contract to send tokens to the claiment
      function supervisedClaim(address _claiment, string calldata _ipAddress) public onlyOwner dailyLimitLmrModifier {
          require(canClaimTokens(_claiment, _ipAddress), "you need to wait before claiming");

          lastClaimed[_claiment] = block.timestamp;
          lastClaimedIP[_ipAddress] = block.timestamp;
          distributedTodayLmr = distributedTodayLmr + lmrAmount;
          refreshDailyLimitLmr();

          lumerin.transfer(_claiment, lmrAmount);
          payable(_claiment).transfer(ethAmount); //sends amount in wei to recipient
      }

      function refreshDailyLimitLmr() internal {
        if (startOfDay + dayDuration < block.timestamp) {
          startOfDay = block.timestamp;
          distributedTodayLmr = 0;
        }
      }

      function setUpdateEthAmount(uint _ethAmount) public onlyOwner {
          ethAmount = _ethAmount;
      }

      function setUpdateLmrAmount(uint _lmrAmount) public onlyOwner {
          lmrAmount = _lmrAmount;
      }

      function setUpdateDailyLimitLmr(uint _dailyLimitLmr) public onlyOwner {
          dailyLimitLmr = _dailyLimitLmr;
      }

      function resetDistributedTodayLmr() public onlyOwner {
          startOfDay = block.timestamp;
          distributedTodayLmr = 0;
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
          payable(owner).transfer(address(this).balance); //sends amount in wei to recipient
      }

      function canClaimTokens(address _address, string calldata _ipAddress) public view returns (bool) {
          return lastClaimed[_address] + dayDuration <= block.timestamp
            && lastClaimedIP[_ipAddress] + dayDuration <= block.timestamp;
      }
}
