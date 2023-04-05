#!/bin/sh
PTH="./build-js"
rm -rf "$PTH"
mkdir -p "$PTH"

# copy project template
cp -R "./templates/js/." "$PTH"
mv "$PTH/.gitignore-template" "$PTH/.gitignore"

# copy abi's
mkdir -p "$PTH/src/abi"
cp ./abi/CloneFactory.json $PTH/src/abi
cp ./abi/Implementation.json $PTH/src/abi
cp ./abi/Lumerin.json $PTH/src/abi
cp ./abi/Faucet.json $PTH/src/abi

cd $PTH

# install build dependencies
yarn

# build typing from abi
yarn generate

# build wrapper
yarn build