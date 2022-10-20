require("dotenv").config();
let { ethers } = require("hardhat");

let seller;
let cloneFactory;

let populateContracts = async function () {
  let CloneFactory = await ethers.getContractFactory("CloneFactory");
  [seller] = await ethers.getSigners();
  cloneFactory = await CloneFactory.attach(process.env.CLONEFACTORY_ADDR);
  //deploying with the validator as the address collecting titans lumerin

  let variableList = [
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
        ""
      );
    await contractCreate.wait();
  }
};

populateContracts();
