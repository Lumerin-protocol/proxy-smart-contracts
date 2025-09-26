import { viem } from "hardhat";
import { expect } from "chai";
import { parseEventLogs, zeroAddress } from "viem";
import { deployLocalFixture } from "../fixtures-2";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { catchError } from "../../lib";

// Constants to replace magic numbers
const CONTRACT_STATE = {
  AVAILABLE: 0,
  RUNNING: 1,
} as const;

const TIME_CONSTANTS = {
  ONE_HOUR_SECONDS: 3600,
  ONE_HOUR_PLUS_BUFFER_SECONDS: 3700,
  TWO_HOURS_SECONDS: 7200,
} as const;

const TEST_VALUES = {
  ONE_TERAHASH_PER_SECOND: BigInt(1000000000000),
  TWO_TERAHASH_PER_SECOND: BigInt(2000000000000),
  TEN_PERCENT_PROFIT: 10,
  FIFTEEN_PERCENT_PROFIT: 15,
  CLOSE_REASON_UNSPECIFIED: 0,
  FIRST_CONTRACT_INDEX: 0,
  THIRD_CONTRACT_INDEX: 2,
  HISTORY_OFFSET: 0n,
  HISTORY_LIMIT: 10,
  TERMS_VERSION_INITIAL: 0,
} as const;

