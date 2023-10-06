#!/bin/sh
PTH="./build-go"
rm -rf "$PTH"

mkdir -p "$PTH/clonefactory"
mkdir -p "$PTH/implementation"
mkdir -p "$PTH/lumerintoken"
mkdir -p "$PTH/faucet"

abigen --abi=./abi/CloneFactory.json --pkg=clonefactory --out=./$PTH/clonefactory/clonefactory.go
abigen --abi=./abi/Implementation.json --pkg=implementation --out=./$PTH/implementation/implementation.go
abigen --abi=./abi/Lumerin.json --pkg=lumerintoken --out=./$PTH/lumerintoken/lumerintoken.go
abigen --abi=./abi/Faucet.json --pkg=faucet --out=./$PTH/faucet/faucet.go

cd $PTH
go mod init github.com/Lumerin-protocol/contracts-go
go mod tidy