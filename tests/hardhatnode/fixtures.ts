import { ethers, network } from "hardhat";
import { ApproveSeller, CreateContract, DeployCloneFactory, DeployLumerin } from "../../lib/deploy";
import { Wallet } from "ethers";
import { buildContractsList } from "../../lib/populate-contracts";
import Web3 from "web3";
import { CloneFactory, Lumerin } from "../../build-js/src";
import { parseEther } from "ethers/lib/utils";

export async function deployAllFixture() {
  const cfg = {
    ownerPrKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    sellerPrKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    feeRecipientAddr: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    validatorFeeRate: 0.01,
    sellerAddr: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    buyerAddr: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    marketplaceFee: parseEther("0.0002"),
  };
  const { address: lumerinTokenAddr } = await DeployLumerin(cfg.ownerPrKey);

  const { address: cloneFactoryAddr } = await DeployCloneFactory(
    lumerinTokenAddr,
    cfg.ownerPrKey,
    cfg.feeRecipientAddr,
    cfg.validatorFeeRate
  );

  const web3 = new Web3(network.provider as any);
  const owner = web3.eth.accounts.privateKeyToAccount(cfg.ownerPrKey);
  web3.eth.accounts.wallet.create(0).add(owner);
  const cf = CloneFactory(web3, cloneFactoryAddr);
  await ApproveSeller(owner.address, cf, owner.address);
  await ApproveSeller(cfg.sellerAddr, cf, owner.address);

  const contractList = buildContractsList(false);
  const fee = await cf.methods.marketplaceFee().call();

  const ownerEthers = new Wallet(cfg.ownerPrKey, ethers.provider);
  const sellerEthers = new Wallet(cfg.sellerPrKey, ethers.provider);
  const hrContracts: string[] = [];

  for (const c of contractList) {
    const { address } = await CreateContract(
      String(c.price),
      String(c.length),
      String(c.speed),
      cf,
      sellerEthers,
      fee
    );
    hrContracts.push(address);
  }

  const lmr = Lumerin(web3, lumerinTokenAddr);

  await lmr.methods
    .transfer(cfg.buyerAddr, "100000000000")
    .send({ from: owner.address, gas: 30000000 });

  return { cfg, lumerinTokenAddr, cloneFactoryAddr, fee, owner, ownerEthers, hrContracts, web3 };
}
