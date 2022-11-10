# Lumerin Smart Contracts

This repo contains all smart contracts used within Lumerin ecosystem. It is also provides tooling to compile them, deploy to the blockchain, produce ABI, generate JS and Go bindings.

## Details

The most recent smart contracts were moved to `Goerli/clonefactory` folder to avoid code duplication.

The deployment scripts are defined in `package.json` or `scripts` folder. The rest of the codebase is about to be cleaned up.

## Populate script

Populate script for now is not tested

## CI/CD

The CI/CD defined in .gitlab-ci file.

Tasks **deploy-lumerintoken** and **deploy-clonefactory** are decoupled. For **deploy-clonefactory** to use the recent lumerin token it has to be updated in the Gitlab environmental variables.

## Contributions

Please increment ./Goerli/clonefactory/VERSION for the libraries to be released.
