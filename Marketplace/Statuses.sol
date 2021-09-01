
pragma solidity ^0.5.8;

contract StatusCodes {
    uint8 constant internal Successful = 0;
    uint8 constant internal AccessDenied = 1;
    uint8 constant internal UndefinedID = 2;
    uint8 constant internal DeadlinePassed = 3;
    uint8 constant internal Pending = 4;
    uint8 constant internal FullyPaid = 5;
    uint8 constant internal ReqNotApproved = 6;
    uint8 constant internal ReqNotClosed = 7;
    uint8 constant internal AlreadySentContract = 8;
    uint8 constant internal InvalidInput = 9;
    uint8 constant internal Fail = 10;
    uint8 constant internal EscrowSuccess = 11;
    uint8 constant internal EscrowPending = 12;
    uint8 constant internal WalletBad = 13;

    event checkStatus(uint8 theStatus);
}
