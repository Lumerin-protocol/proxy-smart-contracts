import { viem } from "hardhat";
import { expect } from "chai";
import { parseUnits } from "viem";
import { deployLocalFixture } from "../fixtures-2";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { catchError } from "../../lib";

describe("CloneFactory Management", function () {
  describe("Authorization and Ownership", function () {
    it("should revert when non-owner calls _onlyOwner modifier", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { seller } = accounts;

      // Test setValidatorFeeRate with non-owner (this uses _onlyOwner modifier)
      await expect(
        cloneFactory.write.setValidatorFeeRate([parseUnits("0.02", 18)], {
          account: seller.account,
        })
      ).to.be.rejectedWith("you are not authorized");
    });

    it("should allow owner to call functions with _onlyOwner modifier", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { owner } = accounts;

      const newFeeRate = parseUnits("0.02", 18);

      // Should succeed with owner
      await cloneFactory.write.setValidatorFeeRate([newFeeRate], {
        account: owner.account,
      });

      const updatedFeeRate = await cloneFactory.read.validatorFeeRateScaled();
      expect(updatedFeeRate).to.equal(newFeeRate);
    });

    it("should test _authorizeUpgrade function", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { owner, seller } = accounts;

      // Deploy a new implementation
      const newImplementation = await viem.deployContract(
        "contracts/marketplace/CloneFactory.sol:CloneFactory",
        []
      );

      // Non-owner should not be able to upgrade
      await catchError(newImplementation.abi, "OwnableUnauthorizedAccount", async () => {
        await cloneFactory.write.upgradeToAndCall([cloneFactory.address, "0x"], {
          account: seller.account,
        });
      });
    });
  });

  describe("Contract Management", function () {
    it("should get contract list", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;

      const contractList = await cloneFactory.read.getContractList();

      expect(contractList).to.be.an("array");
      expect(contractList.length).to.be.greaterThan(0);
    });
  });
});
