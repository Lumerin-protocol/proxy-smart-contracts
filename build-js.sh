#!/bin/sh
PTH="./build-js"
rm -rf "$PTH"
mkdir -p "$PTH"

# copy project template
cp -R "./templates/js/." "$PTH"
mv "$PTH/.gitignore-template" "$PTH/.gitignore"

# copy abi's
mkdir -p "$PTH/src/abi"

#copy viem abi (as const)
yarn wagmi generate

#TODO: copy abi's from artifacts/contracts to get the bytecode
cp ./artifacts/contracts/CloneFactory.sol/CloneFactory.json $PTH/src/abi
cp ./artifacts/contracts/Implementation.sol/Implementation.json $PTH/src/abi
cp ./artifacts/contracts/LumerinToken.sol/Lumerin.json $PTH/src/abi
cp ./artifacts/contracts/Faucet.sol/Faucet.json $PTH/src/abi
cp ./artifacts/contracts/validator-registry/ValidatorRegistry.sol/ValidatorRegistry.json $PTH/src/abi
cp ./abi/IERC20.json $PTH/src/abi

cd $PTH

# install build dependencies
yarn

# build typing from abi
yarn generate

# build wrapper
yarn build