#!/bin/sh

PTH="./build-go"
rm -rf "$PTH"

# Create the v2 folder
mkdir -p "$PTH/aggregatorv3interface" 
mkdir -p "$PTH/clonefactory"
mkdir -p "$PTH/faucet"
mkdir -p "$PTH/hashrateoracle"
mkdir -p "$PTH/ierc20"
mkdir -p "$PTH/implementation"
mkdir -p "$PTH/multicall3"
mkdir -p "$PTH/validatorregistry"
mkdir -p "$PTH/futures"
mkdir -p "$PTH/multicallembedded"

abigen --abi=./abi/AggregatorV3Interface.json --pkg=aggregatorv3interface --out=./$PTH/aggregatorv3interface/aggregatorv3interface.go
abigen --abi=./abi/CloneFactory.json --pkg=clonefactory --out=./$PTH/clonefactory/clonefactory.go
abigen --abi=./abi/Faucet.json --pkg=faucet --out=./$PTH/faucet/faucet.go
abigen --abi=./abi/HashrateOracle.json --pkg=hashrateoracle --out=./$PTH/hashrateoracle/hashrateoracle.go
abigen --abi=./abi/IERC20.json --pkg=ierc20 --out=./$PTH/ierc20/ierc20.go
abigen --abi=./abi/Implementation.json --pkg=implementation --out=./$PTH/implementation/implementation.go
abigen --abi=./abi/Multicall3.json --pkg=multicall3 --out=./$PTH/multicall3/multicall3.go
abigen --abi=./abi/ValidatorRegistry.json --pkg=validatorregistry --out=./$PTH/validatorregistry/validatorregistry.go
abigen --abi=./abi/Futures.json --pkg=futures --out=./$PTH/futures/futures.go
abigen --abi=./abi/IMulticallEmbedded.json --pkg=multicallembedded --out=./$PTH/multicallembedded/multicallembedded.go


MAJOR_VERSION=$(cut -d. -f1 VERSION)

cd $PTH
go mod init github.com/Lumerin-protocol/contracts-go/v$MAJOR_VERSION
go mod tidy
cd ..

echo ""
echo "Success!"
echo "Go module initialized for version $MAJOR_VERSION"