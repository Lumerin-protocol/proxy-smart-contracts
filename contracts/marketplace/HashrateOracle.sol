// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable-v5/proxy/utils/UUPSUpgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable-v5/access/OwnableUpgradeable.sol";
import { Versionable } from "../util/versionable.sol";

/// @title HashrateOracle
/// @author Oleksandr (Shev) Shevchuk (Lumerin)
/// @notice Contract for managing hashrate and mining difficulty calculations
/// @dev This contract provides functions to calculate hashrate requirements based on BTC price and mining difficulty
contract HashrateOracle is UUPSUpgradeable, OwnableUpgradeable, Versionable {
    AggregatorV3Interface public immutable btcTokenOracle;
    uint256 public immutable oracleDecimals;
    uint256 public immutable tokenDecimals;

    uint256 private difficulty = 0;
    uint256 private blockReward = 0;

    uint256 private constant DIFFICULTY_TO_HASHRATE_FACTOR = 2 ** 32;
    uint256 private constant BTC_DECIMALS = 8;
    string public constant VERSION = "2.0.2";

    event DifficultyUpdated(uint256 newDifficulty);
    event BlockRewardUpdated(uint256 newBlockReward);

    error ValueCannotBeZero();

    /// @notice Constructor for the HashrateOracle contract
    /// @param _btcTokenOracleAddress Address of the BTC price oracle
    /// @param _tokenDecimals Number of decimals for the token that we are pricing in
    constructor(address _btcTokenOracleAddress, uint8 _tokenDecimals) {
        btcTokenOracle = AggregatorV3Interface(_btcTokenOracleAddress);
        oracleDecimals = btcTokenOracle.decimals();
        tokenDecimals = _tokenDecimals;
    }

    /// @notice Initializes the contract
    function initialize() external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // Only the owner can upgrade the contract
    }

    /// @notice Returns the current mining difficulty
    function getDifficulty() external view returns (uint256) {
        return difficulty;
    }

    /// @notice Returns the current block reward
    function getBlockReward() external view returns (uint256) {
        return blockReward;
    }

    /// @notice Returns the number of hashes to mine per 1 satoshi
    function getHashesForBTC() public view returns (uint256) {
        return difficulty * DIFFICULTY_TO_HASHRATE_FACTOR / blockReward;
    }

    /// @notice Returns the number of hashes required to mine BTC equivalent of 1 token minimum denomination
    function getHashesforToken() external view returns (uint256) {
        (, int256 answer,,,) = btcTokenOracle.latestRoundData();
        return getHashesForBTC() * (10 ** (BTC_DECIMALS + oracleDecimals - tokenDecimals)) / uint256(answer);
    }

    /// @notice Updates the mining difficulty
    /// @param newDifficulty The new difficulty value
    function setDifficulty(uint256 newDifficulty) external onlyOwner {
        if (newDifficulty == 0) revert ValueCannotBeZero();
        if (newDifficulty != difficulty) {
            difficulty = newDifficulty;
            emit DifficultyUpdated(newDifficulty);
        }
    }

    /// @notice Updates the block reward
    /// @param newBlockReward The new block reward value
    function setBlockReward(uint256 newBlockReward) external onlyOwner {
        if (newBlockReward == 0) revert ValueCannotBeZero();
        if (newBlockReward != blockReward) {
            blockReward = newBlockReward;
            emit BlockRewardUpdated(newBlockReward);
        }
    }
}
