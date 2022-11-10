require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  try{
    const whitelistedAddresses = JSON.parse(process.env.CLONE_FACTORY_WHITELIST_ADDRESSES)
    if (!Array.isArray(whitelistedAddresses)){
      throw new Error("Is not a valid array")
    }
  } catch(err){
    throw new Error(`Invalid CLONE_FACTORY_WHITELIST_ADDRESSES, should be a JSON array of strings: ${err}`)
  }

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const [account] = await ethers.getSigners();
  const cloneFactory = CloneFactory.attach(process.env.CLONE_FACTORY_ADDRESS);

  console.log(`Whitelisting ${whitelistedAddresses.length} addresses`);
  console.log("\n")
  console.log("Using account:", account.address);
  console.log("Account balance:", (await account.getBalance()).toString());
  console.log(`CLONEFACTORY address: ${process.env.CLONE_FACTORY_ADDRESS}`);
  console.log("\n")

  for (const address of whitelistedAddresses){
    const addToWhitelist = await cloneFactory
      .connect(account)
      .setAddToWhitelist(address);
    await addToWhitelist.wait();

    console.log(`Added to whitelist: ${address}`)
  }

  console.log("\n")
  console.log("Whitelisting finished")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
