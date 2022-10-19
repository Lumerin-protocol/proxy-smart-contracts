#!/bin/sh
PTH="./bindings-js"
rm -rf "$PTH"
mkdir -p "$PTH"

# copy project template
cp -R "./templates/js/." "$PTH"

# copy abi's
mkdir -p "$PTH/src/abi"
cp ./abi/CloneFactory.json $PTH/src/abi
cp ./abi/Implementation.json $PTH/src/abi
cp ./abi/Lumerin.json $PTH/src/abi

cd $PTH

# install build dependencies
yarn

# build typing from abi
yarn generate

# build wrapper
yarn build