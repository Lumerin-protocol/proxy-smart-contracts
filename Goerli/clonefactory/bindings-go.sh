#!/bin/sh
PATH="./bindings-go"
rm -rf $PATH

mkdir -p $PATH/clonefactory
mkdir -p $PATH/implementation
mkdir -p $PATH/lumerintoken

ls -la
ls -la abi
ls -la $PATH
abigen --abi=./abi/CloneFactory.json --pkg=clonefactory --out=./$PATH/clonefactory/clonefactory.go
abigen --abi=./abi/Implementation.json --pkg=implementation --out=./$PATH/implementation/implementation.go
abigen --abi=./abi/Lumerin.json --pkg=lumerintoken --out=./$PATH/lumerintoken/lumerintoken.go