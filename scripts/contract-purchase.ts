import { ethers } from "hardhat"
import { encrypt } from 'ecies-geth'
import { add65BytesPrefix, requireEnvsSet, trimRight64Bytes } from "../lib/utils"

async function main() {
  const env = requireEnvsSet("CONTRACT_ADDRESS", "VALIDATOR_URL", "DEST_URL", "LUMERIN_ADDRESS", "CLONE_FACTORY_ADDRESS", "VALIDATOR_PRIVATE_KEY");

  console.log("Sending lumerin")
  console.log(`Using Lumerin address: ${env.LUMERIN_ADDRESS}`);
  const lumerin = await ethers.getContractAt("Lumerin", env.LUMERIN_ADDRESS);
  const [seller, buyer] = await ethers.getSigners();
  const sendLumerin = await lumerin.connect(seller).transfer(buyer.address, 1000 * 10 ** 8)
  await sendLumerin.wait();
  console.log(`Sent lumerin to ${buyer.address}`)

  // authorize
  console.log("Authorizing clone factory to spend lumerin")
  const authorize = await lumerin.connect(buyer).approve(env.CLONE_FACTORY_ADDRESS, 1000 * 10 ** 8)
  await authorize.wait();
  console.log('authorized')

  console.log(`Purchasing contract: ${env.CONTRACT_ADDRESS}`);
  console.log(`Using buyer address: ${buyer.address}`);
  console.log("\n");

  const CloneFactory = await ethers.getContractFactory("CloneFactory");
  const cloneFactory = CloneFactory.attach(env.CLONE_FACTORY_ADDRESS);
  console.log("Using account:", buyer.address);
  console.log("Account balance:", (await buyer.getBalance()).toString());
  console.log(`CLONEFACTORY address: ${env.CLONE_FACTORY_ADDRESS}`);
  console.log("Account owner", await cloneFactory.owner())
  console.log("\n");

  const fee = await cloneFactory.marketplaceFee();
  console.log(`marketplace fee: ${fee} wei`);

  const Implementation = await ethers.getContractFactory("Implementation");
  const implementation = Implementation.attach(env.CONTRACT_ADDRESS);
  const pubKey = await implementation.pubKey()

  const encryptedValidatorURL = await encrypt(
    Buffer.from(add65BytesPrefix(pubKey), 'hex'),
    Buffer.from(env.VALIDATOR_URL)
  )

  const validator = new ethers.Wallet(env.VALIDATOR_PRIVATE_KEY)
  const pubKey2 = add65BytesPrefix(trimRight64Bytes(validator.publicKey))

  const encryptedDestURL = await encrypt(
    Buffer.from(pubKey2, 'hex'),
    Buffer.from(env.DEST_URL)
  )

  const purchase = await cloneFactory.connect(buyer).setPurchaseRentalContractV2(
    env.CONTRACT_ADDRESS, 
    validator.address, 
    encryptedValidatorURL.toString('hex'), 
    encryptedDestURL.toString('hex'), 
    0, 
    { value: fee.toString() }
  )
  const receipt = await purchase.wait();

  console.log(receipt)

  console.log(`Purchased: ${env.CONTRACT_ADDRESS}, gas used ${receipt.gasUsed.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
