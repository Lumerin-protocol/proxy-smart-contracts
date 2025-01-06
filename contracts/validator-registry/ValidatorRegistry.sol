//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// openzeppelin v4 is required to work with solarity paginator
import {Paginator} from "@solarity/solidity-lib/libs/arrays/Paginator.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
// following are openzeppelin v5 dependencies
import {Initializable} from "@openzeppelin/contracts-upgradeable-v5/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable-v5/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts-v5/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts-v5/token/ERC20/utils/SafeERC20.sol";

contract ValidatorRegistry is OwnableUpgradeable {
    using EnumerableSet for EnumerableSet.AddressSet;
    using Paginator for EnumerableSet.AddressSet;
    using SafeERC20 for IERC20;

    struct Validator {
        uint256 stake;
        address addr;
        bool pubKeyYparity; // true - even, false - odd
        address lastComplainer;
        uint8 complains;
        string host; // host:port of the validator
        bytes32 pubKeyX;
    }

    event ValidatorRegisteredUpdated(address indexed validator);
    event ValidatorDeregistered(address indexed validator);
    event ValidatorComplain(
        address indexed validator,
        address indexed complainer
    );
    event ValidatorPunished(address indexed validator);

    error Unauthorized(); // not authorized to perform this action
    error HostTooLong(); // string is too long
    error InsufficientStake(); // not enough stake to register
    error ValidatorNotFound(); // validator not found
    error AlreadyComplained(); // the last complain was made by the same address

    uint8 constant hostLengthLimit = 255; // max length of url

    IERC20 public token; // token used for staking
    uint256 public totalStake; // total amount of all collected stakes, used to avoid withdrawing all funds by owners
    uint256 public stakeMinimum; // minimum stake to be considered usable
    uint256 public stakeRegister; // amount needed to register as a validator
    uint256 public punishAmount; // how much to punish by
    uint8 public punishThreshold; // how many votes before punishment

    mapping(address => Validator) public validators;
    EnumerableSet.AddressSet internal validatorAddresses;
    EnumerableSet.AddressSet internal activeValidators;

    function initialize(
        IERC20 _token,
        uint256 _stakeMinimun,
        uint256 _stakeRegister,
        uint256 _punishAmount,
        uint8 _punishThreshold
    ) public initializer {
        __Ownable_init(_msgSender());

        token = _token;
        setStakeMinimum(_stakeMinimun);
        setStakeRegister(_stakeRegister);
        setPunishAmount(_punishAmount);
        setPunishThreshold(_punishThreshold);
    }

    /// @notice Registers validator or updates their stake and/or url
    /// @param stake amount of tokens to stake
    /// @param host the url of the validator
    function validatorRegister(
        uint256 stake,
        bytes32 pubKeyX,
        bool pubKeyYparity,
        string calldata host
    ) public {
        address addr = _msgSender();
        (Validator storage v, bool found) = validatorByAddress(addr);
        if (!found) {
            if (stake < stakeRegister) {
                revert InsufficientStake();
            }
            v.addr = addr;
            validatorAddresses.add(addr);
        }

        if (bytes(host).length > hostLengthLimit) {
            revert HostTooLong();
        }
        v.host = host;
        v.pubKeyX = pubKeyX;
        v.pubKeyYparity = pubKeyYparity;

        v.stake += stake;
        totalStake += stake;

        if (v.stake >= stakeMinimum) {
            activeValidators.add(v.addr);
        }

        emit ValidatorRegisteredUpdated(v.addr);

        if (stake > 0) {
            token.safeTransferFrom(_msgSender(), address(this), stake);
        }
    }

    /// @notice Deregister a validator and return their stake
    function validatorDeregister() public {
        address addr = _msgSender();
        (Validator storage v, bool found) = validatorByAddress(addr);
        if (!found) {
            revert ValidatorNotFound();
        }
        validatorAddresses.remove(addr);
        activeValidators.remove(addr);

        uint256 stake = v.stake;
        totalStake -= stake;

        v.stake = 0;
        v.addr = address(0);
        v.complains = 0;
        v.host = "";
        v.lastComplainer = address(0);

        emit ValidatorDeregistered(addr);

        token.safeTransfer(_msgSender(), stake);
    }

    /// @notice Complain about a validator not doing their job
    /// @dev If complaints amount reach a threshold, the validator will be punished by removing their stake
    /// @param addr validator address
    function validatorComplain(address addr) public {
        (, bool ok) = validatorByAddress(_msgSender());
        if (!ok) {
            revert Unauthorized();
        }
        if (_msgSender() == addr) {
            revert Unauthorized();
        }
        (Validator storage v, bool found) = validatorByAddress(addr);
        if (!found) {
            revert ValidatorNotFound();
        }
        if (v.lastComplainer == _msgSender()) {
            revert AlreadyComplained();
        }

        v.lastComplainer = _msgSender();
        v.complains += 1;
        if (v.complains >= punishThreshold) {
            if (punishAmount > v.stake) {
                totalStake -= v.stake;
                v.stake = 0;
            } else {
                totalStake -= punishAmount;
                v.stake -= punishAmount;
            }

            if (v.stake < stakeMinimum) {
                activeValidators.remove(v.addr);
            }
            v.complains = 0;
            emit ValidatorPunished(v.addr);
        }

        emit ValidatorComplain(v.addr, _msgSender());
    }

    /// @notice Force update of validator's active state
    /// @dev Use this function to update active state of a validator after changing minStake
    /// @dev It should be called on validators which state became inconsistent after changing minStake
    /// @param validator validator address
    function forceUpdateActive(address validator) public {
        (Validator storage v, ) = validatorByAddress(validator);
        if (v.stake >= stakeMinimum && !activeValidators.contains(v.addr)) {
            activeValidators.add(v.addr);
        } else if (activeValidators.contains(v.addr)) {
            activeValidators.remove(v.addr);
        }
    }

    // Public getter functions

    /// @notice Get validator by index
    /// @param addr validator address
    /// @return validator Validator record
    function getValidator(address addr) public view returns (Validator memory) {
        (Validator storage v, bool ok) = validatorByAddress(addr);
        if (!ok) {
            revert ValidatorNotFound();
        }
        return v;
    }

    /// @notice Get total amount of all validators
    /// @return total amount of validators
    function validatorsLength() public view returns (uint) {
        return validatorAddresses.length();
    }

    /// @notice Get amount of active validators
    /// @return total amount of active validators
    function activeValidatorsLength() public view returns (uint) {
        return activeValidators.length();
    }

    /// @notice Get validator addresses with pagination
    /// @param offset skip this many validators
    /// @param limit amount of validators to return
    /// @return addresses array of validator addresses
    function getValidators(
        uint offset,
        uint8 limit
    ) public view returns (address[] memory) {
        return validatorAddresses.part(uint256(offset), uint256(limit));
    }

    /// @notice Get active validator addresses with pagination
    /// @param offset skip this many validators
    /// @param limit amount of validators to return
    /// @return addresses array of active validator addresses
    function getActiveValidators(
        uint offset,
        uint8 limit
    ) public view returns (address[] memory) {
        return activeValidators.part(uint256(offset), uint256(limit));
    }

    // Private getter functions
    function validatorByAddress(
        address addr
    ) private view returns (Validator storage, bool) {
        Validator storage v = validators[addr];
        return (v, v.addr != address(0));
    }

    // Managing functions

    /// @notice Set minimum stake to be considered as active validator
    /// @dev Applies only to new validators or when updating stake. To update active state of all validators, use "forceUpdateActive"
    /// @param val new minimum stake
    function setStakeMinimum(uint256 val) public onlyOwner {
        stakeMinimum = val;
    }

    /// @notice Set amount needed to register as a validator
    /// @param val new register stake
    function setStakeRegister(uint256 val) public onlyOwner {
        stakeRegister = val;
    }

    /// @notice Set amount of complains needed to punish a validator
    /// @param val new amount of complains needed to reach threshold
    function setPunishThreshold(uint8 val) public onlyOwner {
        punishThreshold = val;
    }

    /// @notice Set amount of tokens to punish by
    /// @param val new punish amount
    function setPunishAmount(uint256 val) public onlyOwner {
        punishAmount = val;
    }

    /// @notice withdraw rewards collected by punishing validators
    function withdraw() public onlyOwner {
        uint256 withdrawable = token.balanceOf(address(this)) - totalStake;
        token.safeTransfer(owner(), withdrawable);
    }
}

// should we punish an inactive validator?
