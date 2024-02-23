//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EC} from "./EC.sol";

contract ValidatorRegistry is Initializable, EC {

    address public owner;
    uint public stake_minimum = 1; // minimum stake to be considered usable
    uint public stake_register = 10; // amount needed to register as a validator
    uint public punish_amount = 1; // how much to punish by
    uint public pubish_threshold = 3; // how many votes before punishment
    Validator[] public validators; // our list of validators

    struct Validator {
        address addr;
        bytes url;
        uint last_seen;
        uint stake;
        uint index;
        uint votes;
        address last_punisher;
        uint[2] pubkey;
        uint[2][] sessionKeys;
        bytes32 checksum;
    }

    modifier onlyOwner()
    {
        require(msg.sender == owner, "you are not authorized");
        _;
    }

    modifier onlyOwnerOrValidator()
    {
        bool found = false;
        for (uint i=0; i<validators.length; i++) {
            if (msg.sender == validators[i].addr) {
                found = true;
                break;
            }
        }
        require(found || msg.sender == owner, "you are not authorized");
        _;
    }

    event ValidatorRegistered(Validator v);

    function initialize() public initializer
    {
        owner = msg.sender;
    }

    function setStakeMinimum(uint val) public onlyOwner
    {
        stake_minimum = val;
    }

    function setStakeRegister(uint val) public onlyOwner
    {
        stake_register = val;
    }

    function setPunishAmount(uint val) public onlyOwner
    {
        punish_amount = val;
    }

    function validator_register(bytes calldata url, address addr, uint[2] calldata pubkey)
        public payable
    {
        // add to list of validators and escrow the stake
        require(msg.value >= stake_register, "not staking enough");
        require(msg.sender == addr, "can only register self");
        (Validator memory v, bool found) = validator_find(url, addr);
        uint[2][] memory sks;
        if (!found) {
            v = Validator(addr, url, block.timestamp, 0, 0, 0, address(0), pubkey, sks, 0);
            v.index = validators.length;
            validators.push(v);
        }
        stake_add(v);
        encrypt(url, v);
        emit ValidatorRegistered(v);
        // ^^ exisitng validators should listen for this and call encrypt to reencrypt their url
    }

    function validator_deregister(bytes calldata url, address addr) public {
        // remove validator from registry
        require(msg.sender == addr, "can only deregister self");
        (Validator memory v, bool found) = validator_find(url, addr);
        require(found, "cannot find validator");
        stake_refund(v);
    }

    function validator_find(bytes calldata url, address addr)
        public view returns (Validator memory, bool)
    {
        // find validator by url and address...
        Validator memory v;
        bool found;
        for (uint i=0; i<validators.length; i++) {
            Validator storage e = validators[i];
            if (keccak256(abi.encodePacked(e.url)) == keccak256(abi.encodePacked(url))
                && e.addr == addr) {
                v = e;
                found = true;
                break;
            }
        }
        return (v, found);
    }

    function validator_random_staked()
        public view returns(Validator memory, bool)
    {
        // select a pseudo random validator from all validators that have a remaining stake
        require(validators.length > 0, "no validators registered");
        Validator memory v;
        int trys = int(validators.length);
        bool found = false;
        while (trys-- > 0) {
            uint r = (block.timestamp + uint(trys)) % validators.length;
            v = validators[r];
            if (v.stake >= stake_minimum) {
                found = true;
                break;
            }
        }
        if (!found) {
            uint[2] memory pk;
            uint[2][] memory sks;
            v = Validator(address(0), "", 0, 0, 0, 0, address(0), pk, sks, 0);
        }
        return (v, found);
    }

    function validator_punish(bytes calldata url, address addr)
        public onlyOwnerOrValidator
    {
        // reduce validators stake (when votes reach threshold)
        (Validator memory v, bool found) = validator_find(url, addr);
        require(found, "cannot find validator");
        require(msg.sender != v.last_punisher, "already punished");
        v.votes += 1;
        v.last_punisher = msg.sender;
        if (v.votes >= pubish_threshold) {
            if (int(v.stake) - int(punish_amount) < 0)
                v.stake = 0;
            else
                v.stake -= punish_amount;
            v.votes = 0;
        }
        validators[v.index] = v;
    }

    function stake_add(Validator memory v) public payable
    {
        // pay stake
        require(msg.value >= stake_register, "not staking enough");
        uint amount = msg.value;
        v.stake += amount;
        v.last_seen = block.timestamp;
        validators[v.index] = v;
    }

    function stake_refund(Validator memory v) internal
    {
        // send all of v.stake to v.addr...
        require(v.stake > 0, "no funds staked");
        payable(v.addr).call{value: v.stake};
        v.stake = 0;
        v.last_seen = block.timestamp;
        validators[v.index] = v;
    }

    function encxor(bytes memory data, bytes32 key)
        internal pure returns (bytes memory edata)
    {
        edata = data;
        for (uint i=0; i<data.length; i++) {
            edata[i] = data[i] ^ key[i % 32];
        }
    }

    function encrypt(bytes calldata url, Validator memory v)
        public onlyOwnerOrValidator
    {
        require(url.length > 0, "empty url, cannot encrypt");
        uint r = uint(keccak256(abi.encodePacked(url, block.timestamp, block.prevrandao)));
        (uint rx,) = publicKey(r);
        uint[2][] memory sessionKeys;
        for (uint i=0; i<validators.length; i++) {
            Validator storage w = validators[i];
            if (w.pubkey[0] == 0 || w.pubkey[1] == 0)
                continue;
            (uint sx, uint sy) = ecmul(w.pubkey[0], w.pubkey[1], r);
            sessionKeys[i] = [sx, sy];
        }
        v.sessionKeys = sessionKeys;
        v.url = encxor(url, bytes32(rx));
        v.checksum = keccak256(url);
        validators[v.index]= v;
    }
}

