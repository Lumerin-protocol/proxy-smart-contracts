// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package clonefactory

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

// ClonefactoryMetaData contains all meta data concerning the Clonefactory contract.
var ClonefactoryMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[{\"internalType\":\"address\",\"name\":\"_lmn\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"_validator\",\"type\":\"address\"},{\"internalType\":\"address\",\"name\":\"_poe\",\"type\":\"address\"}],\"stateMutability\":\"nonpayable\",\"type\":\"constructor\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"_address\",\"type\":\"address\"}],\"name\":\"clonefactoryContractPurchased\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":true,\"internalType\":\"address\",\"name\":\"_address\",\"type\":\"address\"},{\"indexed\":false,\"internalType\":\"string\",\"name\":\"_pubkey\",\"type\":\"string\"}],\"name\":\"contractCreated\",\"type\":\"event\"},{\"inputs\":[],\"name\":\"getContractList\",\"outputs\":[{\"internalType\":\"address[]\",\"name\":\"\",\"type\":\"address[]\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"name\":\"rentalContracts\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"uint256\",\"name\":\"_price\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_limit\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_speed\",\"type\":\"uint256\"},{\"internalType\":\"uint256\",\"name\":\"_length\",\"type\":\"uint256\"},{\"internalType\":\"address\",\"name\":\"_validator\",\"type\":\"address\"},{\"internalType\":\"string\",\"name\":\"_pubKey\",\"type\":\"string\"}],\"name\":\"setCreateNewRentalContract\",\"outputs\":[{\"internalType\":\"address\",\"name\":\"\",\"type\":\"address\"}],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"address\",\"name\":\"contractAddress\",\"type\":\"address\"},{\"internalType\":\"string\",\"name\":\"_cipherText\",\"type\":\"string\"}],\"name\":\"setPurchaseRentalContract\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"}]",
}

// ClonefactoryABI is the input ABI used to generate the binding from.
// Deprecated: Use ClonefactoryMetaData.ABI instead.
var ClonefactoryABI = ClonefactoryMetaData.ABI

// Clonefactory is an auto generated Go binding around an Ethereum contract.
type Clonefactory struct {
	ClonefactoryCaller     // Read-only binding to the contract
	ClonefactoryTransactor // Write-only binding to the contract
	ClonefactoryFilterer   // Log filterer for contract events
}

// ClonefactoryCaller is an auto generated read-only Go binding around an Ethereum contract.
type ClonefactoryCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ClonefactoryTransactor is an auto generated write-only Go binding around an Ethereum contract.
type ClonefactoryTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ClonefactoryFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type ClonefactoryFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// ClonefactorySession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type ClonefactorySession struct {
	Contract     *Clonefactory     // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// ClonefactoryCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type ClonefactoryCallerSession struct {
	Contract *ClonefactoryCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts       // Call options to use throughout this session
}

// ClonefactoryTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type ClonefactoryTransactorSession struct {
	Contract     *ClonefactoryTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts       // Transaction auth options to use throughout this session
}

// ClonefactoryRaw is an auto generated low-level Go binding around an Ethereum contract.
type ClonefactoryRaw struct {
	Contract *Clonefactory // Generic contract binding to access the raw methods on
}

// ClonefactoryCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type ClonefactoryCallerRaw struct {
	Contract *ClonefactoryCaller // Generic read-only contract binding to access the raw methods on
}

// ClonefactoryTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type ClonefactoryTransactorRaw struct {
	Contract *ClonefactoryTransactor // Generic write-only contract binding to access the raw methods on
}

