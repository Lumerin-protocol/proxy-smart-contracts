pragma solidity ^0.5.8;

interface ManageMarket {
    function requestSubmit(uint deadline) external returns (uint8 status, uint requestID);
    function requestClose(uint requestIdentifier) external returns (uint8 status);
    function requestApproval(uint requestIdentifier, uint[] calldata /*acceptedOfferIDs*/) external returns (uint8 status);
    function requestDelete(uint requestIdentifier) external returns (uint8 status);
}
