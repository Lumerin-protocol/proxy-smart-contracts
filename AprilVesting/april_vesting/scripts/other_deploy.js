async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Lumerin = await ethers.getContractFactory("Lumerin");
  const lumerin = await Lumerin.deploy();
  await lumerin.deployed()
  console.log("Lumerin address:", lumerin.address);

const FastLumerinDrop = await ethers.getContractFactory("FastLumerinDrop");
const fastLumerinDrop = await FastLumerinDrop.deploy(lumerin.address);
await fastLumerinDrop.deployed()
console.log("fastLumerinDrop address: ", fastLumerinDrop.address)

	await lumerin.transfer(fastLumerinDrop.address, 1000000)
	await lumerin.transfer("0xEeD15Bb091bf3F615400f6F8160aC423EaF6a413", 1000000)
	await fastLumerinDrop.addWallet("0xEeD15Bb091bf3F615400f6F8160aC423EaF6a413", 100)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

