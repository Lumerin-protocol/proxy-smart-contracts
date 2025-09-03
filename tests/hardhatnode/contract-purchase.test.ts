import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { encrypt } from "ecies-geth";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { remove0xPrefix } from "../../lib/utils";
import { getPublicKey } from "../../lib/pubkey";

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

    // Get contract terms
    const [, terms] = await impl.read.getPublicVariablesV2();

    // Check history before purchase
    const history_before = await impl.read.getHistory([0n, 100]);
    expect(history_before.length).equal(0);

    // Approve tokens for purchase
    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    // Purchase the contract
    await cloneFactory.write.setPurchaseRentalContractV2(
      [
        contractAddr,
        validator.account.address,
        encValidatorURL.toString("hex"),
        encDestURL.toString("hex"),
        terms._version,
      ],
      { account: buyer.account }
    );

    // Verify the purchase
    const actValidatorURL = await impl.read.encrValidatorURL();
    const actDestURL = await impl.read.encrDestURL();
    const actValidatorAddr = await impl.read.validator();
    const history_after = await impl.read.getHistory([0n, 100]);

    expect(actValidatorURL).equal(encValidatorURL.toString("hex"));
    expect(actDestURL).equal(encDestURL.toString("hex"));
    expect(actValidatorAddr.toLowerCase()).equal(validator.account.address.toLowerCase());
    expect(history_after.length).equal(1);
    expect(history_after[0]._buyer.toLowerCase()).equal(buyer.account.address.toLowerCase());

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
    const [, terms] = await impl.read.getPublicVariablesV2();

    // Approve tokens for purchase
    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    // Try to purchase the contract - should fail due to stale oracle data
    try {
      await cloneFactory.write.setPurchaseRentalContractV2(
        [
          contractAddr,
          validator.account.address,
          "encryptedValidatorURL",
          "encryptedDestURL",
          terms._version,
        ],
        { account: buyer.account }
      );
      expect.fail("Purchase should have failed due to stale oracle data");
    } catch (err: any) {
      expect(err.message).to.include("StaleData");
    }
  });
});
