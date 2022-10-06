// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package implementation

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
)

// ImplementationMetaData contains all meta data concerning the Implementation contract.
var ImplementationMetaData = &bind.MetaData{
	ABI: "[{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"uint8\",\"name\":\"version\",\"type\":\"uint8\"}],\"name\":\"Initialized\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"string\",\"name\":\"newCipherText\",\"type\":\"string\"}],\"name\":\"cipherTextUpdated\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[],\"name\":\"contractClosed\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"_buyer\",\"type\":\"address\"}],\"name\":\"contractPurchased\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[],\"name\":\"purchaseInfoUpdated\",\"type\":\"event\"},{\"inputs\":[],\"name\":\"buyer\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"contractState\",\"outputs\":[{\"internalType\":\"enumImplementation.ContractState\",\"name\":\"\",\"type\":\"uint8\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"contractTotal\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"encryptedPoolData\",\"outputs\":[{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"escrow_purchaser\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"escrow_seller\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"getPublicVariables\",\"outputs\":[{\"internalType\":\"enumImplementation.ContractState\",\"name\":\"\",\"type\":\"uint8\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"},{\"internalType\":\"string\",\"name\":\"\",\"type\":\"string\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_price\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_limit\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_speed\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_length\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"_seller\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"_lmn\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"_cloneFactory\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"_validator\",\"type\":\"address\"}],\"name\":\"initialize\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"length\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"limit\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"price\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"receivedTotal\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"seller\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"closeOutType\",\"type\":\"uint256\"}],\"name\":\"setContractCloseOut\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"_encryptedPoolData\",\"type\":\"string\"},{\"internalType\":\"address\",\"name\":\"_buyer\",\"type\":\"address\"}],\"name\":\"setPurchaseContract\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"_newEncryptedPoolData\",\"type\":\"string\"}],\"name\":\"setUpdateMiningInformation\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_price\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_limit\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_speed\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_length\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_closeoutType\",\"type\":\"uint256\"}],\"name\":\"setUpdatePurchaseInformation\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"speed\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"startingBlockTimestamp\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
}

// ImplementationABI is the input ABI used to generate the binding from.
// Deprecated: Use ImplementationMetaData.ABI instead.
var ImplementationABI = ImplementationMetaData.ABI

// Implementation is an auto generated Go binding around an Ethereum contract.
type Implementation struct {
	ImplementationCaller     // Read-only binding to the contract
	ImplementationTransactor // Write-only binding to the contract
	ImplementationFilterer   // Log filterer for contract events
}

// ImplementationCaller is an auto generated read-only Go binding around an Ethereum contract.
type ImplementationCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ImplementationTransactor is an auto generated write-only Go binding around an Ethereum contract.
type ImplementationTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ImplementationFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type ImplementationFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ImplementationSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type ImplementationSession struct {
	Contract     *Implementation   // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// ImplementationCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type ImplementationCallerSession struct {
	Contract *ImplementationCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts         // Call options to use throughout this session
}

// ImplementationTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type ImplementationTransactorSession struct {
	Contract     *ImplementationTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts         // Transaction auth options to use throughout this session
}

// ImplementationRaw is an auto generated low-level Go binding around an Ethereum contract.
type ImplementationRaw struct {
	Contract *Implementation // Generic contract binding to access the raw methods on
}

// ImplementationCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type ImplementationCallerRaw struct {
	Contract *ImplementationCaller // Generic read-only contract binding to access the raw methods on
}

// ImplementationTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type ImplementationTransactorRaw struct {
	Contract *ImplementationTransactor // Generic write-only contract binding to access the raw methods on
}

