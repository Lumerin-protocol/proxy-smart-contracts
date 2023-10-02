function buildContractsList(buildFullMarketplace) {
  let contracts = [];

  marketplaceConfig.getContractOptions(buildFullMarketplace).forEach((config) => {
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

function teraHashesToHashesPerSecond(teraHashes) {
  return teraHashes * Math.pow(10, 12);
}

function louMarinToLou(louMarin) {
  return louMarin * Math.pow(10, 8);
}

function hoursToSeconds(hours) {
  return hours * 3600;
}

const marketplaceConfig = {
  getContractOptions: (buildFullMarketplace) =>
  buildFullMarketplace
      ? [
          { speed: 100, length: 6, price: 2, count: 1 },
          { speed: 100, length: 24, price: 2, count: 38 },
          { speed: 275, length: 6, price: 2, count: 1 },
          { speed: 300, length: 24, price: 2, count: 10 },
        ]
      : [
        { speed: 100, length: 1, price: 1, count: 3 },
        { speed: 100, length: .5, price: 1, count: 3 },
        { speed: 100, length: 2, price: 1, count: 3 }
      ,],
};
//meant for tests only
module.exports = {
  marketplaceConfig: marketplaceConfig,
  buildContractsList: buildContractsList,
};
