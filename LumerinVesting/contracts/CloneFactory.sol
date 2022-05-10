pragma solidity >=0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "hardhat/console.sol";
import "./VestingWalletClone.sol";

contract CloneFactory {
	address vestingBaseDeployment;
	address lumerin;
	mapping(address => address) vestingWalletAddress;

	constructor(address _lumerin) {
		LumerinVestingClone _lvc = new LumerinVestingClone();
		vestingBaseDeployment = address(_lvc);
		lumerin = _lumerin;
	}

	function getVestingWalletAddress(address _claiment)
		public
		view
		returns (address)
	{
		return vestingWalletAddress[_claiment];
	}

	function setCreateNewVestingWallet(
		address claiment,
		uint256 vestingAmount,
		uint256[] memory _vestingMonths
	) public {
		address _newWallet = Clones.clone(vestingBaseDeployment);
		uint256 _start = _vestingMonths[0];
		uint256 _duration = _vestingMonths[_vestingMonths.length - 1] -
			_vestingMonths[0];
		LumerinVestingClone(_newWallet).initialize(
			claiment,
			lumerin,
			vestingAmount,
			_vestingMonths,
			uint64(_start),
			uint64(_duration)
		);
		vestingWalletAddress[claiment] = _newWallet;
	}
}

contract LumerinVestingClone is Initializable, VestingWalletPublic {
	uint256[] vestingMonths;
	uint256 totalAllocation;
	address claiment;
	address lumerin;

	function initialize(
		address _claiment,
		address _lumerin,
		uint256 _totalAllocation,
		uint256[] memory _vestingMonths,
		uint64 _start,
		uint64 _duration
	) public initializer {
		claiment = _claiment;
		lumerin = _lumerin;
		totalAllocation = _totalAllocation;
		vestingMonths = _vestingMonths;
		walletInitialize(_claiment, _start, _duration);
	}

	//test function to replace block.timestamp with provided input. not to be used on final contract
	function releaseTest(uint256 _time) public {
		uint256 releasable = vestedAmount(lumerin, uint64(_time)) -
			released(lumerin);
		_erc20Released[lumerin] += releasable;
		emit ERC20Released(lumerin, releasable);
		SafeERC20.safeTransfer(
			IERC20(lumerin),
			beneficiary(),
			releasable
		);
	}

	function _vestingSchedule(uint256 _totalAllocation, uint64 timestamp)
		internal
		view
		override
		returns (uint256)
	{
		if (timestamp < start()) {
			return 0;
		} else if (timestamp >= start() + duration()) {
			return _totalAllocation;
		} else {
			//modifying to use the ratio of months passed instead of a slow drip
			uint256 currentMonthTemp = 0;
			while (
				currentMonthTemp < vestingMonths.length &&
				timestamp >= vestingMonths[currentMonthTemp]
			) {
				currentMonthTemp++;
			}

			return
				(_totalAllocation * currentMonthTemp) /
				vestingMonths.length;
		}
	}
}