describe("Implementation Coverage Tests (Fixed)", function () {
  describe("Authorization and Upgrades", function () {
    it("should test _authorizeUpgrade function", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { owner, seller } = accounts;

      const beaconAddr = await contracts.cloneFactory.read.baseImplementation();
      const beacon = await viem.getContractAt("UpgradeableBeacon", beaconAddr);

      // Deploy a new implementation
      const newImplementation = await viem.deployContract(
        "contracts/marketplace/Implementation.sol:Implementation",
        [zeroAddress, zeroAddress, zeroAddress, zeroAddress]
      );

      // Should revert with InvalidInitialization when calling on proxy implementation
      await catchError(newImplementation.abi, "InvalidInitialization", async () => {
        await newImplementation.write.initialize([zeroAddress, "0x", 1n, 1n, 0]);
      });

      // Non-owner should not be able to upgrade
      await catchError(beacon.abi, "OwnableUnauthorizedAccount", async () => {
        await beacon.write.upgradeTo([beaconAddr], {
          account: seller.account,
        });
      });
    });
  });

  describe("Destination Management", function () {
    it("should allow buyer to update destination during contract execution", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { cloneFactory, lumerinToken, usdcMock } = contracts;
      const { buyer, validator, seller } = accounts;

      // Use existing running contract from fixture
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      // Check if contract is running first
      const state = await implementation.read.contractState();
      if (state === CONTRACT_STATE.AVAILABLE) {
        // Contract is available, need to purchase it first
        const [price, fee] = await implementation.read.priceAndFee();

        await usdcMock.write.approve([cloneFactory.address, price], {
          account: buyer.account,
        });
        await lumerinToken.write.approve([cloneFactory.address, fee], {
          account: buyer.account,
        });

        await cloneFactory.write.setPurchaseRentalContractV2(
          [
            contractAddress,
            validator.account.address,
            "validator-url",
            "dest-url",
            TEST_VALUES.TERMS_VERSION_INITIAL,
          ],
          {
            account: buyer.account,
          }
        );
      }

      // Now update the destination
      const newValidatorURL = "new-validator-url";
      const newDestURL = "new-dest-url";

      const updateHash = await implementation.write.setDestination([newValidatorURL, newDestURL], {
        account: buyer.account,
      });

      // Verify event was emitted
      const updateReceipt = await accounts.pc.waitForTransactionReceipt({ hash: updateHash });
      expect(updateReceipt.logs.length).to.be.greaterThan(0);

      // Verify the URLs were updated
      const encrValidatorURL = await implementation.read.encrValidatorURL();
      const encrDestURL = await implementation.read.encrDestURL();
      expect(encrValidatorURL).to.equal(newValidatorURL);
      expect(encrDestURL).to.equal(newDestURL);
    });

    it("should revert when non-buyer tries to update destination", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { seller } = accounts;

      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      await expect(
        implementation.write.setDestination(["new-validator-url", "new-dest-url"], {
          account: seller.account,
        })
      ).to.be.rejectedWith("this account is not authorized to update the ciphertext information");
    });

    it("should revert when trying to update destination on non-running contract", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { buyer, seller } = accounts;

      // Create a new contract that hasn't been purchased
      const hash = await cloneFactory.write.setCreateNewRentalContractV2(
        [
          0n,
          0n,
          TEST_VALUES.ONE_TERAHASH_PER_SECOND,
          BigInt(TIME_CONSTANTS.ONE_HOUR_SECONDS),
          TEST_VALUES.TEN_PERCENT_PROFIT,
          seller.account.address,
          "test-pubkey-2",
        ],
        {
          account: seller.account,
        }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });

      // Parse the contract created event
      const events = parseEventLogs({
        logs: receipt.logs,
        abi: cloneFactory.abi,
        eventName: "contractCreated",
      });

      const newContractAddress = events[0].args._address;
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        newContractAddress
      );

      // Try to update destination on available (non-running) contract
      await expect(
        implementation.write.setDestination(["new-validator-url", "new-dest-url"], {
          account: buyer.account,
        })
      ).to.be.rejectedWith("this account is not authorized to update the ciphertext information");
    });
  });

  describe("Contract State Management", function () {
    it("should handle contract state transitions", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      // Get current state
      const state = await implementation.read.contractState();
      expect(state).to.be.oneOf([CONTRACT_STATE.AVAILABLE, CONTRACT_STATE.RUNNING]);

      // Fast forward time past contract length if running
      if (state === CONTRACT_STATE.RUNNING) {
        await time.increase(TIME_CONSTANTS.ONE_HOUR_PLUS_BUFFER_SECONDS);
        const newState = await implementation.read.contractState();
        expect(newState).to.equal(CONTRACT_STATE.AVAILABLE);
      }
    });
  });

  describe("Public Function Coverage", function () {
    it("should get public variables correctly", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      const publicVars = await implementation.read.getPublicVariablesV2();

      // Should return a tuple with contract information
      expect(publicVars).to.be.an("array");
      expect(publicVars.length).to.be.greaterThan(TEST_VALUES.FIRST_CONTRACT_INDEX);
    });

    it("should get contract history", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      const history = await implementation.read.getHistory([
        TEST_VALUES.HISTORY_OFFSET,
        TEST_VALUES.HISTORY_LIMIT,
      ]);

      expect(history).to.be.an("array");
      // History might be empty for new contracts
    });

    it("should get contract stats", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      const [successCount, failCount] = await implementation.read.getStats();

      expect(typeof successCount).to.equal("bigint");
      expect(typeof failCount).to.equal("bigint");
    });
  });

  describe("Error Conditions", function () {
    it("should handle closeEarly with unauthorized account", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { seller } = accounts;
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      await expect(
        implementation.write.closeEarly([TEST_VALUES.CLOSE_REASON_UNSPECIFIED], {
          account: seller.account,
        })
      ).to.be.rejectedWith("this account is not authorized to trigger an early closeout");
    });

    it("should handle contract deletion properly", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { seller } = accounts;

      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.THIRD_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      // Delete the contract
      await cloneFactory.write.setContractsDeleted([[contractAddress], true], {
        account: seller.account,
      });

      // Check deletion status
      const isDeleted = await implementation.read.isDeleted();
      expect(isDeleted).to.be.true;

      // Restore the contract
      await cloneFactory.write.setContractsDeleted([[contractAddress], false], {
        account: seller.account,
      });

      const isStillDeleted = await implementation.read.isDeleted();
      expect(isStillDeleted).to.be.false;
    });
  });

  describe("Price and Fee Calculations", function () {
    it("should calculate price and fee correctly", async function () {
      const { config } = await loadFixture(deployLocalFixture);
      const contractAddress =
        config.cloneFactory.contractAddresses[TEST_VALUES.FIRST_CONTRACT_INDEX];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      const [price, fee] = await implementation.read.priceAndFee();

      expect(typeof price).to.equal("bigint");
      expect(typeof fee).to.equal("bigint");
      expect(price > 0n).to.be.true;
    });

    it("should handle claim funds", async function () {
      const { config } = await loadFixture(deployLocalFixture);
      const contractAddress = config.cloneFactory.contractAddresses[0];
      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        contractAddress
      );

      try {
        await implementation.write.claimFunds();
        expect.fail("should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("no funds to withdraw");
      }
    });
  });
});
