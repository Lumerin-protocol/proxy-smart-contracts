
#!/bin/bash

#
# Deploys all contracts to local blockchain
#

# wait until node is available
yarn wait-on tcp:127.0.0.1:8545 -l

# set global variables
# two first default addresses for hardhat local network
export CLONE_FACTORY_WHITELIST_ADDRESSES='["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]'
export CONTRACTS_OWNER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

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