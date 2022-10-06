#!/bin/sh
mkdir -p go/clonefactory go/implementation go/lumerintoken
abigen --abi=./abi/CloneFactory.json --pkg=clonefactory --out=./go/clonefactory/clonefactory.go
abigen --abi=./abi/Implementation.json --pkg=implementation --out=./go/implementation/implementation.go
abigen --abi=./abi/Lumerin.json --pkg=lumerintoken --out=./go/lumerintoken/lumerintoken.go