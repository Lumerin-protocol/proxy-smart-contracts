#!/bin/sh
PTH="./bindings-js"
rm -rf "$PTH"
mkdir -p "$PTH"

ls -la "./templates/js/"
cp -R "./templates/js/." "$PTH"
ls -la $PTH
mkdir -p "$PTH/src/abi"
cp ./abi/CloneFactory.json $PTH/src/abi
cp ./abi/Implementation.json $PTH/src/abi
cp ./abi/Lumerin.json $PTH/src/abi

cd $PTH

ls -la

yarn

# build typing from abi
yarn generate

# build wrapper
yarn build