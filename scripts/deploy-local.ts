import { deployLocalFixture } from "../tests/hardhatnode/fixtures-2";
import { run } from "hardhat";

async function main() {
  console.log("Starting local deployment...");
  await run("compile");

  const runPromise = run("node");
  const { contracts, config } = await deployLocalFixture();

  console.log("Deployment completed successfully!");
  console.log("Contract addresses:");
  console.log("Lumerin Token:", contracts.lumerinToken.address);
  console.log("USDC Mock:", contracts.usdcMock.address);
  console.log("BTC Price Oracle Mock:", contracts.btcPriceOracleMock.address);
  console.log("HashrateOracle:", contracts.hashrateOracle.address);
  console.log("Faucet:", contracts.faucet.address);
  console.log("Implementation:", contracts.implementation.address);
  console.log("CloneFactory:", contracts.cloneFactory.address);
  console.log("ValidatorRegistry:", contracts.validatorRegistry.address);
  console.log("Multicall3:", contracts.multicall3.address);
  console.log();
  console.log("Contract addresses: ");
  config.cloneFactory.contractAddresses.map((addr, index) => console.log(`${index}:`, addr));

  await runPromise;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
