// SPDX-License-Identifier: MIT
/*
Author: Josh Kean - Titan Mining
Date: 04-29-2022

This is a vesting contract to release funds to the Lumerin Token holders
It assumes monthly cliffs and multiple users from multiple tranches
*/

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "hardhat/console.sol";
import "./VestingWalletMulti.sol";


contract LumerinVestingMulti is VestingWalletMulti{
	uint[] vestingTranche1; //will have 4 dates of 5/28, 6/28, 7/28, and 8/28
	uint[] vestingTranche2; //will only have 1 date of 5/28
	uint[] vestingSeed; //vests from 6/28/22 to 5/28/23
	uint[] vestingCorporate; //vests from 9/28/22 to 8/28/24
	address lumerin;
	address owner;
	address titanMuSig = address(0x5846f9a299e78B78B9e4104b5a10E3915a0fAe3D);
	address bloqMuSig = address(0x6161eF0ce79322082A51b34Def2bCd0b0B8062d9);
	constructor (
		address _lumerin, 
		uint[] memory _vestingTranche1,
		uint[] memory _vestingTranche2,
		uint[] memory _vestingSeed,
		uint[] memory _vestingCorporate
	) VestingWalletMulti(
		lumerin
	) {
		owner = msg.sender;
		lumerin = _lumerin;
		vestingTranche1 = _vestingTranche1;
		vestingTranche2 = _vestingTranche2;
		vestingSeed = _vestingSeed;
		vestingCorporate = _vestingCorporate;
	}


	modifier onlyOwner{
		require(msg.sender == owner || msg.sender == titanMuSig || msg.sender == bloqMuSig, 'you are not authorized to call this function');
		_;
	}


	// add only owner modifier
	function setAddAddressToVestingSchedule(address _claiment, uint8 _vestingMonths, uint _vestingAmount) public onlyOwner{
		_erc20VestingAmount[_claiment] = _vestingAmount;
		_erc20Released[_claiment] = 0;
		_whichVestingSchedule[_claiment] = _vestingMonths;
		_isVesting[_claiment] = false;
	}

	function setAddMultiAddressToVestingSchedule(address[] memory _claiment, uint8[] memory _vestingMonths, uint[] memory _vestingAmount) public onlyOwner{
		for (uint i = 0; i < _claiment.length; i++) {
			setAddAddressToVestingSchedule(_claiment[i], _vestingMonths[i], _vestingAmount[i]);
		}
	}

	//test function to replace block.timestamp with provided input. not to be used on final contract
	function releaseTest(uint _time) public {
		_isVesting[msg.sender] == true;
		uint256 releasable = vestedAmount(msg.sender, uint64(_time)) - released();
		_erc20Released[msg.sender] += releasable;
		emit ERC20Released(lumerin, releasable);
		SafeERC20.safeTransfer(IERC20(lumerin), msg.sender, releasable);
		_isVesting[msg.sender] = false;
	}

	function Claim() public {
		release();
	}

	function _vestingSchedule(uint256 _totalAllocation, uint64 timestamp) internal view override returns(uint256) {
		require(_isVesting[msg.sender] == false, "vesting in progress");
		uint[] memory tempVesting;
		//determening which vesting array to use
		if (_whichVestingSchedule[msg.sender] == 1) {
			tempVesting = vestingTranche1;
		} else if (_whichVestingSchedule[msg.sender] == 2){
			tempVesting = vestingTranche2;
		} else if (_whichVestingSchedule[msg.sender] == 3){
			tempVesting = vestingSeed;
		} else if (_whichVestingSchedule[msg.sender] == 4){
			tempVesting = vestingCorporate;
		}
		if (timestamp < tempVesting[0]) {
			return 0;
		} else if (timestamp >= tempVesting[tempVesting.length-1]) {
			return _totalAllocation;
		} else {
			//modifying to use the ratio of months passed instead of a slow drip
			uint currentMonthTemp = 0;
			while (currentMonthTemp < tempVesting.length && timestamp >= tempVesting[currentMonthTemp]) {
				currentMonthTemp++;
			}
			return
				(_totalAllocation *
					currentMonthTemp) /
				tempVesting.length;
		}
	}


	//administrative functions

	//used to ensure lumerin can't be locked up in the contract
	function transferLumerinOut(address _recipient, uint _value) public onlyOwner{
		SafeERC20.safeTransfer(IERC20(lumerin), _recipient, _value);
	}

	function zeroOutClaimentValues(address _claiment) public onlyOwner{
		_erc20VestingAmount[_claiment] = 0;
		_erc20Released[_claiment] = 0;
	}

	function updateClaimentValues(address _claiment, uint _vestingAmount) public onlyOwner{
		_erc20VestingAmount[_claiment] = _vestingAmount;
	}

	function obtainVestingInformation() public view returns (uint256[3] memory) {
		uint256[3] memory data = [uint256(1),uint256(2),uint256(3)];
		return data;
	}
		

}

