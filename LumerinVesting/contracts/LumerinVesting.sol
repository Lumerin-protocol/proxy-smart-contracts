// SPDX-License-Identifier: MIT
/*
Author: Josh Kean - Titan Mining
Date: 04-29-2022

This is a vesting contract to release funds to the Lumerin Token holders
It assumes monthly cliffs and multiple users from multiple tranches
*/

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/finance/VestingWallet.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";
import "./VestingWallet.sol";


contract LumerinVestingActual is VestingWalletPublic{
	uint[] vestingMonths;
	uint totalAllocation;
	address claiment;
	address lumerin;
	constructor (
		address _claiment, 
		address _lumerin, 
		uint _totalAllocation, 
		uint[] memory _vestingMonths,
		uint _start,
		uint _duration
	) VestingWalletPublic(
	_claiment, 
	uint64(_start), 
	uint64(_duration)
	) {
		claiment = _claiment;
		lumerin = _lumerin;
		totalAllocation = _totalAllocation;
		vestingMonths = _vestingMonths;
	}



	//test function to replace block.timestamp with provided input. not to be used on final contract
	function releaseTest(uint _time) public {
		uint256 releasable = vestedAmount(lumerin, uint64(_time)) - released(lumerin);
		_erc20Released[lumerin] += releasable;
		emit ERC20Released(lumerin, releasable);
		SafeERC20.safeTransfer(IERC20(lumerin), beneficiary(), releasable);
	}

	function _vestingSchedule(uint256 _totalAllocation, uint64 timestamp) internal view override returns(uint256) {
		if (timestamp < start()) {
			return 0;
		} else if (timestamp >= start() + duration()) {
			return _totalAllocation;
		} else {
			//modifying to use the ratio of months passed instead of a slow drip
			uint currentMonthTemp = 0;
			while (currentMonthTemp < vestingMonths.length && timestamp >= vestingMonths[currentMonthTemp]) {
				currentMonthTemp++;
			}

			return
				(_totalAllocation *
					currentMonthTemp) /
				vestingMonths.length;
		}
	}
}
