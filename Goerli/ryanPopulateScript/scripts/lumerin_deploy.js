async function main() {
  const Lumerin = await ethers.getContractFactory("Lumerin");
  const lumerin = await Lumerin.deploy();
  await lumerin.deployed()
  console.log("Lumerin address:", lumerin.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

