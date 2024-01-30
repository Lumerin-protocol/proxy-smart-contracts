#!/bin/sh

PTH="./build-go"
ABI_PTH="./artifacts/contracts"

rm -rf "$PTH"

mkdir -p "$PTH/clonefactory"
mkdir -p "$PTH/implementation"
mkdir -p "$PTH/lumerintoken"
mkdir -p "$PTH/faucet"

jq -r ".abi" $ABI_PTH/CloneFactory.sol/CloneFactory.json | abigen --abi=-  --pkg=clonefactory --out=$PTH/clonefactory/clonefactory.go
jq -r ".abi" $ABI_PTH/Implementation.sol/Implementation.json | abigen --abi=- --pkg=implementation --out=$PTH/implementation/implementation.go
jq -r ".abi" $ABI_PTH/LumerinToken.sol/Lumerin.json | abigen --abi=- --pkg=lumerintoken --out=$PTH/lumerintoken/lumerintoken.go
jq -r ".abi" $ABI_PTH/Faucet.sol/Faucet.json | abigen --abi=- --pkg=faucet --out=$PTH/faucet/faucet.go