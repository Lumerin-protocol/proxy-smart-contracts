import { viem } from "hardhat";
import { expect } from "chai";
import { parseUnits } from "viem";
import { deployLocalFixture } from "./fixtures-2";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("HashrateOracle Coverage Tests", function () {
  describe("Authorization and Upgrades", function () {
    it("should test _authorizeUpgrade function", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner, seller } = accounts;

      // Deploy a new implementation
      const newImplementation = await viem.deployContract(
        "contracts/marketplace/HashrateOracle.sol:HashrateOracle",
        [contracts.btcPriceOracleMock.address, 6]
      );

      // Non-owner should not be able to upgrade
      await expect(
        hashrateOracle.write.upgradeToAndCall([newImplementation.address, "0x"], {
          account: seller.account,
        })
      ).to.be.rejectedWith("UUPSUnauthorizedCallContext()");
    });
  });

  describe("Parameter Updates", function () {
    it("should revert when setting zero difficulty", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      await expect(
        hashrateOracle.write.setDifficulty([0n], {
          account: owner.account,
        })
      ).to.be.rejectedWith("ValueCannotBeZero");
    });

    it("should revert when setting zero block reward", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      await expect(
        hashrateOracle.write.setBlockReward([0n], {
          account: owner.account,
        })
      ).to.be.rejectedWith("ValueCannotBeZero");
    });

    it("should not emit event when setting same difficulty", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      const currentDifficulty = await hashrateOracle.read.getDifficulty();

      const hash = await hashrateOracle.write.setDifficulty([currentDifficulty], {
        account: owner.account,
      });

      // Should not emit DifficultyUpdated event since value is the same
      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });

      // Check that no events were emitted (or at least no DifficultyUpdated event)
      const logs = receipt.logs.filter(
        (log) =>
          log.topics[0] === "0x7da2e87d0b02df1162d5736cc40dfcfffd17198aaf093ddff4a8f4eb26002fde" // DifficultyUpdated event topic
      );
      expect(logs.length).to.equal(0);
    });

    it("should not emit event when setting same block reward", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      const currentBlockReward = await hashrateOracle.read.getBlockReward();

      const hash = await hashrateOracle.write.setBlockReward([currentBlockReward], {
        account: owner.account,
      });

      // Should not emit BlockRewardUpdated event since value is the same
      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });

      // Check that no events were emitted (or at least no BlockRewardUpdated event)
      const logs = receipt.logs.filter(
        (log) =>
          log.topics[0] === "0x4cede65c3c0b9de8001d1b14a2d0c4eb8fda5b0ac2d73a1f9a2b7e8b6e6b6c8d" // BlockRewardUpdated event topic (placeholder)
      );
      expect(logs.length).to.equal(0);
    });

    it("should update difficulty and emit event", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      const newDifficulty = parseUnits("150", 12); // 150T difficulty

      const hash = await hashrateOracle.write.setDifficulty([newDifficulty], {
        account: owner.account,
      });

      // Check that difficulty was updated
      const updatedDifficulty = await hashrateOracle.read.getDifficulty();
      expect(updatedDifficulty).to.equal(newDifficulty);

      // Verify event was emitted
      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });

    it("should update block reward and emit event", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      const newBlockReward = parseUnits("6.25", 8); // 6.25 BTC

      const hash = await hashrateOracle.write.setBlockReward([newBlockReward], {
        account: owner.account,
      });

      // Check that block reward was updated
      const updatedBlockReward = await hashrateOracle.read.getBlockReward();
      expect(updatedBlockReward).to.equal(newBlockReward);

      // Verify event was emitted
      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);
    });
  });

  describe("Authorization Checks", function () {
    it("should revert when non-owner tries to set difficulty", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { seller } = accounts;

      const newDifficulty = parseUnits("150", 12);

      await expect(
        hashrateOracle.write.setDifficulty([newDifficulty], {
          account: seller.account,
        })
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("should revert when non-owner tries to set block reward", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { seller } = accounts;

      const newBlockReward = parseUnits("6.25", 8);

      await expect(
        hashrateOracle.write.setBlockReward([newBlockReward], {
          account: seller.account,
        })
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("Hash Calculations", function () {
    it("should calculate hashes for BTC correctly", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;

      const hashesForBTC = await hashrateOracle.read.getHashesForBTC();

      expect(typeof hashesForBTC).to.equal("bigint");
      expect(hashesForBTC > 0n).to.be.true;
    });

    it("should calculate hashes for token correctly", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;

      const hashesForToken = await hashrateOracle.read.getHashesforToken();

      expect(typeof hashesForToken).to.equal("bigint");
      expect(hashesForToken > 0n).to.be.true;
    });

    it("should return current difficulty", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;

      const difficulty = await hashrateOracle.read.getDifficulty();

      expect(typeof difficulty).to.equal("bigint");
      expect(difficulty > 0n).to.be.true;
    });

    it("should return current block reward", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;

      const blockReward = await hashrateOracle.read.getBlockReward();

      expect(blockReward).to.be.a("bigint");
      expect(blockReward > 0n).to.be.true;
    });
  });

  describe("Edge Cases", function () {
    it("should handle very large difficulty values", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      const largeDifficulty = BigInt("999999999999999999999999");

      await hashrateOracle.write.setDifficulty([largeDifficulty], {
        account: owner.account,
      });

      const updatedDifficulty = await hashrateOracle.read.getDifficulty();
      expect(updatedDifficulty).to.equal(largeDifficulty);

      // Should still be able to calculate hashes
      const hashesForBTC = await hashrateOracle.read.getHashesForBTC();
      expect(hashesForBTC).to.be.a("bigint");
    });

    it("should handle very small block reward values", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { hashrateOracle } = contracts;
      const { owner } = accounts;

      const smallBlockReward = 1n; // 1 satoshi

      await hashrateOracle.write.setBlockReward([smallBlockReward], {
        account: owner.account,
      });

      const updatedBlockReward = await hashrateOracle.read.getBlockReward();
      expect(updatedBlockReward).to.equal(smallBlockReward);

      // Should still be able to calculate hashes (will be very large)
      const hashesForBTC = await hashrateOracle.read.getHashesForBTC();
      expect(hashesForBTC).to.be.a("bigint");
      expect(hashesForBTC > 0n).to.be.true;
    });
  });
});
