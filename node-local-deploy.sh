
#!/bin/bash

#
# Deploys all contracts to local blockchain
#

# wait until node is available
yarn wait-on tcp:127.0.0.1:8545 -l

# set global variables
# two first default addresses for hardhat local network
export CLONE_FACTORY_WHITELIST_ADDRESSES='["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]'
export OWNER_PRIVATEKEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export SELLER_PRIVATEKEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export FEE_RECIPIENT_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
export FAUCET_DAILY_MAX_LMR=80000000000 # 800 LMR
export FAUCET_LMR_PAYOUT=200000000 # 2 LMR
export FAUCET_ETH_PAYOUT=10000000000000000 # 0.01 ETH
export VALIDATOR_FEE_RATE="0.01"
export BUILD_FULL_MARKETPLACE=false
export VALIDATOR_STAKE_MINIMUM=100000000000
export VALIDATOR_STAKE_REGISTER=1000000000000
export VALIDATOR_PUNISH_AMOUNT=100000000000
export VALIDATOR_PUNISH_THRESHOLD=3

# deploy fee token
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/deploy-lumerin.ts
export LUMERIN_TOKEN_ADDRESS="$(cat lumerin-addr.tmp)"

# deploy payment token
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/deploy-lumerin.ts
export LUMERIN_TOKEN_ADDRESS="$(cat lumerin-addr.tmp)"

# deploy faucet
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/deploy-faucet.ts 

# deploy clonefactory
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/deploy-clonefactory.ts
export CLONE_FACTORY_ADDRESS="$(cat clonefactory-addr.tmp)"

# whitelist clonefactory addresses
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/whitelist-clonefactory.ts

# populate contracts
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/populate-contracts.ts

# validator registry
yarn hardhat run --network localhost --config hardhat.config.ts ./scripts/deploy-validator-registry.ts
