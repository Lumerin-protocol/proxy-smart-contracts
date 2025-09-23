import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Initialized,
  closedEarly,
  contractClosedEarly,
  contractPurchased,
  contractPurchased1,
  destinationUpdated,
  fundsClaimed,
  purchaseInfoUpdated
} from "../generated/Implementation/Implementation"

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

export function createclosedEarlyEvent(_reason: i32): closedEarly {
  let closedEarlyEvent = changetype<closedEarly>(newMockEvent())

  closedEarlyEvent.parameters = new Array()

  closedEarlyEvent.parameters.push(
    new ethereum.EventParam(
      "_reason",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(_reason))
    )
  )

  return closedEarlyEvent
}

export function createcontractClosedEarlyEvent(
  _buyer: Address,
  _validator: Address,
  _seller: Address,
  _reason: i32
): contractClosedEarly {
  let contractClosedEarlyEvent = changetype<contractClosedEarly>(newMockEvent())

  contractClosedEarlyEvent.parameters = new Array()

  contractClosedEarlyEvent.parameters.push(
    new ethereum.EventParam("_buyer", ethereum.Value.fromAddress(_buyer))
  )
  contractClosedEarlyEvent.parameters.push(
    new ethereum.EventParam(
      "_validator",
      ethereum.Value.fromAddress(_validator)
    )
  )
  contractClosedEarlyEvent.parameters.push(
    new ethereum.EventParam("_seller", ethereum.Value.fromAddress(_seller))
  )
  contractClosedEarlyEvent.parameters.push(
    new ethereum.EventParam(
      "_reason",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(_reason))
    )
  )

  return contractClosedEarlyEvent
}

export function createcontractPurchasedEvent(
  _buyer: Address
): contractPurchased {
  let contractPurchasedEvent = changetype<contractPurchased>(newMockEvent())

  contractPurchasedEvent.parameters = new Array()

  contractPurchasedEvent.parameters.push(
    new ethereum.EventParam("_buyer", ethereum.Value.fromAddress(_buyer))
  )

  return contractPurchasedEvent
}

export function createcontractPurchased1Event(
  _buyer: Address,
  _validator: Address,
  _seller: Address,
  _price: BigInt,
  _fee: BigInt
): contractPurchased1 {
  let contractPurchased1Event = changetype<contractPurchased1>(newMockEvent())

  contractPurchased1Event.parameters = new Array()

  contractPurchased1Event.parameters.push(
    new ethereum.EventParam("_buyer", ethereum.Value.fromAddress(_buyer))
  )
  contractPurchased1Event.parameters.push(
    new ethereum.EventParam(
      "_validator",
      ethereum.Value.fromAddress(_validator)
    )
  )
  contractPurchased1Event.parameters.push(
    new ethereum.EventParam("_seller", ethereum.Value.fromAddress(_seller))
  )
  contractPurchased1Event.parameters.push(
    new ethereum.EventParam("_price", ethereum.Value.fromUnsignedBigInt(_price))
  )
  contractPurchased1Event.parameters.push(
    new ethereum.EventParam("_fee", ethereum.Value.fromUnsignedBigInt(_fee))
  )

  return contractPurchased1Event
}

export function createdestinationUpdatedEvent(
  newValidatorURL: string,
  newDestURL: string
): destinationUpdated {
  let destinationUpdatedEvent = changetype<destinationUpdated>(newMockEvent())

  destinationUpdatedEvent.parameters = new Array()

  destinationUpdatedEvent.parameters.push(
    new ethereum.EventParam(
      "newValidatorURL",
      ethereum.Value.fromString(newValidatorURL)
    )
  )
  destinationUpdatedEvent.parameters.push(
    new ethereum.EventParam("newDestURL", ethereum.Value.fromString(newDestURL))
  )

  return destinationUpdatedEvent
}

export function createfundsClaimedEvent(): fundsClaimed {
  let fundsClaimedEvent = changetype<fundsClaimed>(newMockEvent())

  fundsClaimedEvent.parameters = new Array()

  return fundsClaimedEvent
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
