//@ts-check
require("dotenv").config();
const { buildContractsList } = require("./populate-contracts-lib");
const { ethers } = require("hardhat");
const ethereumWallet = require('ethereumjs-wallet')

const remove0xPrefix = privateKey => privateKey.replace('0x', '');

const main = async function () {
  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const [seller] = await ethers.getSigners();
  const cloneFactory = CloneFactory.attach(
    process.env.CLONE_FACTORY_ADDRESS
  );

  console.log("Deploying contracts with the seller account:", seller.address);
  console.log("Account balance:", (await seller.getBalance()).toString());
  console.log("CLONEFACTORY address:", process.env.CLONE_FACTORY_ADDRESS);
  console.log("VALIDATOR address:", process.env.VALIDATOR_ADDRESS)

  const contractList = buildContractsList(
    process.env.BUILD_FULL_MARKETPLACE === "true"
  );

  const pubKey = ethereumWallet.fromPrivateKey(
    Buffer.from(remove0xPrefix(process.env.CONTRACTS_OWNER_PRIVATE_KEY), 'hex')
  ).getPublicKey()

  for (const c of contractList) {
    const contractCreate = await cloneFactory
      .connect(seller)
      .setCreateNewRentalContract(
        c.price,
        0,
        c.speed,
        c.length,
        process.env.VALIDATOR_ADDRESS,
        pubKey.toString('hex'),
        {
          gasLimit: 10000000,
        }
      );

    const tx = await contractCreate.wait();
    console.log(`contract created, tx hash:`, contractCreate.hash, " gas used: ", tx.gasUsed.toString());
    break
  }
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
