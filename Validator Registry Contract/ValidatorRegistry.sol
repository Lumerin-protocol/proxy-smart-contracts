//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

struct Validator {
    address addr;
    string url;
    uint last_seen;
    uint stake;
    uint index;
}

contract ValidatorRegistry is Initializable {
    address public owner;
    uint public stake_minimum = 1; // minimum stake to be considered usable
    uint public stake_register = 10; // amount needed to register as a validator
    uint public punish_amount = 1; // how much to punish by
    Validator[] public validators; // our list of validators

    modifier onlyOwner() {
        require(msg.sender == owner, "you are not authorized");
        _;
    }

    function initialize() public initializer {
        owner = msg.sender;
    }

    function setStakeMinimum(uint val) public onlyOwner {
        stake_minimum = val;
    }

    function setStakeRegister(uint val) public onlyOwner {
        stake_register = val;
    }

    function setPunishAmount(uint val) public onlyOwner {
        punish_amount = val;
    }

    function validator_register(string calldata url, address addr) public payable {
        // add to list of validators and escrow the stake
        require(msg.value >= stake_register, "not staking enough");
        require(msg.sender == addr, "can only register self");
        (Validator memory v, bool found) = validator_find(url, addr);
        if (!found) {
            v = Validator(addr, url, block.timestamp, 0, 0);
            v.index = validators.length;
            validators.push(v);
        }
        stake_add(v);
    }

    function validator_deregister(string calldata url, address addr) public {
        // remove validator from registry
        require(msg.sender == addr, "can only deregister self");
        (Validator memory v,) = validator_find(url, addr);
        stake_refund(v);
    }

    function validator_find(string calldata url, address addr) public view returns (Validator memory, bool) {
        // find validator by url and address...
        Validator memory v;
        bool found;
        for (uint i=0; i<validators.length; i++) {
            Validator storage e = validators[i];
            if (keccak256(abi.encodePacked(e.url)) == keccak256(abi.encodePacked(url))
             && keccak256(abi.encodePacked(e.addr)) == keccak256(abi.encodePacked(addr))) {
                v = e;
                found = true;
                break;
            }
        }
        return (v, found);
    }

    function validator_random_staked() public view returns(Validator memory, bool) {
        // select a pseudo random validator from all validators that have a remaining stake
        require(validators.length > 0, "no validators registered");
        Validator memory v;
        uint trys = validators.length;
        bool found = false;
        while (trys-- > 0) {
            uint r = (block.timestamp + trys) % validators.length;
            v = validators[r];
            if (v.stake >= stake_minimum) {
                found = true;
                break;
            }
        }
        if (!found)
            v = Validator(address(0),"",0,0,0);
        return (v, found);
    }

    function validator_punish(string calldata url, address addr) public onlyOwner {
        // reduce validators stake
        (Validator memory v, ) = validator_find(url, addr);
        if (int(v.stake) - int(punish_amount) < 0)
            v.stake = 0;
        else
            v.stake -= punish_amount;
        validators[v.index] = v;
    }

    function stake_add(Validator memory v) public payable {
        // pay stake
        require(msg.value >= stake_register, "not staking enough");
        uint amount = msg.value;
        v.stake += amount;
        v.last_seen = block.timestamp;
        validators[v.index] = v;
    }

    function stake_refund(Validator memory v) internal {
        // send all of v.stake to v.addr...
        require(v.stake > 0, "no funds staked");
        payable(v.addr).call{value: v.stake};
        v.stake = 0;
        v.last_seen = block.timestamp;
        validators[v.index] = v;
    }
}