// NewImplementation creates a new instance of Implementation, bound to a specific deployed contract.
func NewImplementation(address common.Address, backend bind.ContractBackend) (*Implementation, error) {
	contract, err := bindImplementation(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Implementation{ImplementationCaller: ImplementationCaller{contract: contract}, ImplementationTransactor: ImplementationTransactor{contract: contract}, ImplementationFilterer: ImplementationFilterer{contract: contract}}, nil
}

// NewImplementationCaller creates a new read-only instance of Implementation, bound to a specific deployed contract.
func NewImplementationCaller(address common.Address, caller bind.ContractCaller) (*ImplementationCaller, error) {
	contract, err := bindImplementation(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &ImplementationCaller{contract: contract}, nil
}

// NewImplementationTransactor creates a new write-only instance of Implementation, bound to a specific deployed contract.
func NewImplementationTransactor(address common.Address, transactor bind.ContractTransactor) (*ImplementationTransactor, error) {
	contract, err := bindImplementation(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &ImplementationTransactor{contract: contract}, nil
}

// NewImplementationFilterer creates a new log filterer instance of Implementation, bound to a specific deployed contract.
func NewImplementationFilterer(address common.Address, filterer bind.ContractFilterer) (*ImplementationFilterer, error) {
	contract, err := bindImplementation(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &ImplementationFilterer{contract: contract}, nil
}

// bindImplementation binds a generic wrapper to an already deployed contract.
func bindImplementation(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(ImplementationABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Implementation *ImplementationRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Implementation.Contract.ImplementationCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Implementation *ImplementationRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Implementation.Contract.ImplementationTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Implementation *ImplementationRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Implementation.Contract.ImplementationTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Implementation *ImplementationCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Implementation.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Implementation *ImplementationTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Implementation.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Implementation *ImplementationTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Implementation.Contract.contract.Transact(opts, method, params...)
}

// Buyer is a free data retrieval call binding the contract method 0x7150d8ae.
//
// Solidity: function buyer() view returns(address)
func (_Implementation *ImplementationCaller) Buyer(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "buyer")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Buyer is a free data retrieval call binding the contract method 0x7150d8ae.
//
// Solidity: function buyer() view returns(address)
func (_Implementation *ImplementationSession) Buyer() (common.Address, error) {
	return _Implementation.Contract.Buyer(&_Implementation.CallOpts)
}

// Buyer is a free data retrieval call binding the contract method 0x7150d8ae.
//
// Solidity: function buyer() view returns(address)
func (_Implementation *ImplementationCallerSession) Buyer() (common.Address, error) {
	return _Implementation.Contract.Buyer(&_Implementation.CallOpts)
}

// ContractState is a free data retrieval call binding the contract method 0x85209ee0.
//
// Solidity: function contractState() view returns(uint8)
func (_Implementation *ImplementationCaller) ContractState(opts *bind.CallOpts) (uint8, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "contractState")

	if err != nil {
		return *new(uint8), err
	}

	out0 := *abi.ConvertType(out[0], new(uint8)).(*uint8)

	return out0, err

}

// ContractState is a free data retrieval call binding the contract method 0x85209ee0.
//
// Solidity: function contractState() view returns(uint8)
func (_Implementation *ImplementationSession) ContractState() (uint8, error) {
	return _Implementation.Contract.ContractState(&_Implementation.CallOpts)
}

// ContractState is a free data retrieval call binding the contract method 0x85209ee0.
//
// Solidity: function contractState() view returns(uint8)
func (_Implementation *ImplementationCallerSession) ContractState() (uint8, error) {
	return _Implementation.Contract.ContractState(&_Implementation.CallOpts)
}

// ContractTotal is a free data retrieval call binding the contract method 0x0a61e2d9.
//
// Solidity: function contractTotal() view returns(uint256)
func (_Implementation *ImplementationCaller) ContractTotal(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "contractTotal")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ContractTotal is a free data retrieval call binding the contract method 0x0a61e2d9.
//
// Solidity: function contractTotal() view returns(uint256)
func (_Implementation *ImplementationSession) ContractTotal() (*big.Int, error) {
	return _Implementation.Contract.ContractTotal(&_Implementation.CallOpts)
}

// ContractTotal is a free data retrieval call binding the contract method 0x0a61e2d9.
//
// Solidity: function contractTotal() view returns(uint256)
func (_Implementation *ImplementationCallerSession) ContractTotal() (*big.Int, error) {
	return _Implementation.Contract.ContractTotal(&_Implementation.CallOpts)
}

// EncryptedPoolData is a free data retrieval call binding the contract method 0x8b7e4b13.
//
// Solidity: function encryptedPoolData() view returns(string)
func (_Implementation *ImplementationCaller) EncryptedPoolData(opts *bind.CallOpts) (string, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "encryptedPoolData")

	if err != nil {
		return *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(string)).(*string)

	return out0, err

}

// EncryptedPoolData is a free data retrieval call binding the contract method 0x8b7e4b13.
//
// Solidity: function encryptedPoolData() view returns(string)
func (_Implementation *ImplementationSession) EncryptedPoolData() (string, error) {
	return _Implementation.Contract.EncryptedPoolData(&_Implementation.CallOpts)
}

// EncryptedPoolData is a free data retrieval call binding the contract method 0x8b7e4b13.
//
// Solidity: function encryptedPoolData() view returns(string)
func (_Implementation *ImplementationCallerSession) EncryptedPoolData() (string, error) {
	return _Implementation.Contract.EncryptedPoolData(&_Implementation.CallOpts)
}

// EscrowPurchaser is a free data retrieval call binding the contract method 0x089aa8a2.
//
// Solidity: function escrow_purchaser() view returns(address)
func (_Implementation *ImplementationCaller) EscrowPurchaser(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "escrow_purchaser")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// EscrowPurchaser is a free data retrieval call binding the contract method 0x089aa8a2.
//
// Solidity: function escrow_purchaser() view returns(address)
func (_Implementation *ImplementationSession) EscrowPurchaser() (common.Address, error) {
	return _Implementation.Contract.EscrowPurchaser(&_Implementation.CallOpts)
}

// EscrowPurchaser is a free data retrieval call binding the contract method 0x089aa8a2.
//
// Solidity: function escrow_purchaser() view returns(address)
func (_Implementation *ImplementationCallerSession) EscrowPurchaser() (common.Address, error) {
	return _Implementation.Contract.EscrowPurchaser(&_Implementation.CallOpts)
}

// EscrowSeller is a free data retrieval call binding the contract method 0xce0c722a.
//
// Solidity: function escrow_seller() view returns(address)
func (_Implementation *ImplementationCaller) EscrowSeller(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "escrow_seller")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// EscrowSeller is a free data retrieval call binding the contract method 0xce0c722a.
//
// Solidity: function escrow_seller() view returns(address)
func (_Implementation *ImplementationSession) EscrowSeller() (common.Address, error) {
	return _Implementation.Contract.EscrowSeller(&_Implementation.CallOpts)
}

// EscrowSeller is a free data retrieval call binding the contract method 0xce0c722a.
//
// Solidity: function escrow_seller() view returns(address)
func (_Implementation *ImplementationCallerSession) EscrowSeller() (common.Address, error) {
	return _Implementation.Contract.EscrowSeller(&_Implementation.CallOpts)
}

// GetPublicVariables is a free data retrieval call binding the contract method 0xca3225fa.
//
// Solidity: function getPublicVariables() view returns(uint8, uint256, uint256, uint256, uint256, uint256, address, address, string)
func (_Implementation *ImplementationCaller) GetPublicVariables(opts *bind.CallOpts) (uint8, *big.Int, *big.Int, *big.Int, *big.Int, *big.Int, common.Address, common.Address, string, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "getPublicVariables")

	if err != nil {
		return *new(uint8), *new(*big.Int), *new(*big.Int), *new(*big.Int), *new(*big.Int), *new(*big.Int), *new(common.Address), *new(common.Address), *new(string), err
	}

	out0 := *abi.ConvertType(out[0], new(uint8)).(*uint8)
	out1 := *abi.ConvertType(out[1], new(*big.Int)).(**big.Int)
	out2 := *abi.ConvertType(out[2], new(*big.Int)).(**big.Int)
	out3 := *abi.ConvertType(out[3], new(*big.Int)).(**big.Int)
	out4 := *abi.ConvertType(out[4], new(*big.Int)).(**big.Int)
	out5 := *abi.ConvertType(out[5], new(*big.Int)).(**big.Int)
	out6 := *abi.ConvertType(out[6], new(common.Address)).(*common.Address)
	out7 := *abi.ConvertType(out[7], new(common.Address)).(*common.Address)
	out8 := *abi.ConvertType(out[8], new(string)).(*string)

	return out0, out1, out2, out3, out4, out5, out6, out7, out8, err

}

// GetPublicVariables is a free data retrieval call binding the contract method 0xca3225fa.
//
// Solidity: function getPublicVariables() view returns(uint8, uint256, uint256, uint256, uint256, uint256, address, address, string)
func (_Implementation *ImplementationSession) GetPublicVariables() (uint8, *big.Int, *big.Int, *big.Int, *big.Int, *big.Int, common.Address, common.Address, string, error) {
	return _Implementation.Contract.GetPublicVariables(&_Implementation.CallOpts)
}

// GetPublicVariables is a free data retrieval call binding the contract method 0xca3225fa.
//
// Solidity: function getPublicVariables() view returns(uint8, uint256, uint256, uint256, uint256, uint256, address, address, string)
func (_Implementation *ImplementationCallerSession) GetPublicVariables() (uint8, *big.Int, *big.Int, *big.Int, *big.Int, *big.Int, common.Address, common.Address, string, error) {
	return _Implementation.Contract.GetPublicVariables(&_Implementation.CallOpts)
}

// Length is a free data retrieval call binding the contract method 0x1f7b6d32.
//
// Solidity: function length() view returns(uint256)
func (_Implementation *ImplementationCaller) Length(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "length")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Length is a free data retrieval call binding the contract method 0x1f7b6d32.
//
// Solidity: function length() view returns(uint256)
func (_Implementation *ImplementationSession) Length() (*big.Int, error) {
	return _Implementation.Contract.Length(&_Implementation.CallOpts)
}

// Length is a free data retrieval call binding the contract method 0x1f7b6d32.
//
// Solidity: function length() view returns(uint256)
func (_Implementation *ImplementationCallerSession) Length() (*big.Int, error) {
	return _Implementation.Contract.Length(&_Implementation.CallOpts)
}

// Limit is a free data retrieval call binding the contract method 0xa4d66daf.
//
// Solidity: function limit() view returns(uint256)
func (_Implementation *ImplementationCaller) Limit(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "limit")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Limit is a free data retrieval call binding the contract method 0xa4d66daf.
//
// Solidity: function limit() view returns(uint256)
func (_Implementation *ImplementationSession) Limit() (*big.Int, error) {
	return _Implementation.Contract.Limit(&_Implementation.CallOpts)
}

// Limit is a free data retrieval call binding the contract method 0xa4d66daf.
//
// Solidity: function limit() view returns(uint256)
func (_Implementation *ImplementationCallerSession) Limit() (*big.Int, error) {
	return _Implementation.Contract.Limit(&_Implementation.CallOpts)
}

// Price is a free data retrieval call binding the contract method 0xa035b1fe.
//
// Solidity: function price() view returns(uint256)
func (_Implementation *ImplementationCaller) Price(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "price")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Price is a free data retrieval call binding the contract method 0xa035b1fe.
//
// Solidity: function price() view returns(uint256)
func (_Implementation *ImplementationSession) Price() (*big.Int, error) {
	return _Implementation.Contract.Price(&_Implementation.CallOpts)
}

// Price is a free data retrieval call binding the contract method 0xa035b1fe.
//
// Solidity: function price() view returns(uint256)
func (_Implementation *ImplementationCallerSession) Price() (*big.Int, error) {
	return _Implementation.Contract.Price(&_Implementation.CallOpts)
}

// ReceivedTotal is a free data retrieval call binding the contract method 0x16713b37.
//
// Solidity: function receivedTotal() view returns(uint256)
func (_Implementation *ImplementationCaller) ReceivedTotal(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "receivedTotal")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// ReceivedTotal is a free data retrieval call binding the contract method 0x16713b37.
//
// Solidity: function receivedTotal() view returns(uint256)
func (_Implementation *ImplementationSession) ReceivedTotal() (*big.Int, error) {
	return _Implementation.Contract.ReceivedTotal(&_Implementation.CallOpts)
}

// ReceivedTotal is a free data retrieval call binding the contract method 0x16713b37.
//
// Solidity: function receivedTotal() view returns(uint256)
func (_Implementation *ImplementationCallerSession) ReceivedTotal() (*big.Int, error) {
	return _Implementation.Contract.ReceivedTotal(&_Implementation.CallOpts)
}

// Seller is a free data retrieval call binding the contract method 0x08551a53.
//
// Solidity: function seller() view returns(address)
func (_Implementation *ImplementationCaller) Seller(opts *bind.CallOpts) (common.Address, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "seller")

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// Seller is a free data retrieval call binding the contract method 0x08551a53.
//
// Solidity: function seller() view returns(address)
func (_Implementation *ImplementationSession) Seller() (common.Address, error) {
	return _Implementation.Contract.Seller(&_Implementation.CallOpts)
}

// Seller is a free data retrieval call binding the contract method 0x08551a53.
//
// Solidity: function seller() view returns(address)
func (_Implementation *ImplementationCallerSession) Seller() (common.Address, error) {
	return _Implementation.Contract.Seller(&_Implementation.CallOpts)
}

// Speed is a free data retrieval call binding the contract method 0xc20906ac.
//
// Solidity: function speed() view returns(uint256)
func (_Implementation *ImplementationCaller) Speed(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "speed")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// Speed is a free data retrieval call binding the contract method 0xc20906ac.
//
// Solidity: function speed() view returns(uint256)
func (_Implementation *ImplementationSession) Speed() (*big.Int, error) {
	return _Implementation.Contract.Speed(&_Implementation.CallOpts)
}

// Speed is a free data retrieval call binding the contract method 0xc20906ac.
//
// Solidity: function speed() view returns(uint256)
func (_Implementation *ImplementationCallerSession) Speed() (*big.Int, error) {
	return _Implementation.Contract.Speed(&_Implementation.CallOpts)
}

// StartingBlockTimestamp is a free data retrieval call binding the contract method 0xc5095d68.
//
// Solidity: function startingBlockTimestamp() view returns(uint256)
func (_Implementation *ImplementationCaller) StartingBlockTimestamp(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Implementation.contract.Call(opts, &out, "startingBlockTimestamp")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// StartingBlockTimestamp is a free data retrieval call binding the contract method 0xc5095d68.
//
// Solidity: function startingBlockTimestamp() view returns(uint256)
func (_Implementation *ImplementationSession) StartingBlockTimestamp() (*big.Int, error) {
	return _Implementation.Contract.StartingBlockTimestamp(&_Implementation.CallOpts)
}

// StartingBlockTimestamp is a free data retrieval call binding the contract method 0xc5095d68.
//
// Solidity: function startingBlockTimestamp() view returns(uint256)
func (_Implementation *ImplementationCallerSession) StartingBlockTimestamp() (*big.Int, error) {
	return _Implementation.Contract.StartingBlockTimestamp(&_Implementation.CallOpts)
}

// Initialize is a paid mutator transaction binding the contract method 0x3a5d4213.
//
// Solidity: function initialize(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, address _seller, address _lmn, address _cloneFactory, address _validator) returns()
func (_Implementation *ImplementationTransactor) Initialize(opts *bind.TransactOpts, _price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _seller common.Address, _lmn common.Address, _cloneFactory common.Address, _validator common.Address) (*types.Transaction, error) {
	return _Implementation.contract.Transact(opts, "initialize", _price, _limit, _speed, _length, _seller, _lmn, _cloneFactory, _validator)
}

// Initialize is a paid mutator transaction binding the contract method 0x3a5d4213.
//
// Solidity: function initialize(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, address _seller, address _lmn, address _cloneFactory, address _validator) returns()
func (_Implementation *ImplementationSession) Initialize(_price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _seller common.Address, _lmn common.Address, _cloneFactory common.Address, _validator common.Address) (*types.Transaction, error) {
	return _Implementation.Contract.Initialize(&_Implementation.TransactOpts, _price, _limit, _speed, _length, _seller, _lmn, _cloneFactory, _validator)
}

// Initialize is a paid mutator transaction binding the contract method 0x3a5d4213.
//
// Solidity: function initialize(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, address _seller, address _lmn, address _cloneFactory, address _validator) returns()
func (_Implementation *ImplementationTransactorSession) Initialize(_price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _seller common.Address, _lmn common.Address, _cloneFactory common.Address, _validator common.Address) (*types.Transaction, error) {
	return _Implementation.Contract.Initialize(&_Implementation.TransactOpts, _price, _limit, _speed, _length, _seller, _lmn, _cloneFactory, _validator)
}

// SetContractCloseOut is a paid mutator transaction binding the contract method 0x8e2e6d5d.
//
// Solidity: function setContractCloseOut(uint256 closeOutType) returns()
func (_Implementation *ImplementationTransactor) SetContractCloseOut(opts *bind.TransactOpts, closeOutType *big.Int) (*types.Transaction, error) {
	return _Implementation.contract.Transact(opts, "setContractCloseOut", closeOutType)
}

// SetContractCloseOut is a paid mutator transaction binding the contract method 0x8e2e6d5d.
//
// Solidity: function setContractCloseOut(uint256 closeOutType) returns()
func (_Implementation *ImplementationSession) SetContractCloseOut(closeOutType *big.Int) (*types.Transaction, error) {
	return _Implementation.Contract.SetContractCloseOut(&_Implementation.TransactOpts, closeOutType)
}

// SetContractCloseOut is a paid mutator transaction binding the contract method 0x8e2e6d5d.
//
// Solidity: function setContractCloseOut(uint256 closeOutType) returns()
func (_Implementation *ImplementationTransactorSession) SetContractCloseOut(closeOutType *big.Int) (*types.Transaction, error) {
	return _Implementation.Contract.SetContractCloseOut(&_Implementation.TransactOpts, closeOutType)
}

// SetPurchaseContract is a paid mutator transaction binding the contract method 0xddcb1bf2.
//
// Solidity: function setPurchaseContract(string _encryptedPoolData, address _buyer) returns()
func (_Implementation *ImplementationTransactor) SetPurchaseContract(opts *bind.TransactOpts, _encryptedPoolData string, _buyer common.Address) (*types.Transaction, error) {
	return _Implementation.contract.Transact(opts, "setPurchaseContract", _encryptedPoolData, _buyer)
}

// SetPurchaseContract is a paid mutator transaction binding the contract method 0xddcb1bf2.
//
// Solidity: function setPurchaseContract(string _encryptedPoolData, address _buyer) returns()
func (_Implementation *ImplementationSession) SetPurchaseContract(_encryptedPoolData string, _buyer common.Address) (*types.Transaction, error) {
	return _Implementation.Contract.SetPurchaseContract(&_Implementation.TransactOpts, _encryptedPoolData, _buyer)
}

// SetPurchaseContract is a paid mutator transaction binding the contract method 0xddcb1bf2.
//
// Solidity: function setPurchaseContract(string _encryptedPoolData, address _buyer) returns()
func (_Implementation *ImplementationTransactorSession) SetPurchaseContract(_encryptedPoolData string, _buyer common.Address) (*types.Transaction, error) {
	return _Implementation.Contract.SetPurchaseContract(&_Implementation.TransactOpts, _encryptedPoolData, _buyer)
}

// SetUpdateMiningInformation is a paid mutator transaction binding the contract method 0x719e6b5b.
//
// Solidity: function setUpdateMiningInformation(string _newEncryptedPoolData) returns()
func (_Implementation *ImplementationTransactor) SetUpdateMiningInformation(opts *bind.TransactOpts, _newEncryptedPoolData string) (*types.Transaction, error) {
	return _Implementation.contract.Transact(opts, "setUpdateMiningInformation", _newEncryptedPoolData)
}

// SetUpdateMiningInformation is a paid mutator transaction binding the contract method 0x719e6b5b.
//
// Solidity: function setUpdateMiningInformation(string _newEncryptedPoolData) returns()
func (_Implementation *ImplementationSession) SetUpdateMiningInformation(_newEncryptedPoolData string) (*types.Transaction, error) {
	return _Implementation.Contract.SetUpdateMiningInformation(&_Implementation.TransactOpts, _newEncryptedPoolData)
}

// SetUpdateMiningInformation is a paid mutator transaction binding the contract method 0x719e6b5b.
//
// Solidity: function setUpdateMiningInformation(string _newEncryptedPoolData) returns()
func (_Implementation *ImplementationTransactorSession) SetUpdateMiningInformation(_newEncryptedPoolData string) (*types.Transaction, error) {
	return _Implementation.Contract.SetUpdateMiningInformation(&_Implementation.TransactOpts, _newEncryptedPoolData)
}

// SetUpdatePurchaseInformation is a paid mutator transaction binding the contract method 0xf1a6e301.
//
// Solidity: function setUpdatePurchaseInformation(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, uint256 _closeoutType) returns()
func (_Implementation *ImplementationTransactor) SetUpdatePurchaseInformation(opts *bind.TransactOpts, _price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _closeoutType *big.Int) (*types.Transaction, error) {
	return _Implementation.contract.Transact(opts, "setUpdatePurchaseInformation", _price, _limit, _speed, _length, _closeoutType)
}

// SetUpdatePurchaseInformation is a paid mutator transaction binding the contract method 0xf1a6e301.
//
// Solidity: function setUpdatePurchaseInformation(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, uint256 _closeoutType) returns()
func (_Implementation *ImplementationSession) SetUpdatePurchaseInformation(_price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _closeoutType *big.Int) (*types.Transaction, error) {
	return _Implementation.Contract.SetUpdatePurchaseInformation(&_Implementation.TransactOpts, _price, _limit, _speed, _length, _closeoutType)
}

// SetUpdatePurchaseInformation is a paid mutator transaction binding the contract method 0xf1a6e301.
//
// Solidity: function setUpdatePurchaseInformation(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, uint256 _closeoutType) returns()
func (_Implementation *ImplementationTransactorSession) SetUpdatePurchaseInformation(_price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _closeoutType *big.Int) (*types.Transaction, error) {
	return _Implementation.Contract.SetUpdatePurchaseInformation(&_Implementation.TransactOpts, _price, _limit, _speed, _length, _closeoutType)
}

// ImplementationInitializedIterator is returned from FilterInitialized and is used to iterate over the raw logs and unpacked data for Initialized events raised by the Implementation contract.
type ImplementationInitializedIterator struct {
	Event *ImplementationInitialized // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ImplementationInitializedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ImplementationInitialized)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ImplementationInitialized)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ImplementationInitializedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ImplementationInitializedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ImplementationInitialized represents a Initialized event raised by the Implementation contract.
type ImplementationInitialized struct {
	Version uint8
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterInitialized is a free log retrieval operation binding the contract event 0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498.
//
// Solidity: event Initialized(uint8 version)
func (_Implementation *ImplementationFilterer) FilterInitialized(opts *bind.FilterOpts) (*ImplementationInitializedIterator, error) {

	logs, sub, err := _Implementation.contract.FilterLogs(opts, "Initialized")
	if err != nil {
		return nil, err
	}
	return &ImplementationInitializedIterator{contract: _Implementation.contract, event: "Initialized", logs: logs, sub: sub}, nil
}

// WatchInitialized is a free log subscription operation binding the contract event 0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498.
//
// Solidity: event Initialized(uint8 version)
func (_Implementation *ImplementationFilterer) WatchInitialized(opts *bind.WatchOpts, sink chan<- *ImplementationInitialized) (event.Subscription, error) {

	logs, sub, err := _Implementation.contract.WatchLogs(opts, "Initialized")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ImplementationInitialized)
				if err := _Implementation.contract.UnpackLog(event, "Initialized", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseInitialized is a log parse operation binding the contract event 0x7f26b83ff96e1f2b6a682f133852f6798a09c465da95921460cefb3847402498.
//
// Solidity: event Initialized(uint8 version)
func (_Implementation *ImplementationFilterer) ParseInitialized(log types.Log) (*ImplementationInitialized, error) {
	event := new(ImplementationInitialized)
	if err := _Implementation.contract.UnpackLog(event, "Initialized", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// ImplementationCipherTextUpdatedIterator is returned from FilterCipherTextUpdated and is used to iterate over the raw logs and unpacked data for CipherTextUpdated events raised by the Implementation contract.
type ImplementationCipherTextUpdatedIterator struct {
	Event *ImplementationCipherTextUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ImplementationCipherTextUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ImplementationCipherTextUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ImplementationCipherTextUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ImplementationCipherTextUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ImplementationCipherTextUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ImplementationCipherTextUpdated represents a CipherTextUpdated event raised by the Implementation contract.
type ImplementationCipherTextUpdated struct {
	NewCipherText string
	Raw           types.Log // Blockchain specific contextual infos
}

// FilterCipherTextUpdated is a free log retrieval operation binding the contract event 0x2301ef7d9f42b857543faf9e285b5807e028d4ae99810ea7fe0aadda3a717e9d.
//
// Solidity: event cipherTextUpdated(string newCipherText)
func (_Implementation *ImplementationFilterer) FilterCipherTextUpdated(opts *bind.FilterOpts) (*ImplementationCipherTextUpdatedIterator, error) {

	logs, sub, err := _Implementation.contract.FilterLogs(opts, "cipherTextUpdated")
	if err != nil {
		return nil, err
	}
	return &ImplementationCipherTextUpdatedIterator{contract: _Implementation.contract, event: "cipherTextUpdated", logs: logs, sub: sub}, nil
}

// WatchCipherTextUpdated is a free log subscription operation binding the contract event 0x2301ef7d9f42b857543faf9e285b5807e028d4ae99810ea7fe0aadda3a717e9d.
//
// Solidity: event cipherTextUpdated(string newCipherText)
func (_Implementation *ImplementationFilterer) WatchCipherTextUpdated(opts *bind.WatchOpts, sink chan<- *ImplementationCipherTextUpdated) (event.Subscription, error) {

	logs, sub, err := _Implementation.contract.WatchLogs(opts, "cipherTextUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ImplementationCipherTextUpdated)
				if err := _Implementation.contract.UnpackLog(event, "cipherTextUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseCipherTextUpdated is a log parse operation binding the contract event 0x2301ef7d9f42b857543faf9e285b5807e028d4ae99810ea7fe0aadda3a717e9d.
//
// Solidity: event cipherTextUpdated(string newCipherText)
func (_Implementation *ImplementationFilterer) ParseCipherTextUpdated(log types.Log) (*ImplementationCipherTextUpdated, error) {
	event := new(ImplementationCipherTextUpdated)
	if err := _Implementation.contract.UnpackLog(event, "cipherTextUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// ImplementationContractClosedIterator is returned from FilterContractClosed and is used to iterate over the raw logs and unpacked data for ContractClosed events raised by the Implementation contract.
type ImplementationContractClosedIterator struct {
	Event *ImplementationContractClosed // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ImplementationContractClosedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ImplementationContractClosed)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ImplementationContractClosed)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ImplementationContractClosedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ImplementationContractClosedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ImplementationContractClosed represents a ContractClosed event raised by the Implementation contract.
type ImplementationContractClosed struct {
	Raw types.Log // Blockchain specific contextual infos
}

// FilterContractClosed is a free log retrieval operation binding the contract event 0xf5e1a452bb76d7335225182a97ad694be2c7b4b5d75dcffb67ddf15db95f4844.
//
// Solidity: event contractClosed()
func (_Implementation *ImplementationFilterer) FilterContractClosed(opts *bind.FilterOpts) (*ImplementationContractClosedIterator, error) {

	logs, sub, err := _Implementation.contract.FilterLogs(opts, "contractClosed")
	if err != nil {
		return nil, err
	}
	return &ImplementationContractClosedIterator{contract: _Implementation.contract, event: "contractClosed", logs: logs, sub: sub}, nil
}

// WatchContractClosed is a free log subscription operation binding the contract event 0xf5e1a452bb76d7335225182a97ad694be2c7b4b5d75dcffb67ddf15db95f4844.
//
// Solidity: event contractClosed()
func (_Implementation *ImplementationFilterer) WatchContractClosed(opts *bind.WatchOpts, sink chan<- *ImplementationContractClosed) (event.Subscription, error) {

	logs, sub, err := _Implementation.contract.WatchLogs(opts, "contractClosed")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ImplementationContractClosed)
				if err := _Implementation.contract.UnpackLog(event, "contractClosed", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseContractClosed is a log parse operation binding the contract event 0xf5e1a452bb76d7335225182a97ad694be2c7b4b5d75dcffb67ddf15db95f4844.
//
// Solidity: event contractClosed()
func (_Implementation *ImplementationFilterer) ParseContractClosed(log types.Log) (*ImplementationContractClosed, error) {
	event := new(ImplementationContractClosed)
	if err := _Implementation.contract.UnpackLog(event, "contractClosed", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// ImplementationContractPurchasedIterator is returned from FilterContractPurchased and is used to iterate over the raw logs and unpacked data for ContractPurchased events raised by the Implementation contract.
type ImplementationContractPurchasedIterator struct {
	Event *ImplementationContractPurchased // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ImplementationContractPurchasedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ImplementationContractPurchased)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ImplementationContractPurchased)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ImplementationContractPurchasedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ImplementationContractPurchasedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ImplementationContractPurchased represents a ContractPurchased event raised by the Implementation contract.
type ImplementationContractPurchased struct {
	Buyer common.Address
	Raw   types.Log // Blockchain specific contextual infos
}

// FilterContractPurchased is a free log retrieval operation binding the contract event 0x0c00d1d6cea0bd55f7d3b6e92ef60237b117b050185fc2816c708fd45f45e5bb.
//
// Solidity: event contractPurchased(address indexed _buyer)
func (_Implementation *ImplementationFilterer) FilterContractPurchased(opts *bind.FilterOpts, _buyer []common.Address) (*ImplementationContractPurchasedIterator, error) {

	var _buyerRule []interface{}
	for _, _buyerItem := range _buyer {
		_buyerRule = append(_buyerRule, _buyerItem)
	}

	logs, sub, err := _Implementation.contract.FilterLogs(opts, "contractPurchased", _buyerRule)
	if err != nil {
		return nil, err
	}
	return &ImplementationContractPurchasedIterator{contract: _Implementation.contract, event: "contractPurchased", logs: logs, sub: sub}, nil
}

// WatchContractPurchased is a free log subscription operation binding the contract event 0x0c00d1d6cea0bd55f7d3b6e92ef60237b117b050185fc2816c708fd45f45e5bb.
//
// Solidity: event contractPurchased(address indexed _buyer)
func (_Implementation *ImplementationFilterer) WatchContractPurchased(opts *bind.WatchOpts, sink chan<- *ImplementationContractPurchased, _buyer []common.Address) (event.Subscription, error) {

	var _buyerRule []interface{}
	for _, _buyerItem := range _buyer {
		_buyerRule = append(_buyerRule, _buyerItem)
	}

	logs, sub, err := _Implementation.contract.WatchLogs(opts, "contractPurchased", _buyerRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ImplementationContractPurchased)
				if err := _Implementation.contract.UnpackLog(event, "contractPurchased", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseContractPurchased is a log parse operation binding the contract event 0x0c00d1d6cea0bd55f7d3b6e92ef60237b117b050185fc2816c708fd45f45e5bb.
//
// Solidity: event contractPurchased(address indexed _buyer)
func (_Implementation *ImplementationFilterer) ParseContractPurchased(log types.Log) (*ImplementationContractPurchased, error) {
	event := new(ImplementationContractPurchased)
	if err := _Implementation.contract.UnpackLog(event, "contractPurchased", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// ImplementationPurchaseInfoUpdatedIterator is returned from FilterPurchaseInfoUpdated and is used to iterate over the raw logs and unpacked data for PurchaseInfoUpdated events raised by the Implementation contract.
type ImplementationPurchaseInfoUpdatedIterator struct {
	Event *ImplementationPurchaseInfoUpdated // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *ImplementationPurchaseInfoUpdatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ImplementationPurchaseInfoUpdated)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(ImplementationPurchaseInfoUpdated)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *ImplementationPurchaseInfoUpdatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ImplementationPurchaseInfoUpdatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ImplementationPurchaseInfoUpdated represents a PurchaseInfoUpdated event raised by the Implementation contract.
type ImplementationPurchaseInfoUpdated struct {
	Raw types.Log // Blockchain specific contextual infos
}

// FilterPurchaseInfoUpdated is a free log retrieval operation binding the contract event 0x03e052767f275c0c51cc93a76255d42498341feb7a5beef7cc11fd57c5b66818.
//
// Solidity: event purchaseInfoUpdated()
func (_Implementation *ImplementationFilterer) FilterPurchaseInfoUpdated(opts *bind.FilterOpts) (*ImplementationPurchaseInfoUpdatedIterator, error) {

	logs, sub, err := _Implementation.contract.FilterLogs(opts, "purchaseInfoUpdated")
	if err != nil {
		return nil, err
	}
	return &ImplementationPurchaseInfoUpdatedIterator{contract: _Implementation.contract, event: "purchaseInfoUpdated", logs: logs, sub: sub}, nil
}

// WatchPurchaseInfoUpdated is a free log subscription operation binding the contract event 0x03e052767f275c0c51cc93a76255d42498341feb7a5beef7cc11fd57c5b66818.
//
// Solidity: event purchaseInfoUpdated()
func (_Implementation *ImplementationFilterer) WatchPurchaseInfoUpdated(opts *bind.WatchOpts, sink chan<- *ImplementationPurchaseInfoUpdated) (event.Subscription, error) {

	logs, sub, err := _Implementation.contract.WatchLogs(opts, "purchaseInfoUpdated")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ImplementationPurchaseInfoUpdated)
				if err := _Implementation.contract.UnpackLog(event, "purchaseInfoUpdated", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParsePurchaseInfoUpdated is a log parse operation binding the contract event 0x03e052767f275c0c51cc93a76255d42498341feb7a5beef7cc11fd57c5b66818.
//
// Solidity: event purchaseInfoUpdated()
func (_Implementation *ImplementationFilterer) ParsePurchaseInfoUpdated(log types.Log) (*ImplementationPurchaseInfoUpdated, error) {
	event := new(ImplementationPurchaseInfoUpdated)
	if err := _Implementation.contract.UnpackLog(event, "purchaseInfoUpdated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
