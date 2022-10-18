#!/bin/sh
PTH="./bindings-js"
rm -rf $PTH
mkdir -p $PTH

cp ./templates/js $PTH
cp ./abi/CloneFactory.json $PTH/src/abi
cp ./abi/Implementation.json $PTH/src/abi
cp ./abi/Lumerin.json $PTH/src/abi

cd $PTH
yarn

# build typing from abi
yarn generate

# build wrapper
yarn build