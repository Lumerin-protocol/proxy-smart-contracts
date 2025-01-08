import { viem } from "hardhat";
import { requireEnvsSet } from "../lib/utils";
import { privateKeyToAccount } from "viem/accounts";
import { compressPublicKey } from "../lib/pubkey";

async function main() {
  const env = requireEnvsSet(
    "VALIDATOR_PRKEY",
    "VALIDATOR_HOST",
    "VALIDATOR_STAKE",
    "VALIDATOR_REGISTRY_ADDRESS"
  );

  const vr = await viem.getContractAt(
    "ValidatorRegistry",
    env.VALIDATOR_REGISTRY_ADDRESS as `0x${string}`
  );

  const tokenAddr = await vr.read.token();

  const token = await viem.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    tokenAddr
  );

  const account = privateKeyToAccount(`0x${env.VALIDATOR_PRKEY}`);

  const balance = await token.read.balanceOf([account.address]);
  console.log("balance ", balance);

  const pc = await viem.getPublicClient();
  const ethbalance = await pc.getBalance({ address: account.address });
  console.log("balan", ethbalance);

  await token.write.approve(
    [env.VALIDATOR_REGISTRY_ADDRESS as `0x${string}`, BigInt(env.VALIDATOR_STAKE)],
    { account }
  );
  console.log("approved");
  const pubkey = compressPublicKey(account.publicKey);
  console.log(pubkey);
  const tx = await vr.write.validatorRegister(
    [BigInt(env.VALIDATOR_STAKE), pubkey.yParity, pubkey.x, env.VALIDATOR_HOST],
    { account: account }
  );
  console.log(tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
