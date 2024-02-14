
#!/bin/bash

#
# Deploys all contracts to local blockchain
#

# wait until node is available
yarn wait-on tcp:127.0.0.1:8545 -l

# set global variables
# two first default addresses for hardhat local network
export OWNER_PRIVATEKEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# update implementation
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/update-implementation.js

# update clonefactory
yarn hardhat run --network localhost --config hardhat-base.config.js ./scripts/update-clonefactory.js

echo "Update finished"