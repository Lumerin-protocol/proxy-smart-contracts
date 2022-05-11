// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts v4.4.0 (finance/VestingWallet.sol)
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title VestingWallet
 * @dev This contract handles the vesting of Eth and ERC20 tokens for a given beneficiary. Custody of multiple tokens
 * can be given to this contract, which will release the token to the beneficiary following a given vesting schedule.
 * The vesting schedule is customizable through the {vestedAmount} function.
 *
 * Any token transferred to this contract will follow the vesting schedule as if they were locked from the beginning.
 * Consequently, if the vesting has already started, any amount of tokens sent to this contract will (at least partly)
 * be immediately releasable.


modified to use an array of addresses and perform all operations from this single contract without any inheritance
 */
contract VestingWalletMulti is Context {
    event EtherReleased(uint256 amount);
    event ERC20Released(address indexed token, uint256 amount);

    uint256 private _released;
    //changed mapping to be public for testing
    mapping(address => uint256) _erc20Released;
    mapping(address => uint256) _erc20VestingAllocation;
    mapping(address => uint64) _getTimeStamp;
    mapping(address => uint64) _getDuration;
    mapping(address => uint8) _getTranche; //0 if tranche1, 1 if tranch2, etc
    mapping(address => bool) _isVesting;
    address lumerinAddress;
    uint[] vestingScheduleTranche1;
    uint[] vestingScheduleTranche2;

    /*
     */
    constructor(
	    address _lumerin,
	    uint[] memory _tranche1,
	    uint[] memory _tranche2
    ) {
	    lumerinAddress = _lumerin;
	    vestingScheduleTranche1 = _tranche1;
	    vestingScheduleTranche2 = _tranche2;
    }

    //function to add individual to the vesting contracrt
    function setAddIndividualToVesting(
	    address _claiment, 
	    uint _claimAmount, 
	    uint8 _vestingTranche
    ) public {
	    _erc20Released[_claiment] = 0;
	    _erc20VestingAllocation[_claiment] = _claimAmount;
	    _getTranche[_claiment] = _vestingTranche;
	    _isVesting[_claiment] = false;
	    uint[] memory tranche;
	    if (_vestingTranche == 0) {
		    tranche = vestingScheduleTranche1;
	    } else {
		    tranche = vestingScheduleTranche2;
	    }
	    uint _start = tranche[0];
	    uint _duration = tranche[tranche.length-1]-_start;
	    _getTimeStamp[_claiment] = uint64(_start);
	    _getDuration[_claiment] = uint64(_duration);
    }

    /**
     * @dev Amount of token already released
     */
    function released(address _claiment) public view virtual returns (uint256) {
        return _erc20Released[_claiment];
    }

    /**
     * @dev Release the tokens that have already vested.
     *
     * Emits a {TokensReleased} event.
     */
    function release() public virtual {
	    address _claiment = msg.sender;
	    require(_isVesting[_claiment] != true, "currently claiming");
	    _isVesting[_claiment] = true;
        uint256 releasable = vestedAmount(_claiment, uint64(block.timestamp)) - released(_claiment);
        _erc20Released[_claiment] += releasable;
        emit ERC20Released(_claiment, releasable);
        SafeERC20.safeTransfer(IERC20(lumerinAddress), _claiment, releasable);
	    _isVesting[_claiment] = false;
    }

    /**
     * @dev Calculates the amount of tokens that has already vested. Default implementation is a linear vesting curve.
     */
    function vestedAmount(address _claiment, uint64 timestamp) public view virtual returns (uint256) {
        return _vestingSchedule(IERC20(lumerinAddress).balanceOf(_claiment) + released(lumerinAddress), timestamp, _claiment);
    }

    /**
     * @dev Virtual implementation of the vesting formula. This returns the amout vested, as a function of time, for
     * an asset given its total historical allocation.
     */
    function _vestingSchedule(uint256 totalAllocation, uint64 timestamp, address _claiment) internal view virtual returns (uint256) {
        if (timestamp < _getTimeStamp[_claiment]) {
            return 0;
        } else if (timestamp > _getTimeStamp[_claiment] + _getDuration[_claiment]) {
            return totalAllocation;
        } else {
            return (totalAllocation * (timestamp - _getTimeStamp[_claiment])) / _getDuration[_claiment];
        }
    }


}
