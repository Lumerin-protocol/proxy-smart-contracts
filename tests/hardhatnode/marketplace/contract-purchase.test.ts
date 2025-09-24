import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { encrypt } from "ecies-geth";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "../fixtures-2";
import { remove0xPrefix } from "../../../lib/utils";
import { getPublicKey } from "../../../lib/pubkey";

describe("Contract purchase", function () {
  it("should purchase with cloud validator", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { seller, buyer, validator } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const [, , contractAddr] = config.cloneFactory.contractAddresses;

    const validatorURL = "stratum+tcp://validator.lumerin.io:3333";
    const destURL = "stratum+tcp://account.worker:pwd@brains.pool.io:3333";

    // Get public keys for encryption
    const sellerPubKey = remove0xPrefix(await getPublicKey(seller));
    const validatorPubKey = remove0xPrefix(await getPublicKey(validator));

    // Encrypt URLs
    const encValidatorURL = await encrypt(
      Buffer.from(sellerPubKey, "hex"),
      Buffer.from(validatorURL)
    );
    const encDestURL = await encrypt(Buffer.from(validatorPubKey, "hex"), Buffer.from(destURL));

    // Get contract instance
    const impl = await viem.getContractAt("Implementation", contractAddr);

    // Purchase the contract
    await cloneFactory.write.setPurchaseRentalContractV2(
      [
        contractAddr,
        validator.account.address,
        encValidatorURL.toString("hex"),
        encDestURL.toString("hex"),
        0,
        true,
        false,
        0n,
      ],
      { account: buyer.account }
    );

    // Verify the purchase
    const entry = await impl.read.getLatestResell();

    const actValidatorURL = entry._encrValidatorURL;
    const actDestURL = entry._encrDestURL;
    const actValidatorAddr = entry._validator;

    expect(actValidatorURL).equal(encValidatorURL.toString("hex"));
    expect(actDestURL).equal(encDestURL.toString("hex"));
    expect(actValidatorAddr.toLowerCase()).equal(validator.account.address.toLowerCase());

    // Close the contract
    await impl.write.closeEarly([0], { account: buyer.account });
  });

  it("should fail purchase if oracle data is stale", async function () {
    const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
    const { buyer, validator, owner } = accounts;
    const { cloneFactory, usdcMock, lumerinToken, hashrateOracle } = contracts;
    const [, , contractAddr] = config.cloneFactory.contractAddresses;

    // Set short TTL values to make oracle data stale quickly
    const shortTTL = 60n; // 60 seconds
    await hashrateOracle.write.setTTL([shortTTL, shortTTL], {
      account: owner.account,
    });

    // Advance time to make the oracle data stale
    await time.increase(Number(shortTTL) + 1);

    // Get contract instance and terms
    const impl = await viem.getContractAt("Implementation", contractAddr);

    // Try to purchase the contract - should fail due to stale oracle data
    try {
      await cloneFactory.write.setPurchaseRentalContractV2(
        [
          contractAddr,
          validator.account.address,
          "encryptedValidatorURL",
          "encryptedDestURL",
          0,
          true,
          false,
          0n,
        ],
        { account: buyer.account }
      );
      expect.fail("Purchase should have failed due to stale oracle data");
    } catch (err: any) {
      expect(err.message).to.include("StaleData");
    }
  });

  it("should reject purchase of non-existent contract", async function () {
    const { contracts, accounts } = await loadFixture(deployLocalFixture);
    const { cloneFactory } = contracts;
    const { buyer, validator } = accounts;

    const fakeAddress = "0x1234567890123456789012345678901234567890";

    await expect(
      cloneFactory.write.setPurchaseRentalContractV2(
        [fakeAddress, validator.account.address, "validator-url", "dest-url", 0],
        {
          account: buyer.account,
        }
      )
    ).to.be.rejectedWith("unknown contract address");
  });
});
