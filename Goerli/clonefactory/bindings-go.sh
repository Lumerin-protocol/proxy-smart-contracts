#!/bin/sh
PTH="./bindings-go"
rm -rf "$PTH"

mkdir -p "$PTH/clonefactory"
mkdir -p "$PTH/implementation"
mkdir -p "$PTH/lumerintoken"

ls -la
ls -la abi
ls -la $PTH
abigen --abi=./abi/CloneFactory.json --pkg=clonefactory --out=./$PTH/clonefactory/clonefactory.go
abigen --abi=./abi/Implementation.json --pkg=implementation --out=./$PTH/implementation/implementation.go
abigen --abi=./abi/Lumerin.json --pkg=lumerintoken --out=./$PTH/lumerintoken/lumerintoken.go