import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Initialized,
  OwnershipTransferred,
  Upgraded,
  clonefactoryContractPurchased,
  contractCreated,
  contractDeleteUpdated,
  contractHardDeleted,
  purchaseInfoUpdated,
  validatorFeeRateUpdated
} from "../generated/CloneFactory/CloneFactory"

export function createInitializedEvent(version: BigInt): Initialized {
  let initializedEvent = changetype<Initialized>(newMockEvent())

  initializedEvent.parameters = new Array()

  initializedEvent.parameters.push(
    new ethereum.EventParam(
      "version",
      ethereum.Value.fromUnsignedBigInt(version)
    )
  )

  return initializedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createUpgradedEvent(implementation: Address): Upgraded {
  let upgradedEvent = changetype<Upgraded>(newMockEvent())

  upgradedEvent.parameters = new Array()

  upgradedEvent.parameters.push(
    new ethereum.EventParam(
      "implementation",
      ethereum.Value.fromAddress(implementation)
    )
  )

  return upgradedEvent
}

export function createclonefactoryContractPurchasedEvent(
  _address: Address,
  _validator: Address
): clonefactoryContractPurchased {
  let clonefactoryContractPurchasedEvent =
    changetype<clonefactoryContractPurchased>(newMockEvent())

  clonefactoryContractPurchasedEvent.parameters = new Array()

  clonefactoryContractPurchasedEvent.parameters.push(
    new ethereum.EventParam("_address", ethereum.Value.fromAddress(_address))
  )
  clonefactoryContractPurchasedEvent.parameters.push(
    new ethereum.EventParam(
      "_validator",
      ethereum.Value.fromAddress(_validator)
    )
  )

  return clonefactoryContractPurchasedEvent
}

export function createcontractCreatedEvent(
  _address: Address,
  _pubkey: string
): contractCreated {
  let contractCreatedEvent = changetype<contractCreated>(newMockEvent())

  contractCreatedEvent.parameters = new Array()

  contractCreatedEvent.parameters.push(
    new ethereum.EventParam("_address", ethereum.Value.fromAddress(_address))
  )
  contractCreatedEvent.parameters.push(
    new ethereum.EventParam("_pubkey", ethereum.Value.fromString(_pubkey))
  )

  return contractCreatedEvent
}

export function createcontractDeleteUpdatedEvent(
  _address: Address,
  _isDeleted: boolean
): contractDeleteUpdated {
  let contractDeleteUpdatedEvent =
    changetype<contractDeleteUpdated>(newMockEvent())

  contractDeleteUpdatedEvent.parameters = new Array()

  contractDeleteUpdatedEvent.parameters.push(
    new ethereum.EventParam("_address", ethereum.Value.fromAddress(_address))
  )
  contractDeleteUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "_isDeleted",
      ethereum.Value.fromBoolean(_isDeleted)
    )
  )

  return contractDeleteUpdatedEvent
}

export function createcontractHardDeletedEvent(
  _address: Address
): contractHardDeleted {
  let contractHardDeletedEvent = changetype<contractHardDeleted>(newMockEvent())

  contractHardDeletedEvent.parameters = new Array()

  contractHardDeletedEvent.parameters.push(
    new ethereum.EventParam("_address", ethereum.Value.fromAddress(_address))
  )

  return contractHardDeletedEvent
}

export function createpurchaseInfoUpdatedEvent(
  _address: Address
): purchaseInfoUpdated {
  let purchaseInfoUpdatedEvent = changetype<purchaseInfoUpdated>(newMockEvent())

  purchaseInfoUpdatedEvent.parameters = new Array()

  purchaseInfoUpdatedEvent.parameters.push(
    new ethereum.EventParam("_address", ethereum.Value.fromAddress(_address))
  )

  return purchaseInfoUpdatedEvent
}

export function createvalidatorFeeRateUpdatedEvent(
  _validatorFeeRateScaled: BigInt
): validatorFeeRateUpdated {
  let validatorFeeRateUpdatedEvent =
    changetype<validatorFeeRateUpdated>(newMockEvent())

  validatorFeeRateUpdatedEvent.parameters = new Array()

  validatorFeeRateUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "_validatorFeeRateScaled",
      ethereum.Value.fromUnsignedBigInt(_validatorFeeRateScaled)
    )
  )

  return validatorFeeRateUpdatedEvent
}
