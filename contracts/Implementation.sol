// SPDX-License-Identifier: MIT
pragma solidity >0.8.0;

import {ReentrancyGuardUpgradeable, Initializable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {CloneFactory} from "./CloneFactory.sol";
import {Lumerin} from "./LumerinToken.sol";

//MyToken is place holder for actual lumerin token, purely for testing purposes
contract Implementation is Initializable, ReentrancyGuardUpgradeable {
    // empty slots to align with the proxy contract, do not remove
    uint256[3] private __gap;
    Lumerin public lumerin;
    uint8 private __gap2;

    Terms public terms;
    uint256 public startingBlockTimestamp; // the timestamp of the block when the contract was purchased
    address public buyer; // address of the current purchaser of the contract
    address public seller; // address of the seller of the contract
    address public cloneFactory;
    address public validator; // address of the validator, can close out contract early, if empty - no validator (buyer node)
    string public encrValidatorURL; // if using own validator (buyer-node) this will be the encrypted buyer address. Encrypted with the seller's public key
    string public pubKey; // encrypted data for pool target info
    bool public isDeleted; // used to track if the contract is deleted, separate variable to account for the possibility of a contract being deleted when it is still running
    HistoryEntry[] public history; // TODO: replace this struct with querying logs from a blockchain node
    Terms public futureTerms;
    string public encrDestURL; // where to redirect the hashrate after validation (for both third-party validator and buyer-node) If empty, then the hashrate will be redirected to the default pool of the buyer node
    uint16 public validatorFeeRateScaled; // the fee rate for the validator, scaled by VALIDATOR_FEE_MULT
    bool public isLastValidatorNotPaid; // flag to track if the last validator has been paid

    uint16 public constant VALIDATOR_FEE_MULT = 10000;

    enum ContractState {
        Available,
        Running
    }

    enum CloseReason {
        Unspecified,
        Underdelivery,
        DestinationUnavailable,
        ShareTimeout
    }

    struct Terms {
        uint256 _price; // cost to purchase contract
        uint256 _limit; // variable used to aid in the lumerin nodes decision making // Not used anywhere
        uint256 _speed; // th/s of contract
        uint256 _length; // how long the contract will last in seconds
        uint32 _version;
        int8 _profitTarget;
    }

    struct HistoryEntry {
        bool _goodCloseout; // consider dropping and use instead _purchaseTime + _length >= _endTime
        uint256 _purchaseTime;
        uint256 _endTime;
        uint256 _price; // includes validator fee
        uint256 _speed;
        uint256 _length;
        address _buyer;
    }

    event contractPurchased(address indexed _buyer);
    event contractClosed(address indexed _buyer); // Deprecated, use closedEarly instead
    event closedEarly(CloseReason _reason);
    event purchaseInfoUpdated(address indexed _address); // emitted on either terms or futureTerms update
    event cipherTextUpdated(string newCipherText); // Deprecated, use event destinationUpdated
    event destinationUpdated(string newValidatorURL, string newDestURL);
    event fundsClaimed();
    event fundsClaimedValidator(address indexed _validator);

    function initialize(
        uint256 _price,
        uint256 _limit,
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget,
        address _seller,
        address _lmrAddress,
        address _cloneFactory, //used to restrict purchasing power to only the clonefactory
        address _validator,
        string calldata _pubKey
    ) public initializer {
        terms = Terms(_price, _limit, _speed, _length, 0, _profitTarget);
        seller = _seller;
        cloneFactory = _cloneFactory;
        pubKey = _pubKey;
        validator = _validator;
        lumerin = Lumerin(_lmrAddress);
        __ReentrancyGuard_init();
    }

    function contractState() public view returns (ContractState) {
        uint256 expirationTime = startingBlockTimestamp + terms._length;
        if (block.timestamp < expirationTime) {
            return ContractState.Running;
        }
        return ContractState.Available;
    }

    function getPublicVariables()
        public
        view
        returns (
            ContractState _state,
            uint256 _price,
            uint256 _limit,
            uint256 _speed,
            uint256 _length,
            uint256 _startingBlockTimestamp,
            address _buyer,
            address _seller,
            string memory _encryptedPoolData,
            bool _isDeleted,
            uint256 _balance,
            bool _hasFutureTerms,
            uint32 _version
        )
    {
        bool hasFutureTerms = futureTerms._length != 0;
        return (
            contractState(),
            terms._price,
            terms._limit,
            terms._speed,
            terms._length,
            startingBlockTimestamp,
            buyer,
            seller,
            encrValidatorURL,
            isDeleted,
            lumerin.balanceOf(address(this)),
            hasFutureTerms,
            terms._version
        );
    }

    function getPublicVariablesV2()
        public
        view
        returns (
            ContractState _state,
            Terms memory _terms,
            uint256 _startingBlockTimestamp,
            address _buyer,
            address _seller,
            string memory _encryptedPoolData,
            bool _isDeleted,
            uint256 _balance,
            bool _hasFutureTerms
        )
    {
        bool hasFutureTerms = futureTerms._length != 0;
        return (
            contractState(),
            terms,
            startingBlockTimestamp,
            buyer,
            seller,
            encrValidatorURL,
            isDeleted,
            lumerin.balanceOf(address(this)),
            hasFutureTerms
        );
    }

    function getHistory(
        uint256 _offset,
        uint256 _limit
    ) public view returns (HistoryEntry[] memory) {
        if (_offset > history.length) {
            _offset = history.length;
        }
        if (_offset + _limit > history.length) {
            _limit = history.length - _offset;
        }

        HistoryEntry[] memory values = new HistoryEntry[](_limit);
        for (uint256 i = 0; i < _limit; i++) {
            // return values in reverse historical for displaying purposes
            values[i] = history[history.length - 1 - _offset - i];
        }

        return values;
    }

    function getStats()
        public
        view
        returns (uint256 _successCount, uint256 _failCount)
    {
        uint256 successCount = 0;
        uint256 failCount = 0;
        for (uint256 i = 0; i < history.length; i++) {
            if (history[i]._goodCloseout) {
                successCount++;
            } else {
                failCount++;
            }
        }
        return (successCount, failCount);
    }

    //function that the clone factory calls to purchase the contract
    function setPurchaseContract(
        string calldata _encrValidatorURL,
        string calldata _encrDestURL,
        address _buyer,
        address _validator,
        uint16 _validatorFeeRateScaled
    ) public {
        require(
            msg.sender == cloneFactory,
            "this address is not approved to call the purchase function"
        );
        require(
            contractState() == ContractState.Available,
            "contract is not in an available state"
        );

        maybePayLastValidator();
        maybeApplyFutureTerms();

        history.push(
            HistoryEntry(
                true,
                block.timestamp,
                block.timestamp + terms._length,
                terms._price,
                terms._speed,
                terms._length,
                _buyer
            )
        );

        encrValidatorURL = _encrValidatorURL;
        encrDestURL = _encrDestURL;
        buyer = _buyer;
        validator = _validator;
        startingBlockTimestamp = block.timestamp;
        validatorFeeRateScaled = _validatorFeeRateScaled;

        isLastValidatorNotPaid =
            _validatorFeeRateScaled > 0 &&
            _validator != address(0);

        emit contractPurchased(msg.sender);
    }

    // DEPRECATED. use setDestination instead. Allows the buyers to update their mining pool information
    // during the lifecycle of the contract
    function setUpdateMiningInformation(
        string calldata _newEncryptedPoolData
    ) external {
        require(
            msg.sender == buyer,
            "this account is not authorized to update the ciphertext information"
        );
        require(
            contractState() == ContractState.Running,
            "the contract is not in the running state"
        );
        encrValidatorURL = _newEncryptedPoolData;
        emit cipherTextUpdated(_newEncryptedPoolData);
    }

    // allows the buyer to update the mining destination in the middle of the contract
    // this is V2 of the function setUpdateMiningInformation
    function setDestination(
        string calldata _encrValidatorURL,
        string calldata _encrDestURL
    ) external {
        require(
            msg.sender == buyer,
            "this account is not authorized to update the ciphertext information"
        );
        require(
            contractState() == ContractState.Running,
            "the contract is not in the running state"
        );
        encrDestURL = _encrDestURL;
        encrValidatorURL = _encrValidatorURL;
        emit cipherTextUpdated(_encrValidatorURL); // DEPRECATED, will be removed in future versions
        emit destinationUpdated(_encrValidatorURL, _encrDestURL);
    }

    //function which can edit the cost, length, and hashrate of a given contract
    function setUpdatePurchaseInformation(
        uint256 _price,
        uint256 _limit,
        uint256 _speed,
        uint256 _length,
        int8 _profitTarget
    ) external {
        require(
            msg.sender == cloneFactory,
            "this address is not approved to call this function"
        );
        if (contractState() == ContractState.Running) {
            futureTerms = Terms(
                _price,
                _limit,
                _speed,
                _length,
                terms._version + 1,
                _profitTarget
            );
        } else {
            terms = Terms(
                _price,
                _limit,
                _speed,
                _length,
                terms._version + 1,
                _profitTarget
            );
        }
        emit purchaseInfoUpdated(address(this));
    }

    function maybeApplyFutureTerms() internal {
        if (futureTerms._version != 0) {
            terms = Terms(
                futureTerms._price,
                futureTerms._limit,
                futureTerms._speed,
                futureTerms._length,
                futureTerms._version,
                futureTerms._profitTarget
            );
            futureTerms = Terms(0, 0, 0, 0, 0, 0);
            emit purchaseInfoUpdated(address(this));
        }
    }

    function maybePayLastValidator() internal returns (bool) {
        if (
            contractState() == ContractState.Available &&
            validator != address(0) &&
            isLastValidatorNotPaid
        ) {
            lumerin.transfer(
                validator,
                (terms._price * validatorFeeRateScaled) / VALIDATOR_FEE_MULT
            );
            isLastValidatorNotPaid = false;
            emit fundsClaimedValidator(msg.sender);
            return true;
        }
        return false;
    }

    /// @dev Returns the amount of funds that should be paid for the service from now till the current time
    function getRealizedPayout() internal view returns (uint256) {
        uint256 elapsedContractTime = (block.timestamp -
            startingBlockTimestamp);
        if (elapsedContractTime <= terms._length) {
            return (terms._price * elapsedContractTime) / terms._length;
        }
        return terms._price;
    }

    /// @dev Returns the amount of funds that will be paid for the service from now till the end of the contract
    function getUnrealizedPayout() internal view returns (uint256) {
        return terms._price - getRealizedPayout();
    }

    // DEPRECATED, use closeEarly or claimFunds instead
    function setContractCloseOut(uint256 closeOutType) public payable {
        if (closeOutType == 0) {
            // this closeoutType is only for the buyer to close early
            // and withdraw their funds
            closeEarly(CloseReason.Unspecified);
        } else if (closeOutType == 1) {
            // this closeoutType is only for the seller to withdraw their funds
            // at any time during the smart contracts lifecycle

            claimFunds();
        } else if (closeOutType == 2) {
            // this closeoutType is only for the seller to closeout after contract ended
            // without claiming funds, keeping them in the escrow
            // NOOP after implementing auto-closeout
        } else if (closeOutType == 3) {
            // this closeoutType is only for the seller to closeout after contract ended
            // and claim all funds collected in the escrow
            require(
                msg.sender == seller,
                "only the seller can closeout AND withdraw after contract term"
            );
            // no need to closeout after implementing auto-closeout
            claimFunds();
        } else {
            revert("you must make a selection from 0 to 3");
        }
    }

    function setContractDeleted(bool _isDeleted) public {
        require(
            msg.sender == cloneFactory,
            "this address is not approved to call this function"
        );

        require(
            isDeleted != _isDeleted,
            "contract delete state is already set to this value"
        );

        isDeleted = _isDeleted;
    }

    function claimFunds() public payable {
        require(
            msg.sender == seller,
            "this account is not authorized to claim funds"
        );

        uint256 amountToKeepInEscrow = 0;
        if (contractState() == ContractState.Running) {
            // if contract is running we need to keep some funds
            // in the escrow for refund if seller cancels contract
            amountToKeepInEscrow = getUnrealizedPayout();
        }

        emit fundsClaimed();

        maybePayLastValidator();
        uint256 unpaidValidatorFee = isLastValidatorNotPaid
            ? (terms._price * validatorFeeRateScaled) / VALIDATOR_FEE_MULT
            : 0;

        maybeApplyFutureTerms();

        CloneFactory(cloneFactory).payMarketplaceFee{value: msg.value}();
        withdrawAllFundsSeller(amountToKeepInEscrow + unpaidValidatorFee);
    }

    /// @notice Sends the validator fee to the validator
    /// @dev Can be called from any address, but the validator fee will be sent to the validator
    function claimFundsValidator() public {
        bool paid = maybePayLastValidator();
        require(paid, "no funds to withdraw");
    }

    function closeEarly(CloseReason reason) public {
        require(
            msg.sender == buyer || msg.sender == validator,
            "this account is not authorized to trigger an early closeout"
        );
        require(
            contractState() == ContractState.Running,
            "the contract is not in the running state"
        );

        HistoryEntry storage historyEntry = history[history.length - 1];
        historyEntry._goodCloseout = false;
        historyEntry._endTime = block.timestamp;

        // how much to return to buyer (base price)
        uint256 buyerPayout = getUnrealizedPayout();
        uint256 validatorPayout = 0;
        if (validator != address(0)) {
            // how much to pay to validator
            validatorPayout =
                (getRealizedPayout() * validatorFeeRateScaled) /
                VALIDATOR_FEE_MULT;

            // how much validator fee to refund to buyer
            uint256 buyerValidatorFeeRefund = (buyerPayout *
                validatorFeeRateScaled) / VALIDATOR_FEE_MULT;

            // total validator refund
            buyerPayout = buyerPayout + buyerValidatorFeeRefund;
        }

        isLastValidatorNotPaid = false;
        startingBlockTimestamp = 0;
        maybeApplyFutureTerms();

        emit contractClosed(buyer); // Deprecated, use closedEarly instead
        emit closedEarly(reason);

        lumerin.transfer(buyer, buyerPayout);
        if (validatorPayout > 0) {
            lumerin.transfer(validator, validatorPayout);
        }
    }

    function withdrawAllFundsSeller(
        uint256 remaining
    ) internal nonReentrant returns (bool) {
        uint256 balance = lumerin.balanceOf(address(this)) - remaining;
        return lumerin.transfer(seller, balance);
    }
}
