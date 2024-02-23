//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EC} from "./EC.sol";

contract ValidatorRegistry is Initializable, EC {

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

    struct Buyer {
        address addr;
        uint[2] pubkey;
    }

    address public owner;
    Buyer private buyer;
    uint public stake_minimum = 1; // minimum stake to be considered usable
    uint public stake_register = 10; // amount needed to register as a validator
    uint public punish_amount = 1; // how much to punish by
    uint public punish_threshold = 3; // how many votes before punishment
    bool public use_encryption = false; // whether or not to encrypt
    Validator[] public validators; // our list of validators

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

    modifier onlyOwnerOrSelf(address addr)
    {
        require(msg.sender == owner || msg.sender == addr, "you are not authorized");
        _;
    }

    event ValidatorRegistered(Validator v);
    event ValidatorDeregistered(Validator v);

    function initialize(uint stakeMin, uint stakeReg, uint punishAmount, uint punishThreshold, bool enc)
        public initializer
    {
        owner = msg.sender;
        stake_minimum = stakeMin;
        stake_register = stakeReg;
        punish_amount = punishAmount;
        punish_threshold = punishThreshold;
        use_encryption = enc;
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

    function setPunishThreshold(uint val) public onlyOwner
    {
        punish_threshold = val;
    }

    function setUseEncryption(bool val) public onlyOwner
    {
        use_encryption = val;
    }

    function setBuyer(Buyer calldata val) public onlyOwner
    {
        buyer = val;
    }

    function validator_register(bytes calldata url, address addr, uint[2] calldata pubkey)
        public payable onlyOwnerOrSelf(addr)
    {
        // add to list of validators and escrow the stake
        (Validator memory v, bool found) = validator_find(url, addr);
        uint[2][] memory sks;
        if (!found) {
            require(msg.value >= stake_register, "not staking enough");
            v = Validator(addr, url, block.timestamp, 0, validators.length, 0, address(0), pubkey, sks, 0);
            validators.push(v);
        }
        v.stake += msg.value;
        v.last_seen = block.timestamp;
        validators[v.index] = v;
        if (use_encryption) {
            encrypt(url, v);
        } else {
            v.url = url;
        }
        emit ValidatorRegistered(v);
        // ^^ exisitng validators should listen for this and call encrypt to reencrypt their url
    }

    function validator_deregister(bytes calldata url, address addr)
        public onlyOwnerOrSelf(addr)
    {
        // remove validator from registry
        (Validator memory v, bool found) = validator_find(url, addr);
        require(found, "cannot find validator");
        // send all of v.stake to v.addr...
        require(v.stake > 0, "no funds staked");
        payable(v.addr).call{value: v.stake};
        v.stake = 0;
        v.last_seen = block.timestamp;
        validators[v.index] = v;
        emit ValidatorDeregistered(v);
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
        if (v.votes >= punish_threshold) {
            if (int(v.stake) - int(punish_amount) < 0)
                v.stake = 0;
            else
                v.stake -= punish_amount;
            v.votes = 0;
        }
        validators[v.index] = v;
    }

    function exor(bytes memory data, bytes32 key)
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
        require(msg.sender == v.addr, "not authorized");
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
            if (i == validators.length-1 && buyer.pubkey[0] != 0 && buyer.pubkey[1] != 0) {
                (uint bx, uint by) = ecmul(buyer.pubkey[0], buyer.pubkey[1], r);
                sessionKeys[validators.length] = [bx, by];
            }
        }
        v.sessionKeys = sessionKeys;
        v.url = exor(url, bytes32(rx));
        v.checksum = keccak256(url);
        validators[v.index]= v;
    }
}

