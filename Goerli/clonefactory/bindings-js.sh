#!/bin/sh
PTH="./bindings-js"
echo $PTH
rm -rf $PTH
mkdir -p $PTH/src/abi

ls -la

cp -r ./templates/js/ $PTH
cp ./abi/CloneFactory.json $PTH/src/abi
cp ./abi/Implementation.json $PTH/src/abi
cp ./abi/Lumerin.json $PTH/src/abi

cd $PTH
yarn

# build typing from abi
yarn generate

# build wrapper
yarn build