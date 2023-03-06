#!/bin/bash

#
# Deploys all contracts to local blockchain
#

# wait until node is available
yarn wait-on http://127.0.0.1:8545 -l

# set global variables
# two first default addresses for hardhat local network
export CLONE_FACTORY_WHITELIST_ADDRESSES='["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]'

# deploy lumerin token
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/deploy-lumerin.js
export LUMERIN_TOKEN_ADDRESS="$(cat lumerin-addr.tmp)"
export VALIDATOR_ADDRESS="$(cat lumerin-addr.tmp)" # currently unused

# deploy faucet
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/deploy-faucet.js 

# deploy clonefactory
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/deploy-clonefactory.js
export CLONE_FACTORY_ADDRESS="$(cat clonefactory-addr.tmp)"

# whitelist clonefactory addresses
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/whitelist-clonefactory.js

# populate contracts
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/populate-contracts.js
