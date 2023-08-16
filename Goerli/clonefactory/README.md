# Smart contracts

### Smart contract development

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

