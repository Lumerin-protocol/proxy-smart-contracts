# Lumerin Smart Contracts

This repo contains all smart contracts used within Lumerin ecosystem. It is also provides tooling to compile them, deploy to the blockchain, produce ABI, generate JS and Go bindings.

## CI/CD

The CI/CD defined in .gitlab-ci file.

Tasks **deploy-lumerintoken** and **deploy-clonefactory** are decoupled. For **deploy-clonefactory** to use the recent lumerin token it has to be updated in the Gitlab environmental variables.

## Contributions

Please increment VERSION file for the libraries to be released.

### How to run tests

### How to deploy contracts
#### Common first steps
1. Copy `.env.example`  to  `.env` file providing required variables (if known, it refers to contract addresses) 
2. Run `yarn` to install dependencies
3. Run `make compile` to compile smart contracts
4. Check `hardhat.config.js` to ensure deployment target is configured correctly. You can deploy to any of the configured networks by replacing `--network default` to the alias of target network

#### Deploy Lumerin token
1. Deploy LMR with `yarn hardhat run --network default ./scripts/deploy-lumerin.js`. Lumerin address will be displayed in the console.

#### Deploy Clonefactory
1. Update `.env` with relevant Lumerin token address. 
2. Run `yarn hardhat run --network default ./scripts/deploy-clonefactory.js`
3. Clonefactory address will be displayed in the console.

#### Deploy hashrate contracts
1. Update `.env` with relevant Clonefactory address
2. To allow some user to create contracts we need to whitelist his address. Update `CLONE_FACTORY_WHITELIST_ADDRESSES=` with json array of addresses to be whitelisted.
3. Run `yarn hardhat run --network default ./scripts/whitelist-clonefactory.js`
4. To deploy sample contracts run `yarn hardhat run --network default ./scripts/populate-contracts.js`

#### Deploy faucet
1. Update `.env` with relevant Lumerin token address. 
2. Run `yarn hardhat run --network default ./scripts/deploy-faucet.js`

