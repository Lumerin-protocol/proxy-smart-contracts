// SPDX-License-Identifier: MIT
/*
Author: Josh Kean - Titan Mining
Date: 04-29-2022

This is a vesting contract to release funds to the Lumerin Token holders
It assumes monthly cliffs and multiple users from multiple tranches
*/

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./VestingWalletMulti.sol";

contract LumerinVestingMulti is VestingWalletMulti {
    //will have 4 dates of 5/28, 6/28, 7/28, and 8/28
    uint256[] vestingTranche1 = [1_653_760_800, 1_656_439_200, 1_659_031_200, 1_661_709_600];
    //will only have 1 date of 5/28
    uint256[] vestingTranche2 = [1_653_760_800];
    //vests from 6/28/22 to 5/28/23
    uint256[] vestingSeed = [
        1_656_439_200,
        1_659_031_200,
        1_661_709_600,
        1_664_388_000,
        1_666_980_000,
        1_669_662_000,
        1_672_254_000,
        1_674_932_400,
        1_677_610_800,
        1_680_026_400,
        1_682_704_800,
        1_685_296_800
    ];
    //vests from 9/28/22 to 8/28/24
    uint256[] vestingCorporate = [
        1_664_388_000,
        1_666_980_000,
        1_669_662_000,
        1_672_254_000,
        1_674_932_400,
        1_677_610_800,
        1_680_026_400,
        1_682_704_800,
        1_685_296_800,
        1_687_975_200,
        1_690_567_200,
        1_693_245_600,
        1_695_924_000,
        1_698_516_000,
        1_701_198_000,
        1_703_790_000,
        1_706_468_400,
        1_709_146_800,
        1_711_648_800,
        1_714_327_200,
        1_716_919_200,
        1_719_597_600,
        1_722_189_600,
        1_724_868_000
    ];
    address lumerin = address(0x4b1D0b9F081468D780Ca1d5d79132b64301085d1);
    address owner;
    address titanMuSig = address(0x5846f9a299e78B78B9e4104b5a10E3915a0fAe3D);
    address bloqMuSig = address(0x6161eF0ce79322082A51b34Def2bCd0b0B8062d9);

    constructor() VestingWalletMulti(lumerin) {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(
            msg.sender == owner || msg.sender == titanMuSig || msg.sender == bloqMuSig,
            "you are not authorized to call this function"
        );
        _;
    }

    // add only owner modifier
    function setAddAddressToVestingSchedule(address _claiment, uint8 _vestingMonths, uint256 _vestingAmount)
        public
        onlyOwner
    {
        _erc20VestingAmount[_claiment] = _vestingAmount;
        _erc20Released[_claiment] = 0;
        _whichVestingSchedule[_claiment] = _vestingMonths;
        _isVesting[_claiment] = false;
    }

    function setAddMultiAddressToVestingSchedule(
        address[] memory _claiment,
        uint8[] memory _vestingMonths,
        uint256[] memory _vestingAmount
    ) public onlyOwner {
        for (uint256 i = 0; i < _claiment.length; i++) {
            setAddAddressToVestingSchedule(_claiment[i], _vestingMonths[i], _vestingAmount[i]);
        }
    }

    function Claim() public {
        release();
    }

    function _vestingSchedule(uint256 _totalAllocation, uint64 timestamp) internal view override returns (uint256) {
        require(_isVesting[msg.sender] == false, "vesting in progress");
        uint256[] memory tempVesting;
        //determening which vesting array to use
        if (_whichVestingSchedule[msg.sender] == 1) {
            tempVesting = vestingTranche1;
        } else if (_whichVestingSchedule[msg.sender] == 2) {
            tempVesting = vestingTranche2;
        } else if (_whichVestingSchedule[msg.sender] == 3) {
            tempVesting = vestingSeed;
        } else if (_whichVestingSchedule[msg.sender] == 4) {
            tempVesting = vestingCorporate;
        }
        if (timestamp < tempVesting[0]) {
            return 0;
        } else if (timestamp >= tempVesting[tempVesting.length - 1]) {
            return _totalAllocation;
        } else {
            //modifying to use the ratio of months passed instead of a slow drip
            uint256 currentMonthTemp = 0;
            while (currentMonthTemp < tempVesting.length && timestamp >= tempVesting[currentMonthTemp]) {
                currentMonthTemp++;
            }
            return (_totalAllocation * currentMonthTemp) / tempVesting.length;
        }
    }

    //administrative functions

    //used to ensure lumerin can't be locked up in the contract
    function transferLumerinOut(address _recipient, uint256 _value) public onlyOwner {
        SafeERC20.safeTransfer(IERC20(lumerin), _recipient, _value);
    }

    function zeroOutClaimentValues(address _claiment) public onlyOwner {
        _erc20VestingAmount[_claiment] = 0;
        _erc20Released[_claiment] = 0;
    }

    function obtainVestingInformation(address _claiment) public view returns (uint256[2] memory) {
        //index 0 returns the claimable amount
        //index 1 returns the value remaining to be vested
        uint256 releaseableAmount = vestedAmount(_claiment, uint64(block.timestamp)) - released();
        uint256 remaining = _erc20VestingAmount[_claiment] - _erc20Released[_claiment];
        uint256[2] memory data = [releaseableAmount, remaining];
        return data;
    }
}
