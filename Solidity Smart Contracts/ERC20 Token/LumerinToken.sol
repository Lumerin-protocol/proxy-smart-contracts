// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "./@openzeppelin/openzeppelin-contracts-upgradeable/blob/release-v4.2/contracts/token/ERC20/ERC20Upgradeable.sol";
import "./@openzeppelin/openzeppelin-contracts-upgradeable/blob/release-v4.2/contracts/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "./@openzeppelin/openzeppelin-contracts-upgradeable/blob/release-v4.2/contracts/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "./@openzeppelin/openzeppelin-contracts-upgradeable/blob/release-v4.2/contracts/security/PausableUpgradeable.sol";
import "./@openzeppelin/openzeppelin-contracts-upgradeable/blob/release-v4.2/contracts/access/OwnableUpgradeable.sol";
import "./@openzeppelin/openzeppelin-contracts-upgradeable/blob/release-v4.2/contracts/proxy/utils/Initializable.sol";

contract LumerinToken is Initializable, ERC20Upgradeable, ERC20BurnableUpgradeable, PausableUpgradeable, OwnableUpgradeable {

    function initialize() public initializer {
        __ERC20_init("Lumerin","LMR");
        __ERC20Burnable_init();
        __Pausable_init();
        __Ownable_init();
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    
    function _beforeTokenTransfer(address from, address to, uint256 amount) internal whenNotPaused override
    {
        super._beforeTokenTransfer(from, to, amount);
    }
    
}
