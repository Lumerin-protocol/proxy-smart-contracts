import { expect } from "chai";
import { viem } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "../hardhatnode/fixtures-2";
import { parseEventLogs } from "viem";
import { getPublicKey } from "../../lib/pubkey";
import { encrypt } from "ecies-geth";
import { remove0xPrefix } from "../../lib/utils";

describe("Set Destination", function () {
  // Reusable URL constants
  const initialValidatorURL = "stratum+tcp://validator.initial.io:3333";
  const initialDestURL = "stratum+tcp://initial.pool.io:3333";
  const testValidatorURL = "stratum+tcp://test.validator.io:4444";
  const testDestURL = "stratum+tcp://test.pool.io:4444";
  const emptyValidatorURL = "";
  const emptyDestURL = "";

  async function setupDestinationTestFixture() {
    const { config, accounts, contracts } = await loadFixture(deployLocalFixture);
    const { seller, buyer, validator, owner } = accounts;
    const { cloneFactory, usdcMock, lumerinToken } = contracts;
    const pc = await viem.getPublicClient();

    // Contract parameters
    const contractSpeed = 1_000_000n; // 1 TH/s in H/s
    const contractLength = 3600n; // 1 hour in seconds
    const contractProfitTarget = 0;

    // Create a contract for testing
    const hash = await cloneFactory.write.setCreateNewRentalContractV2(
      [
        0n, // baseReward
        0n, // index
        contractSpeed,
        contractLength,
        contractProfitTarget,
        seller.account.address,
        await getPublicKey(seller),
      ],
      { account: seller.account }
    );

    const receipt = await pc.waitForTransactionReceipt({ hash });
    const [event] = parseEventLogs({
      logs: receipt.logs,
      abi: cloneFactory.abi,
      eventName: "contractCreated",
    });
    const contractAddr = event.args._address;

    // Get contract instance for reuse across tests
    const impl = await viem.getContractAt("Implementation", contractAddr);

    // Get public keys for encryption
    const sellerPubKey = remove0xPrefix(await getPublicKey(seller));
    const validatorPubKey = remove0xPrefix(await getPublicKey(validator));

    // Encrypt initial URLs
    const encInitialValidatorURL = await encrypt(
      Buffer.from(sellerPubKey, "hex"),
      Buffer.from(initialValidatorURL)
    );
    const encInitialDestURL = await encrypt(
      Buffer.from(validatorPubKey, "hex"),
      Buffer.from(initialDestURL)
    );

    // Encrypt test URLs and convert to hex strings (reused across tests)
    const encTestValidatorURL = await encrypt(
      Buffer.from(sellerPubKey, "hex"),
      Buffer.from(testValidatorURL)
    );
    const encTestDestURL = await encrypt(
      Buffer.from(validatorPubKey, "hex"),
      Buffer.from(testDestURL)
    );

    // Convert to hex strings ready for use
    const encInitialValidatorURLHex = encInitialValidatorURL.toString("hex");
    const encInitialDestURLHex = encInitialDestURL.toString("hex");
    const encTestValidatorURLHex = encTestValidatorURL.toString("hex");
    const encTestDestURLHex = encTestDestURL.toString("hex");

    return {
      contractAddr,
      impl,
      seller,
      buyer,
      validator,
      owner,
      cloneFactory,
      usdcMock,
      lumerinToken,
      pc,
      contractSpeed,
      contractLength,
      contractProfitTarget,
      sellerPubKey,
      validatorPubKey,
      encInitialValidatorURLHex,
      encInitialDestURLHex,
      encTestValidatorURLHex,
      encTestDestURLHex,
    };
  }

  async function setupRunningContractFixture() {
    const fixtureData = await setupDestinationTestFixture();
    const {
      contractAddr,
      impl,
      buyer,
      cloneFactory,
      usdcMock,
      lumerinToken,
      encInitialValidatorURLHex,
      encInitialDestURLHex,
    } = fixtureData;

    // Purchase the contract to make it running
    const [, terms] = await impl.read.getPublicVariablesV2();

    await usdcMock.write.approve([cloneFactory.address, terms._price], {
      account: buyer.account,
    });
    await lumerinToken.write.approve([cloneFactory.address, terms._fee], {
      account: buyer.account,
    });

    await cloneFactory.write.setPurchaseRentalContractV2(
      [
        contractAddr,
        buyer.account.address,
        encInitialValidatorURLHex,
        encInitialDestURLHex,
        terms._version,
      ],
      { account: buyer.account }
    );

    return fixtureData;
  }

  it("should successfully update destination when called by buyer on running contract", async function () {
    const { impl, buyer, encTestValidatorURLHex, encTestDestURLHex, pc } = await loadFixture(
      setupRunningContractFixture
    );

    // Call setDestination
    const hash = await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
      account: buyer.account,
    });

    // Verify state was updated
    const updatedValidatorURL = await impl.read.encrValidatorURL();
    const updatedDestURL = await impl.read.encrDestURL();

    expect(updatedValidatorURL).equal(encTestValidatorURLHex);
    expect(updatedDestURL).equal(encTestDestURLHex);

    // Verify event was emitted
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: impl.abi,
      eventName: "destinationUpdated",
    });

    expect(events.length).equal(1);
    const destinationEvent = events[0];
    expect(destinationEvent.args.newValidatorURL).equal(encTestValidatorURLHex);
    expect(destinationEvent.args.newDestURL).equal(encTestDestURLHex);
  });

  it("should prohibit destination update when caller is not the buyer", async function () {
    const { impl, seller, validator, owner, encTestValidatorURLHex, encTestDestURLHex } =
      await loadFixture(setupRunningContractFixture);

    // Test seller cannot call
    try {
      await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
        account: seller.account,
      });
      expect.fail("should throw error for seller");
    } catch (err: any) {
      expect(err.message).to.include(
        "this account is not authorized to update the ciphertext information"
      );
    }

    // Test validator cannot call
    try {
      await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
        account: validator.account,
      });
      expect.fail("should throw error for validator");
    } catch (err: any) {
      expect(err.message).to.include(
        "this account is not authorized to update the ciphertext information"
      );
    }

    // Test owner cannot call
    try {
      await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
        account: owner.account,
      });
      expect.fail("should throw error for owner");
    } catch (err: any) {
      expect(err.message).to.include(
        "this account is not authorized to update the ciphertext information"
      );
    }
  });

  it("should prohibit destination update when contract is not running", async function () {
    const { impl, buyer, encTestValidatorURLHex, encTestDestURLHex } = await loadFixture(
      setupDestinationTestFixture
    );

    // Contract is Available (not purchased), should fail
    try {
      await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
        account: buyer.account,
      });
      expect.fail("should throw error when contract is not running");
    } catch (err: any) {
      expect(err.message).to.include("the contract is not in the running state");
    }
  });

  it("should prohibit destination update after contract expires", async function () {
    const { impl, buyer, encTestValidatorURLHex, encTestDestURLHex, contractLength } =
      await loadFixture(setupRunningContractFixture);

    // Advance time past contract expiration
    await time.increase(Number(contractLength) + 1);

    // Contract is now expired (Available state), should fail
    try {
      await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
        account: buyer.account,
      });
      expect.fail("should throw error when contract is expired");
    } catch (err: any) {
      expect(err.message).to.include("the contract is not in the running state");
    }
  });

  it("should allow multiple destination updates during contract execution", async function () {
    const { impl, buyer, encTestValidatorURLHex, encTestDestURLHex, pc } = await loadFixture(
      setupRunningContractFixture
    );

    // First update
    await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
      account: buyer.account,
    });

    // Verify first update
    let currentValidatorURL = await impl.read.encrValidatorURL();
    let currentDestURL = await impl.read.encrDestURL();
    expect(currentValidatorURL).equal(encTestValidatorURLHex);
    expect(currentDestURL).equal(encTestDestURLHex);

    // Second update (reusing same URLs to test multiple updates)
    const hash = await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
      account: buyer.account,
    });

    // Verify second update
    currentValidatorURL = await impl.read.encrValidatorURL();
    currentDestURL = await impl.read.encrDestURL();
    expect(currentValidatorURL).equal(encTestValidatorURLHex);
    expect(currentDestURL).equal(encTestDestURLHex);

    // Verify event for second update
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: impl.abi,
      eventName: "destinationUpdated",
    });

    expect(events.length).equal(1);
    expect(events[0].args.newValidatorURL).equal(encTestValidatorURLHex);
    expect(events[0].args.newDestURL).equal(encTestDestURLHex);
  });

  it("should handle empty URL strings", async function () {
    const { impl, buyer, pc } = await loadFixture(setupRunningContractFixture);

    // Set empty URLs
    const hash = await impl.write.setDestination([emptyValidatorURL, emptyDestURL], {
      account: buyer.account,
    });

    // Verify empty URLs were set
    const currentValidatorURL = await impl.read.encrValidatorURL();
    const currentDestURL = await impl.read.encrDestURL();
    expect(currentValidatorURL).equal(emptyValidatorURL);
    expect(currentDestURL).equal(emptyDestURL);

    // Verify event emission with empty URLs
    const receipt = await pc.waitForTransactionReceipt({ hash });
    const events = parseEventLogs({
      logs: receipt.logs,
      abi: impl.abi,
      eventName: "destinationUpdated",
    });

    expect(events.length).equal(1);
    expect(events[0].args.newValidatorURL).equal(emptyValidatorURL);
    expect(events[0].args.newDestURL).equal(emptyDestURL);
  });

  it("should preserve other contract state when updating destination", async function () {
    const { impl, buyer, encTestValidatorURLHex, encTestDestURLHex } = await loadFixture(
      setupRunningContractFixture
    );

    // Get state before update
    const [stateBefore, termsBefore, startTimeBefore, buyerBefore, sellerBefore] =
      await impl.read.getPublicVariablesV2();

    // Update destination
    await impl.write.setDestination([encTestValidatorURLHex, encTestDestURLHex], {
      account: buyer.account,
    });

    // Get state after update
    const [stateAfter, termsAfter, startTimeAfter, buyerAfter, sellerAfter] =
      await impl.read.getPublicVariablesV2();

    // Verify other state is preserved
    expect(stateAfter).equal(stateBefore); // Contract state should remain Running
    expect(termsAfter._speed).equal(termsBefore._speed);
    expect(termsAfter._length).equal(termsBefore._length);
    expect(termsAfter._profitTarget).equal(termsBefore._profitTarget);
    expect(termsAfter._version).equal(termsBefore._version);
    expect(termsAfter._price).equal(termsBefore._price);
    expect(termsAfter._fee).equal(termsBefore._fee);
    expect(startTimeAfter).equal(startTimeBefore);
    expect(buyerAfter).equal(buyerBefore);
    expect(sellerAfter).equal(sellerBefore);

    // Verify only destination URLs changed
    const updatedValidatorURL = await impl.read.encrValidatorURL();
    const updatedDestURL = await impl.read.encrDestURL();
    expect(updatedValidatorURL).equal(encTestValidatorURLHex);
    expect(updatedDestURL).equal(encTestDestURLHex);
  });
});
