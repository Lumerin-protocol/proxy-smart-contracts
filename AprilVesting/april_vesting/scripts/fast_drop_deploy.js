async function main() {
  const [deployer] = await ethers.getSigners();
	const FastLumerinDrop = await ethers.getContractFactory("FastLumerinDrop");
	const fastLumerinDrop = await FastLumerinDrop.deploy();
	await fastLumerinDrop.deployed()
	console.log("fastLumerinDrop address: ", fastLumerinDrop.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

