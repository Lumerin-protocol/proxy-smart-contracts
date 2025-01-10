import { expect } from "chai";
import hardhat from "hardhat";
import Web3 from "web3";
import { LocalTestnetAddresses, expectIsError } from "../utils";
import { RandomEthAddress, RandomIPAddress, ToString, AdvanceBlockTime } from "../utils";
import { Faucet, Lumerin } from "../../build-js/dist";

describe("Faucet", function () {
  const { lumerinAddress, faucetAddress, owner } = LocalTestnetAddresses;

  const ipAddress = RandomIPAddress();
  const claiment = RandomEthAddress();

  const web3 = new Web3(hardhat.config.networks.localhost.url);
  const lumerinInstance = Lumerin(web3, lumerinAddress);
  const faucetInstance = Faucet(web3, faucetAddress);

  before(async () => {
    // load balance to faucet
    await lumerinInstance.methods
      .transfer(faucetAddress, ToString(1000 * 10 ** 8))
      .send({ from: owner });

    await web3.eth.sendTransaction({
      from: owner,
      to: faucetAddress,
      value: ToString(1000 * 10 ** 18),
    });
  });

  it("should send correct amount of lmr and eth", async function () {
    await faucetInstance.methods.supervisedClaim(claiment, ipAddress).send({ from: owner });

    const claimentLMNBalance = Number(await lumerinInstance.methods.balanceOf(claiment).call());
    const claimentETHBalance = Number(await web3.eth.getBalance(claiment));

    expect(claimentLMNBalance).equals(2 * 10 ** 8); // should match FAUCET_LMR_PAYOUT in ./node-local-deploy.sh
    expect(claimentETHBalance).equals(0.01 * 10 ** 18); // should match FAUCET_ETH_PAYOUT in ./node-local-deploy.sh
  });

  it("should disallow for the same eth address within 24 hours", async function () {
    try {
      await faucetInstance.methods.supervisedClaim(claiment, "192.144.1.1").send({ from: owner });
      expect.fail("transaction should fail");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("you need to wait before claiming");
    }
  });

  it("should disallow for the same ip address within 24 hours", async function () {
    try {
      await faucetInstance.methods
        .supervisedClaim(RandomEthAddress(), ipAddress)
        .send({ from: owner });
      expect.fail("transaction should fail");
    } catch (err) {
      expectIsError(err);
      expect(err.message).includes("you need to wait before claiming");
    }
  });

  it("should allow for the new wallet and ip address", async function () {
    await faucetInstance.methods
      .supervisedClaim(RandomEthAddress(), RandomIPAddress())
      .send({ from: owner });
  });

  it("should allow when 24 hours elapse", async function () {
    await AdvanceBlockTime(web3, 32 * 3600);

    await faucetInstance.methods.supervisedClaim(claiment, ipAddress).send({ from: owner });
  });

  it("canClaimTokens should disallow after recent claim", async function () {
    const res = await faucetInstance.methods
      .canClaimTokens(claiment, ipAddress)
      .call({ from: owner });
    expect(res).to.be.false;
  });

  it("canClaimTokens should disallow if claiment the same but address different", async function () {
    const res = await faucetInstance.methods
      .canClaimTokens(claiment, RandomIPAddress())
      .call({ from: owner });
    expect(res).to.be.false;
  });

  it("canClaimTokens should disallow if address the same but claiment different", async function () {
    const res = await faucetInstance.methods
      .canClaimTokens(RandomEthAddress(), ipAddress)
      .call({ from: owner });
    expect(res).to.be.false;
  });

  it("canClaimTokens should allow for different claiment and address", async function () {
    const res = await faucetInstance.methods
      .canClaimTokens(RandomEthAddress(), RandomIPAddress())
      .call({ from: owner });
    expect(res).to.be.true;
  });
});
