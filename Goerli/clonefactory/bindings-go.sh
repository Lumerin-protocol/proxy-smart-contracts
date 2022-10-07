#!/bin/sh
rm -rf bindings-go
mkdir -p bindings-go/{clonefactory,implementation,lumerintoken}
abigen --abi=./abi/CloneFactory.json --pkg=clonefactory --out=./bindings-go/clonefactory/clonefactory.go
abigen --abi=./abi/Implementation.json --pkg=implementation --out=./bindings-go/implementation/implementation.go
abigen --abi=./abi/Lumerin.json --pkg=lumerintoken --out=./bindings-go/lumerintoken/lumerintoken.go