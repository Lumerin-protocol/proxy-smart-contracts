// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Ownable} from "@openzeppelin/contracts-v5/access/Ownable.sol";

contract HashrateOracle is Ownable {
    AggregatorV3Interface public btcTokenOracle;
    uint256 public difficulty = 0;
    uint256 public blockReward = 0;

    uint256 public constant TERA = 10 ** 12;
    uint256 public constant DIFFICULTY_TO_HASHRATE_FACTOR = 2 ** 32;

    event DifficultyUpdated(uint256 newDifficulty);
    event BlockRewardUpdated(uint256 newBlockReward);

    error ValueCannotBeZero();

    constructor(address btcTokenOracleAddress) Ownable(msg.sender) {
        btcTokenOracle = AggregatorV3Interface(btcTokenOracleAddress);
    }

    function getDifficulty() public view returns (uint256) {
        return difficulty;
    }

    function getBlockReward() public view returns (uint256) {
        return blockReward;
    }

    function getRewardPerTHinBTC() public view returns (uint256) {
        return blockReward * TERA / difficulty / DIFFICULTY_TO_HASHRATE_FACTOR;
    }

    function getRewardPerTHinToken() public view returns (uint256) {
        (, int256 answer,,,) = btcTokenOracle.latestRoundData();
        return getRewardPerTHinBTC() * uint256(answer);
    }

    function setDifficulty(uint256 newDifficulty) public onlyOwner {
        if (newDifficulty == 0) revert ValueCannotBeZero();
        if (newDifficulty != difficulty) {
            difficulty = newDifficulty;
            emit DifficultyUpdated(newDifficulty);
        }
    }

    function setBlockReward(uint256 newBlockReward) public onlyOwner {
        if (newBlockReward == 0) revert ValueCannotBeZero();
        if (newBlockReward != blockReward) {
            blockReward = newBlockReward;
            emit BlockRewardUpdated(newBlockReward);
        }
    }
}
