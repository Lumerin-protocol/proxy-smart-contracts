//SPDX-License-Identifier: MIT
pragma solidity >0.8.10;

pragma solidity >0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Implementation.sol";
import "./LumerinToken.sol";
import "./Common.sol";

/// @title CloneFactory
/// @author Josh Kean (Lumerin)
/// @notice Variables passed into contract initializer are subject to change based on the design of the hashrate contract

//CloneFactory now responsible for minting, purchasing, and tracking contracts
contract CloneFactory is Initializable {
    Lumerin lumerin;
    address feeRecipient; //address where the marketplace fee's are sent
    address public baseImplementation;
    address public owner;
    uint256 public buyerFeeRate; //fee to be paid to the marketplace
    uint256 public sellerFeeRate; //fee to be paid to the marketplace
    bool public noMoreWhitelist;
    address[] public rentalContracts; //dynamically allocated list of rental contracts
    mapping(address => bool) rentalContractsMap; //mapping of rental contracts to verify cheaply if implementation was created by this clonefactory


    mapping(address => bool) public whitelist; //whitelisting of seller addresses //temp public for testing
    mapping(address => bool) public isContractDead; // keeps track of contracts that are no longer valid

    event contractCreated(address indexed _address, string _pubkey); //emitted whenever a contract is created
    event clonefactoryContractPurchased(address indexed _address); //emitted whenever a contract is purchased
    event contractDeleteUpdated(address _address, bool _isDeleted); //emitted whenever a contract is deleted/restored

    modifier onlyOwner() {
        require(msg.sender == owner, "you are not authorized");
        _;
    }

    modifier onlyInWhitelist() {
        require(
            whitelist[msg.sender] || noMoreWhitelist,
            "you are not an approved seller on this marketplace"
        );
        _;
    }

    function initialize(address _baseImplementation, address _lumerin, address _feeRecipient) public initializer {
        lumerin = Lumerin(_lumerin);
        baseImplementation = _baseImplementation;
        
        owner = msg.sender;
        feeRecipient = _feeRecipient;

        buyerFeeRate = 100;
        sellerFeeRate = 100;
    }

    //function to create a new Implementation contract
    function setCreateNewRentalContract(
        uint256 _price,
        uint256 _limit,
        uint256 _speed,
        uint256 _length,
        address, //removed _validator
        string calldata _pubKey
    ) external onlyInWhitelist returns (address) {        
        bytes memory data = abi.encodeWithSelector(
            Implementation(address(0)).initialize.selector,
            _price,
            _limit,
            _speed,
            _length,
            msg.sender,
            address(lumerin),
            address(this),
            address(0),
            _pubKey
        );

        BeaconProxy beaconProxy = new BeaconProxy(baseImplementation, data);
        address newContractAddr = address(beaconProxy);
        rentalContracts.push(newContractAddr); //add clone to list of contracts
        rentalContractsMap[_newContract] = true;
        emit contractCreated(newContractAddr, _pubKey); //broadcasts a new contract and the pubkey to use for encryption
        return newContractAddr;
    }

    //function to purchase a hashrate contract
    //requires the clonefactory to be able to spend tokens on behalf of the purchaser
    function setPurchaseRentalContract(
        address _contractAddress,
        string calldata _cipherText
    ) external {
        // TODO: add a test case so any third-party implementations will be discarded
        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation targetContract = Implementation(_contractAddress);
        require(
            !targetContract.isDeleted(), "cannot purchase deleted contract");
        require(
            targetContract.seller() != msg.sender,
            "cannot purchase your own contract"
        );
        uint256 _price = targetContract.price();
        uint256 _marketplaceFee = _price / buyerFeeRate;

        uint256 requiredAllowance = _price + _marketplaceFee;
        uint256 actualAllowance = lumerin.allowance(msg.sender, address(this));

        require(
            actualAllowance >= requiredAllowance,
            "not authorized to spend required funds"
        );
        require(
            actualAllowance >= requiredAllowance,
            "not authorized to spend required funds"
        );
        bool tokensTransfered = lumerin.transferFrom(
            msg.sender,
            _contractAddress,
            _price
        );

        require(tokensTransfered, "lumerin transfer failed");

        bool feeTransfer = lumerin.transferFrom(
            msg.sender,
            feeRecipient,
            _marketplaceFee
        );

        require(feeTransfer, "marketplace fee not paid");
        targetContract.setPurchaseContract(
            _cipherText,
            msg.sender,
            feeRecipient,
            sellerFeeRate
        );

        emit clonefactoryContractPurchased(_contractAddress);
    }

    function getContractList() external view returns (address[] memory) {
        address[] memory _rentalContracts = rentalContracts;
        return _rentalContracts;
    }

    //adds an address to the whitelist
    function setAddToWhitelist(address _address) external onlyOwner {
        whitelist[_address] = true;
    }

    //remove an address from the whitelist
    function setRemoveFromWhitelist(address _address) external onlyOwner {
        whitelist[_address] = false;
    }

    function checkWhitelist(address _address) external view returns (bool) {
        if (noMoreWhitelist) {
            return true;
        }
        return whitelist[_address];
    }

    function setDisableWhitelist() external onlyOwner {
        noMoreWhitelist = true;
    }

    // TODO: set in constructor instead of mutating existing contract
    function setChangeSellerFeeRate(uint256 _newFee) external onlyOwner {
        sellerFeeRate = _newFee;
    }

    function setChangeBuyerFeeRate(uint256 _newFee) external onlyOwner {
        buyerFeeRate = _newFee;
    }

    function setChangeMarketplaceRecipient(
        address _newRecipient
    ) external onlyOwner {
        feeRecipient = _newRecipient;
    }

    function setContractDeleted(address _contractAddress, bool _isDeleted) public {
        require(rentalContractsMap[_contractAddress], "unknown contract address");
        Implementation _contract = Implementation(_contractAddress);
        require(msg.sender == _contract.seller() || msg.sender == owner, "you are not authorized");
        Implementation(_contractAddress).setContractDeleted(_isDeleted);
        emit contractDeleteUpdated(_contractAddress, _isDeleted);
    }
}
