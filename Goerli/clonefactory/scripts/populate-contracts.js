require("dotenv").config();
const { buildContractsList } = require("./populate-contracts-lib");
const { ethers } = require("hardhat");

const main = async function () {
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const [seller] = await ethers.getSigners();
  const cloneFactory = await CloneFactory.attach(
    process.env.CLONE_FACTORY_ADDRESS
  );

  console.log("Deploying contracts with the seller account:", seller.address);
  console.log("Account balance:", (await seller.getBalance()).toString());
  console.log("CLONEFACTORY address:", process.env.CLONE_FACTORY_ADDRESS);

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
        process.env.VALIDATOR_ADDRESS,
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

const variableList = buildContractsList(process.env.NODE_ENV)

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });