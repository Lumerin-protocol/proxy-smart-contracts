//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EC} from "./EC.sol";
import {ValidatorRegistry} from "./ValidatorRegistry.sol";

contract ValidatorRegistryEC is ValidatorRegistry, EC {
    event ValidatorRegisteredPubkey(address indexed addr, uint[2] pubkey);

    struct EncryptionKeys {
        uint[2] pubkey;
        uint[2][] sessionKeys;
        bytes32 checksum;
    }

    struct Buyer {
        uint[2] pubkey;
    }

    mapping(address => EncryptionKeys) public encryptionKeys;
    Buyer private buyer;
    bool public use_encryption = true; // whether or not to encrypt

    function setUseEncryption(bool val) public onlyOwner {
        use_encryption = val;
    }

    function validator_register(
        string calldata url,
        uint256 stake,
        uint[2] calldata pubkey
    ) public {
        super.validatorRegister(stake, url);
        // emits ValidatorRegistered(addr, url, pubkey);
        // ^^ exisitng validators should listen for this event and call encrypt to reencrypt their url

        if (use_encryption) {
            encrypt(bytes(url), _msgSender());
        }
        emit ValidatorRegisteredPubkey(_msgSender(), pubkey);
    }

    function encrypt(bytes calldata url, address validatorAddress) private {
        require(url.length > 0, "empty url, cannot encrypt");
        uint r = uint(
            keccak256(abi.encodePacked(url, block.timestamp, block.prevrandao))
        );
        (uint rx, ) = publicKey(r);
        uint[2][] memory sessionKeys;
        for (uint i = 0; i < validatorsLength(); i++) {
            EncryptionKeys storage w = validatorEncryptionKeysByIndex(i);
            if (w.pubkey[0] == 0 || w.pubkey[1] == 0) continue;
            (uint sx, uint sy) = ecmul(w.pubkey[0], w.pubkey[1], r);
            sessionKeys[i] = [sx, sy];
            if (
                i == validatorsLength() - 1 &&
                buyer.pubkey[0] != 0 &&
                buyer.pubkey[1] != 0
            ) {
                (uint bx, uint by) = ecmul(buyer.pubkey[0], buyer.pubkey[1], r);
                sessionKeys[validatorsLength()] = [bx, by];
            }
        }

        EncryptionKeys storage v = validatorEncryptionKeys(validatorAddress);
        v.sessionKeys = sessionKeys;
        v.checksum = keccak256(url);

        validators[validatorAddress].host = string(exor(url, bytes32(rx)));
    }

    function exor(
        bytes memory data,
        bytes32 key
    ) internal pure returns (bytes memory edata) {
        edata = data;
        for (uint i = 0; i < data.length; i++) {
            edata[i] = data[i] ^ key[i % 32];
        }
    }

    function validatorEncryptionKeys(
        address addr
    ) internal view returns (EncryptionKeys storage) {
        return encryptionKeys[addr];
    }

    function validatorEncryptionKeysByIndex(
        uint index
    ) internal view returns (EncryptionKeys storage) {
        return encryptionKeys[getValidators(index, 1)[0]];
    }
}