// NewClonefactory creates a new instance of Clonefactory, bound to a specific deployed contract.
func NewClonefactory(address common.Address, backend bind.ContractBackend) (*Clonefactory, error) {
	contract, err := bindClonefactory(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Clonefactory{ClonefactoryCaller: ClonefactoryCaller{contract: contract}, ClonefactoryTransactor: ClonefactoryTransactor{contract: contract}, ClonefactoryFilterer: ClonefactoryFilterer{contract: contract}}, nil
}

// NewClonefactoryCaller creates a new read-only instance of Clonefactory, bound to a specific deployed contract.
func NewClonefactoryCaller(address common.Address, caller bind.ContractCaller) (*ClonefactoryCaller, error) {
	contract, err := bindClonefactory(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &ClonefactoryCaller{contract: contract}, nil
}

// NewClonefactoryTransactor creates a new write-only instance of Clonefactory, bound to a specific deployed contract.
func NewClonefactoryTransactor(address common.Address, transactor bind.ContractTransactor) (*ClonefactoryTransactor, error) {
	contract, err := bindClonefactory(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &ClonefactoryTransactor{contract: contract}, nil
}

// NewClonefactoryFilterer creates a new log filterer instance of Clonefactory, bound to a specific deployed contract.
func NewClonefactoryFilterer(address common.Address, filterer bind.ContractFilterer) (*ClonefactoryFilterer, error) {
	contract, err := bindClonefactory(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &ClonefactoryFilterer{contract: contract}, nil
}

// bindClonefactory binds a generic wrapper to an already deployed contract.
func bindClonefactory(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := abi.JSON(strings.NewReader(ClonefactoryABI))
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Clonefactory *ClonefactoryRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Clonefactory.Contract.ClonefactoryCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Clonefactory *ClonefactoryRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Clonefactory.Contract.ClonefactoryTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Clonefactory *ClonefactoryRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Clonefactory.Contract.ClonefactoryTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Clonefactory *ClonefactoryCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Clonefactory.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Clonefactory *ClonefactoryTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Clonefactory.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Clonefactory *ClonefactoryTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Clonefactory.Contract.contract.Transact(opts, method, params...)
}

// GetContractList is a free data retrieval call binding the contract method 0x99acac8c.
//
// Solidity: function getContractList() view returns(address[])
func (_Clonefactory *ClonefactoryCaller) GetContractList(opts *bind.CallOpts) ([]common.Address, error) {
	var out []interface{}
	err := _Clonefactory.contract.Call(opts, &out, "getContractList")

	if err != nil {
		return *new([]common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new([]common.Address)).(*[]common.Address)

	return out0, err

}

// GetContractList is a free data retrieval call binding the contract method 0x99acac8c.
//
// Solidity: function getContractList() view returns(address[])
func (_Clonefactory *ClonefactorySession) GetContractList() ([]common.Address, error) {
	return _Clonefactory.Contract.GetContractList(&_Clonefactory.CallOpts)
}

// GetContractList is a free data retrieval call binding the contract method 0x99acac8c.
//
// Solidity: function getContractList() view returns(address[])
func (_Clonefactory *ClonefactoryCallerSession) GetContractList() ([]common.Address, error) {
	return _Clonefactory.Contract.GetContractList(&_Clonefactory.CallOpts)
}

// RentalContracts is a free data retrieval call binding the contract method 0x53da0206.
//
// Solidity: function rentalContracts(uint256 ) view returns(address)
func (_Clonefactory *ClonefactoryCaller) RentalContracts(opts *bind.CallOpts, arg0 *big.Int) (common.Address, error) {
	var out []interface{}
	err := _Clonefactory.contract.Call(opts, &out, "rentalContracts", arg0)

	if err != nil {
		return *new(common.Address), err
	}

	out0 := *abi.ConvertType(out[0], new(common.Address)).(*common.Address)

	return out0, err

}

// RentalContracts is a free data retrieval call binding the contract method 0x53da0206.
//
// Solidity: function rentalContracts(uint256 ) view returns(address)
func (_Clonefactory *ClonefactorySession) RentalContracts(arg0 *big.Int) (common.Address, error) {
	return _Clonefactory.Contract.RentalContracts(&_Clonefactory.CallOpts, arg0)
}

// RentalContracts is a free data retrieval call binding the contract method 0x53da0206.
//
// Solidity: function rentalContracts(uint256 ) view returns(address)
func (_Clonefactory *ClonefactoryCallerSession) RentalContracts(arg0 *big.Int) (common.Address, error) {
	return _Clonefactory.Contract.RentalContracts(&_Clonefactory.CallOpts, arg0)
}

// SetCreateNewRentalContract is a paid mutator transaction binding the contract method 0x86712686.
//
// Solidity: function setCreateNewRentalContract(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, address _validator, string _pubKey) returns(address)
func (_Clonefactory *ClonefactoryTransactor) SetCreateNewRentalContract(opts *bind.TransactOpts, _price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _validator common.Address, _pubKey string) (*types.Transaction, error) {
	return _Clonefactory.contract.Transact(opts, "setCreateNewRentalContract", _price, _limit, _speed, _length, _validator, _pubKey)
}

// SetCreateNewRentalContract is a paid mutator transaction binding the contract method 0x86712686.
//
// Solidity: function setCreateNewRentalContract(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, address _validator, string _pubKey) returns(address)
func (_Clonefactory *ClonefactorySession) SetCreateNewRentalContract(_price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _validator common.Address, _pubKey string) (*types.Transaction, error) {
	return _Clonefactory.Contract.SetCreateNewRentalContract(&_Clonefactory.TransactOpts, _price, _limit, _speed, _length, _validator, _pubKey)
}

// SetCreateNewRentalContract is a paid mutator transaction binding the contract method 0x86712686.
//
// Solidity: function setCreateNewRentalContract(uint256 _price, uint256 _limit, uint256 _speed, uint256 _length, address _validator, string _pubKey) returns(address)
func (_Clonefactory *ClonefactoryTransactorSession) SetCreateNewRentalContract(_price *big.Int, _limit *big.Int, _speed *big.Int, _length *big.Int, _validator common.Address, _pubKey string) (*types.Transaction, error) {
	return _Clonefactory.Contract.SetCreateNewRentalContract(&_Clonefactory.TransactOpts, _price, _limit, _speed, _length, _validator, _pubKey)
}

// SetPurchaseRentalContract is a paid mutator transaction binding the contract method 0x739a8353.
//
// Solidity: function setPurchaseRentalContract(address contractAddress, string _cipherText) returns()
func (_Clonefactory *ClonefactoryTransactor) SetPurchaseRentalContract(opts *bind.TransactOpts, contractAddress common.Address, _cipherText string) (*types.Transaction, error) {
	return _Clonefactory.contract.Transact(opts, "setPurchaseRentalContract", contractAddress, _cipherText)
}

// SetPurchaseRentalContract is a paid mutator transaction binding the contract method 0x739a8353.
//
// Solidity: function setPurchaseRentalContract(address contractAddress, string _cipherText) returns()
func (_Clonefactory *ClonefactorySession) SetPurchaseRentalContract(contractAddress common.Address, _cipherText string) (*types.Transaction, error) {
	return _Clonefactory.Contract.SetPurchaseRentalContract(&_Clonefactory.TransactOpts, contractAddress, _cipherText)
}

// SetPurchaseRentalContract is a paid mutator transaction binding the contract method 0x739a8353.
//
// Solidity: function setPurchaseRentalContract(address contractAddress, string _cipherText) returns()
func (_Clonefactory *ClonefactoryTransactorSession) SetPurchaseRentalContract(contractAddress common.Address, _cipherText string) (*types.Transaction, error) {
	return _Clonefactory.Contract.SetPurchaseRentalContract(&_Clonefactory.TransactOpts, contractAddress, _cipherText)
}

// ClonefactoryClonefactoryContractPurchasedIterator is returned from FilterClonefactoryContractPurchased and is used to iterate over the raw logs and unpacked data for ClonefactoryContractPurchased events raised by the Clonefactory contract.
type ClonefactoryClonefactoryContractPurchasedIterator struct {
	Event *ClonefactoryClonefactoryContractPurchased // Event containing the contract specifics and raw log

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
func (it *ClonefactoryClonefactoryContractPurchasedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ClonefactoryClonefactoryContractPurchased)
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
		it.Event = new(ClonefactoryClonefactoryContractPurchased)
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
func (it *ClonefactoryClonefactoryContractPurchasedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ClonefactoryClonefactoryContractPurchasedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ClonefactoryClonefactoryContractPurchased represents a ClonefactoryContractPurchased event raised by the Clonefactory contract.
type ClonefactoryClonefactoryContractPurchased struct {
	Address common.Address
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterClonefactoryContractPurchased is a free log retrieval operation binding the contract event 0xbf1df41b401a1bb8d9bd03fb6fe59b6ced0e61a76cdd3d3d511b4d06eb2cdebe.
//
// Solidity: event clonefactoryContractPurchased(address indexed _address)
func (_Clonefactory *ClonefactoryFilterer) FilterClonefactoryContractPurchased(opts *bind.FilterOpts, _address []common.Address) (*ClonefactoryClonefactoryContractPurchasedIterator, error) {

	var _addressRule []interface{}
	for _, _addressItem := range _address {
		_addressRule = append(_addressRule, _addressItem)
	}

	logs, sub, err := _Clonefactory.contract.FilterLogs(opts, "clonefactoryContractPurchased", _addressRule)
	if err != nil {
		return nil, err
	}
	return &ClonefactoryClonefactoryContractPurchasedIterator{contract: _Clonefactory.contract, event: "clonefactoryContractPurchased", logs: logs, sub: sub}, nil
}

// WatchClonefactoryContractPurchased is a free log subscription operation binding the contract event 0xbf1df41b401a1bb8d9bd03fb6fe59b6ced0e61a76cdd3d3d511b4d06eb2cdebe.
//
// Solidity: event clonefactoryContractPurchased(address indexed _address)
func (_Clonefactory *ClonefactoryFilterer) WatchClonefactoryContractPurchased(opts *bind.WatchOpts, sink chan<- *ClonefactoryClonefactoryContractPurchased, _address []common.Address) (event.Subscription, error) {

	var _addressRule []interface{}
	for _, _addressItem := range _address {
		_addressRule = append(_addressRule, _addressItem)
	}

	logs, sub, err := _Clonefactory.contract.WatchLogs(opts, "clonefactoryContractPurchased", _addressRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ClonefactoryClonefactoryContractPurchased)
				if err := _Clonefactory.contract.UnpackLog(event, "clonefactoryContractPurchased", log); err != nil {
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

// ParseClonefactoryContractPurchased is a log parse operation binding the contract event 0xbf1df41b401a1bb8d9bd03fb6fe59b6ced0e61a76cdd3d3d511b4d06eb2cdebe.
//
// Solidity: event clonefactoryContractPurchased(address indexed _address)
func (_Clonefactory *ClonefactoryFilterer) ParseClonefactoryContractPurchased(log types.Log) (*ClonefactoryClonefactoryContractPurchased, error) {
	event := new(ClonefactoryClonefactoryContractPurchased)
	if err := _Clonefactory.contract.UnpackLog(event, "clonefactoryContractPurchased", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// ClonefactoryContractCreatedIterator is returned from FilterContractCreated and is used to iterate over the raw logs and unpacked data for ContractCreated events raised by the Clonefactory contract.
type ClonefactoryContractCreatedIterator struct {
	Event *ClonefactoryContractCreated // Event containing the contract specifics and raw log

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
func (it *ClonefactoryContractCreatedIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(ClonefactoryContractCreated)
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
		it.Event = new(ClonefactoryContractCreated)
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
func (it *ClonefactoryContractCreatedIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *ClonefactoryContractCreatedIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// ClonefactoryContractCreated represents a ContractCreated event raised by the Clonefactory contract.
type ClonefactoryContractCreated struct {
	Address common.Address
	Pubkey  string
	Raw     types.Log // Blockchain specific contextual infos
}

// FilterContractCreated is a free log retrieval operation binding the contract event 0x1b08e1646439b7521399d47f93ab6b1ebc92803e155d0b2f2ad2d4702a050804.
//
// Solidity: event contractCreated(address indexed _address, string _pubkey)
func (_Clonefactory *ClonefactoryFilterer) FilterContractCreated(opts *bind.FilterOpts, _address []common.Address) (*ClonefactoryContractCreatedIterator, error) {

	var _addressRule []interface{}
	for _, _addressItem := range _address {
		_addressRule = append(_addressRule, _addressItem)
	}

	logs, sub, err := _Clonefactory.contract.FilterLogs(opts, "contractCreated", _addressRule)
	if err != nil {
		return nil, err
	}
	return &ClonefactoryContractCreatedIterator{contract: _Clonefactory.contract, event: "contractCreated", logs: logs, sub: sub}, nil
}

// WatchContractCreated is a free log subscription operation binding the contract event 0x1b08e1646439b7521399d47f93ab6b1ebc92803e155d0b2f2ad2d4702a050804.
//
// Solidity: event contractCreated(address indexed _address, string _pubkey)
func (_Clonefactory *ClonefactoryFilterer) WatchContractCreated(opts *bind.WatchOpts, sink chan<- *ClonefactoryContractCreated, _address []common.Address) (event.Subscription, error) {

	var _addressRule []interface{}
	for _, _addressItem := range _address {
		_addressRule = append(_addressRule, _addressItem)
	}

	logs, sub, err := _Clonefactory.contract.WatchLogs(opts, "contractCreated", _addressRule)
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(ClonefactoryContractCreated)
				if err := _Clonefactory.contract.UnpackLog(event, "contractCreated", log); err != nil {
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

// ParseContractCreated is a log parse operation binding the contract event 0x1b08e1646439b7521399d47f93ab6b1ebc92803e155d0b2f2ad2d4702a050804.
//
// Solidity: event contractCreated(address indexed _address, string _pubkey)
func (_Clonefactory *ClonefactoryFilterer) ParseContractCreated(log types.Log) (*ClonefactoryContractCreated, error) {
	event := new(ClonefactoryContractCreated)
	if err := _Clonefactory.contract.UnpackLog(event, "contractCreated", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
