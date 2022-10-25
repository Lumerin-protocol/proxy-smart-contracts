require("dotenv").config();
const { ethers } = require("hardhat");

const main = async function () {
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const [seller] = await ethers.getSigners();
  const cloneFactory = await CloneFactory.attach(process.env.CLONEFACTORY_ADDR);

  console.log("Deploying contracts with the seller account:", seller.address);
  console.log("Account balance:", (await seller.getBalance()).toString());
  console.log("CLONEFACTORY address:", process.env.CLONEFACTORY_ADDR);

  //deploying with the validator as the address collecting titans lumerin

  /*
   * variables should be a list of arrays
   */
  for (let c of variableList) {
    let contractCreate = await cloneFactory
      .connect(seller)
      .setCreateNewRentalContract(
        c["price"],
        0,
        c["speed"],
        c["length"],
        process.env.VALIDATOR_TOKEN_ADDR,
        "",
        {
          gasLimit: 10000000,
          nonce: 1,
        }
      );

    await contractCreate.wait();
    console.log(`created contract`, contractCreate);
  }
};

const variableList = [
  { speed: 50000000000000, length: 12 * 3600, price: 200000000 },
  { speed: 50000000000000, length: 12 * 3600, price: 200000000 },
  { speed: 50000000000000, length: 12 * 3600, price: 200000000 },
  { speed: 50000000000000, length: 12 * 3600, price: 200000000 },
  { speed: 50000000000000, length: 24 * 3600, price: 400000000 },
  { speed: 50000000000000, length: 24 * 3600, price: 400000000 },
  { speed: 50000000000000, length: 24 * 3600, price: 400000000 },
  { speed: 50000000000000, length: 24 * 3600, price: 400000000 },
  { speed: 50000000000000, length: 48 * 3600, price: 700000000 },
  { speed: 50000000000000, length: 48 * 3600, price: 700000000 },
  { speed: 50000000000000, length: 48 * 3600, price: 700000000 },
  { speed: 50000000000000, length: 48 * 3600, price: 700000000 },
  { speed: 100000000000000, length: 12 * 3600, price: 400000000 },
  { speed: 100000000000000, length: 12 * 3600, price: 400000000 },
  { speed: 100000000000000, length: 12 * 3600, price: 400000000 },
  { speed: 100000000000000, length: 12 * 3600, price: 400000000 },
  { speed: 100000000000000, length: 24 * 3600, price: 700000000 },
  { speed: 100000000000000, length: 24 * 3600, price: 700000000 },
  { speed: 100000000000000, length: 24 * 3600, price: 700000000 },
  { speed: 100000000000000, length: 24 * 3600, price: 700000000 },
  { speed: 100000000000000, length: 48 * 3600, price: 1400000000 },
  { speed: 100000000000000, length: 48 * 3600, price: 1400000000 },
  { speed: 100000000000000, length: 48 * 3600, price: 1400000000 },
  { speed: 100000000000000, length: 48 * 3600, price: 1400000000 },
  { speed: 150000000000000, length: 12 * 3600, price: 500000000 },
  { speed: 150000000000000, length: 12 * 3600, price: 500000000 },
  { speed: 150000000000000, length: 12 * 3600, price: 500000000 },
  { speed: 150000000000000, length: 24 * 3600, price: 1100000000 },
  { speed: 150000000000000, length: 24 * 3600, price: 1100000000 },
  { speed: 150000000000000, length: 24 * 3600, price: 1100000000 },
  { speed: 150000000000000, length: 48 * 3600, price: 2100000000 },
  { speed: 150000000000000, length: 48 * 3600, price: 2100000000 },
  { speed: 150000000000000, length: 48 * 3600, price: 2100000000 },
  { speed: 200000000000000, length: 12 * 3600, price: 700000000 },
  { speed: 200000000000000, length: 12 * 3600, price: 700000000 },
  { speed: 200000000000000, length: 24 * 3600, price: 1400000000 },
  { speed: 200000000000000, length: 24 * 3600, price: 1400000000 },
  { speed: 200000000000000, length: 48 * 3600, price: 2900000000 },
  { speed: 200000000000000, length: 48 * 3600, price: 2900000000 },
  { speed: 250000000000000, length: 12 * 3600, price: 900000000 },
  { speed: 250000000000000, length: 12 * 3600, price: 900000000 },
  { speed: 250000000000000, length: 24 * 3600, price: 1800000000 },
  { speed: 250000000000000, length: 24 * 3600, price: 1800000000 },
  { speed: 250000000000000, length: 48 * 3600, price: 3600000000 },
  { speed: 250000000000000, length: 48 * 3600, price: 3600000000 },
  { speed: 300000000000000, length: 12 * 3600, price: 1100000000 },
  { speed: 300000000000000, length: 12 * 3600, price: 1100000000 },
  { speed: 300000000000000, length: 24 * 3600, price: 2100000000 },
  { speed: 300000000000000, length: 24 * 3600, price: 2100000000 },
  { speed: 300000000000000, length: 48 * 3600, price: 4300000000 },
  { speed: 300000000000000, length: 48 * 3600, price: 4300000000 },
  { speed: 350000000000000, length: 12 * 3600, price: 1300000000 },
  { speed: 350000000000000, length: 12 * 3600, price: 1300000000 },
  { speed: 350000000000000, length: 24 * 3600, price: 2500000000 },
  { speed: 350000000000000, length: 24 * 3600, price: 2500000000 },
  { speed: 350000000000000, length: 48 * 3600, price: 5000000000 },
  { speed: 350000000000000, length: 48 * 3600, price: 5000000000 },
];

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
