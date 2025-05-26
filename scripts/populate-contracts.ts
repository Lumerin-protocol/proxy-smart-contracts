import { hoursToSeconds, requireEnvsSet, THPStoHPS } from "../lib/utils";
import { viem } from "hardhat";
import { getBalance } from "viem/actions";
import { sampleContracts } from "../tests/hardhatnode/fixtures-2";
import { getPublicKey } from "../lib/pubkey";
import { parseEventLogs } from "viem/utils";
import { privateKeyToAccount } from "viem/accounts";

async function main() {
  console.log("Contracts population script");

  const env = requireEnvsSet("CLONE_FACTORY_ADDRESS", "SELLER_PRIVATEKEY");
  const seller = privateKeyToAccount(`0x${env.SELLER_PRIVATEKEY}`);
  const pc = await viem.getPublicClient();

  console.log("Deploying contracts with the seller account:", seller.address);
  const balance = await getBalance(pc, { address: seller.address });
  console.log("Account balance:", balance.toString());
  console.log("CLONEFACTORY address:", env.CLONE_FACTORY_ADDRESS);

  const cf = await viem.getContractAt("CloneFactory", env.CLONE_FACTORY_ADDRESS as `0x${string}`);

  for (const contract of sampleContracts) {
    for (let i = 0; i < contract.count; i++) {
      const hash = await cf.write.setCreateNewRentalContractV2(
        [
          0n,
          0n,
          BigInt(THPStoHPS(contract.config.speedTHPS)),
          BigInt(hoursToSeconds(contract.config.lengthHours)),
          Number(contract.config.profitTargetPercent),
          seller.address,
          await getPublicKey({ account: seller }),
        ],
        { account: seller }
      );

      /*const receipt =*/ await pc.waitForTransactionReceipt({ hash });
      // const [event] = parseEventLogs({
      //   logs: receipt.logs,
      //   abi: cf.abi,
      //   eventName: "contractCreated",
      // });
      // const address = event.args._address;

      // const hrContract = await viem.getContractAt("Implementation", address);
      // const [price, fee] = await hrContract.read.priceAndFee();
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
