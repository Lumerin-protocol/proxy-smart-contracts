const assert = require("assert");

const {
  buildContractsList,
  marketplaceConfig,
} = require("./populate-contracts-lib");

//setup
const prodConfig = marketplaceConfig.getContractOptions(true);
const devConfig = marketplaceConfig.getContractOptions(false);

const productionContractsList = buildContractsList(true);
const developmentContractsList = buildContractsList(false);

//contract lengths should match
const productionConfiguredContractCount = prodConfig.reduce(
  (prev, it, i, col) => it.count + prev,
  0
);

const developmentConfiguredContractCount = devConfig.reduce(
  (prev, it, i, col) => it.count + prev,
  0
);

assert.strictEqual(
  productionContractsList.length,
  productionConfiguredContractCount
);

assert.strictEqual(
  developmentContractsList.length,
  developmentConfiguredContractCount
);

//contract speed should match
devConfig.forEach((config) => {
  const contractsWithSpeedLength = developmentContractsList.filter((it) => {
    return (
      it.speed === config.speed * 1000000000000 && it.length === (config.length * 3600)
    );
  }).length;

  assert.strictEqual(contractsWithSpeedLength, config.count);
});

console.log("Tests Passed");
