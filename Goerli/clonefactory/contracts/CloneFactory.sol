//SPDX-License-Identifier: MIT

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Implementation.sol";
import "./LumerinToken.sol";

/// @title CloneFactory
/// @author Josh Kean (Lumerin)
/// @notice Variables passed into contract initializer are subject to change based on the design of the hashrate contract


//CloneFactory now responsible for minting, purchasing, and tracking contracts
contract CloneFactory {
    address baseImplementation;
    address validator;
    address lmnDeploy;
    address webfacingAddress;
    address owner;
    address[] public rentalContracts; //dynamically allocated list of rental contracts
    bool noMoreWhitelist;
    Lumerin lumerin;
    mapping(address => bool) public whitelist; //whitelisting of seller addresses //temp public for testing

    constructor(address _lmn, address _validator) {
        Implementation _imp = new Implementation();
        baseImplementation = address(_imp);
        lmnDeploy = _lmn; //deployed address of lumeirn token
        validator = _validator;
        lumerin = Lumerin(_lmn);
        owner = msg.sender;
        noMoreWhitelist = false;
    }

    event contractCreated(address indexed _address, string _pubkey); //emitted whenever a contract is created
    event clonefactoryContractPurchased(address indexed _address); //emitted whenever a contract is purchased

    modifier onlyOwner() {
        require(msg.sender == owner, "you are not authorized");
        _;
    }

    modifier onlyInWhitelist() {
        require(whitelist[msg.sender] == true || noMoreWhitelist == true, "you are not an approved seller on this marketplace");
        _;
    }

    //function to create a new Implementation contract
    function setCreateNewRentalContract (
        uint256 _price,
        uint256 _limit,
        uint256 _speed,
        uint256 _length,
        address _validator,
        string memory _pubKey
    ) onlyInWhitelist external returns (address) {
        address _newContract = Clones.clone(baseImplementation);
        Implementation(_newContract).initialize(
            _price,
            _limit,
            _speed,
            _length,
            msg.sender,
            lmnDeploy,
            address(this),
            _validator
        );
        rentalContracts.push(_newContract); //add clone to list of contracts
        emit contractCreated(_newContract, _pubKey); //broadcasts a new contract and the pubkey to use for encryption
        return _newContract;
    }

    //function to purchase a hashrate contract
    //requires the clonefactory to be able to spend tokens on behalf of the purchaser
    function setPurchaseRentalContract (
        address contractAddress,
        string memory _cipherText
    ) external {
        Implementation targetContract = Implementation(contractAddress);
        uint256 _price = targetContract.price();
        require(
            lumerin.allowance(msg.sender, address(this)) >= _price,
            "not authorized to spend required funds"
        );
        bool tokensTransfered = lumerin.transferFrom(
            msg.sender,
            contractAddress,
            _price
        );
        require(tokensTransfered, "lumeirn tranfer failed");
        targetContract.setPurchaseContract(_cipherText, msg.sender);
        emit clonefactoryContractPurchased(contractAddress);
    }

    function getContractList() external view returns (address[] memory) {
        address[] memory _rentalContracts = rentalContracts;
        return _rentalContracts;
    }

    //adds an address to the whitelist
    function setAddToWhitelist(address _address) onlyOwner external {
        whitelist[_address] = true;
    }

    //remove an address from the whitelist
    function setRemoveFromWhitelist(address _address) onlyOwner external {
        whitelist[_address] = false;
    }

    function checkWhitelist(address _address) external view returns (bool) {
        return whitelist[_address];
    }

    function setChangeNoMoreWhitelist() external onlyOwner {
        noMoreWhitelist = true;
    }
}


