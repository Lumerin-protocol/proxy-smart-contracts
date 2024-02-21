//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ValidatorRegistry is Initializable {
    struct Validator {
        bytes url;              // using bytes to minimize gas cost
        uint last_seen;
        uint stake;             // current stake in ETH
        uint listReference;     // index of the entry in the validatorList
        address last_punisher;  // last address that punished this validator
        uint8 punish_votes;     // how many votes to punish this validator has received
    }

    address public owner;
    uint public stake_minimum = 1; // minimum amount of stake in ETH to be considered usable
    uint public stake_register = 10; // amount of ETH needed to stake to register as a validator
    uint public punish_amount = 1; // how much ETH to punish by
    uint8 public punish_threshold = 3; // how many votes before punishment

    mapping (address => Validator) public validatorMap; // map of all validators
    address[] public validatorList; // list of active validators (with stake above the minimum)

    event RegistryConfigured();
    event ValidatorUpdated(address indexed validator, bool isActive);
    event ValidatorPunished(address indexed validator, bool isActive);
    event ValidatorDeregistered(address indexed validator);

    modifier onlyOwner() {
        require(msg.sender == owner, "you are not authorized");
        _;
    }

    modifier onlyOwnerOrValidator() {
        require(msg.sender == owner || validatorMap[msg.sender].stake > 0, "you are not authorized");
        _;
    }

    function initialize() public initializer {
        owner = msg.sender;
    }

    function configure(uint _stake_minimum, uint _stake_register, uint _punish_amount, uint8 _punish_threshold) public onlyOwner {
        stake_minimum = _stake_minimum;
        stake_register = _stake_register;
        punish_amount = _punish_amount;
        punish_threshold = _punish_threshold;
        emit RegistryConfigured();
    }

    // registers a new validator (consider using validator_update)
    function validator_register(bytes calldata url) public payable {
        // add to list of validators and escrow the stake
        require(msg.value >= stake_register, "not staking enough");
        
        bool found = validatorMap[msg.sender].stake > 0;
        require(!found, "validator already registered");

        validatorList.push(msg.sender);
        validatorMap[msg.sender] = Validator(url, block.timestamp, msg.value, validatorList.length, address(0), 0);
    }

    // add new validator, add more stake and/or update existing validator url
    function validator_update(bytes calldata url) public payable {
        uint newStake = validatorMap[msg.sender].stake + msg.value;
        uint stake_required = validatorMap[msg.sender].url.length > 0 ? stake_minimum : stake_register;
        require(newStake >= stake_required, "not staking enough");
        
        validatorMap[msg.sender].stake = newStake;
        validatorMap[msg.sender].url = url;
        validatorMap[msg.sender].last_seen = block.timestamp;

        if (!isActive(msg.sender)){
            validatorList.push(msg.sender);
            validatorMap[msg.sender].listReference = validatorList.length;
        }

        emit ValidatorUpdated(msg.sender, true);
    }

    // totally removes validator from the list and refunds the stake
    function validator_deregister() public {
        Validator memory v = validatorMap[msg.sender];
        require(v.stake > 0, "no funds staked");
        
        validator_delete_from_list(msg.sender);
        delete validatorMap[msg.sender];

        emit ValidatorDeregistered(msg.sender);
        
        payable(msg.sender).call{value: v.stake};
    }

    function validator_random_staked() public view returns(Validator memory, bool) {
        // select a pseudo random validator from all validators that have a remaining stake
        if (validatorList.length == 0) {
            return (Validator("", 0, 0, 0, address(0), 0), false);
        }

        uint randomIndex = uint(keccak256(abi.encodePacked(block.timestamp))) % validatorList.length;
        return (validatorMap[validatorList[randomIndex]], true);
    }

    function validator_punish(address addr) public onlyOwnerOrValidator {
        // reduce validators stake (when votes reach threshold)
        Validator memory v = validatorMap[addr];
        require(v.stake > 0, "validator not found or has no stake");
        require(v.last_punisher != msg.sender, "already punished");

        v.punish_votes += 1;
        v.last_punisher = msg.sender;
        
        if (v.punish_votes >= punish_threshold) {
            
            if (v.stake < punish_amount){
                v.stake = 0;
            } else {
                v.stake -= punish_amount;
            }
            
            if (v.stake < stake_minimum) {
                // deletes from list if stake is too low but doesn't delete the entry in the map to keep stacked value
                validator_delete_from_list(addr);
            }
            emit ValidatorPunished(addr, v.stake > stake_minimum);
            v.punish_votes = 0;
        }

        validatorMap[addr] = v;
    }

    function validator_delete_from_list(address addr) internal returns (bool success){
        if (!isActive(addr)) {
            return false;
        }
        uint rowToDelete = validatorMap[addr].listReference;
        address keyToMove = validatorList[validatorList.length-1];
        validatorList[rowToDelete] = keyToMove;
        validatorMap[keyToMove].listReference = rowToDelete;
        validatorList.pop();
        return true;
    }

    // returns true if this validator is in the list of active validators
    function isActive(address addr) public view returns(bool isIndeed) {
        if(validatorList.length == 0) return false;
        return (validatorList[validatorMap[addr].listReference] == addr);
    }
}

