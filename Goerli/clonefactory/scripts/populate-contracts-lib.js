function buildContractsList(env) {
  let contracts = [];

  marketplaceConfig.getContractOptions(env).forEach((config) => {
    const { count, ...contract } = config;

    for (i = 0; i < count; i++) {
      contracts.push({
        speed: teraHashesToHashesPerSecond(contract.speed),
        price: louMarinToLou(contract.price),
        length: hoursToSeconds(contract.length),
      });
    }
  });

  return contracts;
}

module.exports.buildContractsList = buildContractsList;

function teraHashesToHashesPerSecond(teraHashes) {
  return teraHashes * 1000000000000;
}

function louMarinToLou(louMarin) {
  return louMarin * 100000000;
}

function hoursToSeconds(hours) {
  return hours * 3600;
}

const marketplaceConfig = {
  getContractOptions: (env) =>
    env === "production"
      ? [
          { speed: 100, length: 6, price: 2, count: 1 },
          { speed: 100, length: 24, price: 2, count: 38 },
          { speed: 275, length: 6, price: 2, count: 1 },
          { speed: 300, length: 24, price: 2, count: 10 },
        ]
      : [{ speed: 100, length: 6, price: 2, count: 5 }],
};
//meant for tests only
module.exports.marketplaceConfig = marketplaceConfig