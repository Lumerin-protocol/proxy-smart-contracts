import { viem } from "hardhat";
import { expect } from "chai";
import { parseUnits } from "viem";
import { deployLocalFixture } from "./fixtures-2";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { catchError } from "../lib";

describe("CloneFactory Coverage Tests (Fixed)", function () {
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

  describe("Validator Fee Rate Management", function () {
    it("should update validator fee rate and emit event", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { owner } = accounts;

      const newFeeRate = parseUnits("0.015", 18);
      const oldFeeRate = await cloneFactory.read.validatorFeeRateScaled();

      const hash = await cloneFactory.write.setValidatorFeeRate([newFeeRate], {
        account: owner.account,
      });

      // Check that fee rate was updated
      const updatedFeeRate = await cloneFactory.read.validatorFeeRateScaled();
      expect(updatedFeeRate).to.equal(newFeeRate);

      // Verify event was emitted
      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });
      const logs = receipt.logs;
      expect(logs.length).to.be.greaterThan(0);
    });

    it("should not update fee rate if same value is set", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { owner } = accounts;

      const currentFeeRate = await cloneFactory.read.validatorFeeRateScaled();

      const hash = await cloneFactory.write.setValidatorFeeRate([currentFeeRate], {
        account: owner.account,
      });

      // Fee rate should remain the same
      const updatedFeeRate = await cloneFactory.read.validatorFeeRateScaled();
      expect(updatedFeeRate).to.equal(currentFeeRate);
    });
  });

  describe("Seller Stake Management", function () {
    it("should update minimum seller stake", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { owner } = accounts;

      const newMinStake = parseUnits("20000", 8);

      await cloneFactory.write.setMinSellerStake([newMinStake], {
        account: owner.account,
      });

      const updatedMinStake = await cloneFactory.read.minSellerStake();
      expect(updatedMinStake).to.equal(newMinStake);
    });

    it("should revert when non-owner tries to set minimum seller stake", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { seller } = accounts;

      const newMinStake = parseUnits("20000", 8);

      await expect(
        cloneFactory.write.setMinSellerStake([newMinStake], {
          account: seller.account,
        })
      ).to.be.rejectedWith("you are not authorized");
    });
  });

  describe("Seller Registry", function () {
    it("should return sellers list", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { seller } = accounts;

      // Get sellers with pagination - using correct types
      const sellers = await cloneFactory.read.getSellers([0n, 10]);

      expect(sellers).to.be.an("array");
      expect(sellers.length).to.be.greaterThan(0);
      expect(sellers[0].toLowerCase()).to.equal(seller.account.address.toLowerCase());
    });

    it("should handle pagination for getSellers", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;

      // Test pagination with offset - using correct types
      const sellersPage1 = await cloneFactory.read.getSellers([0n, 1]);
      const sellersPage2 = await cloneFactory.read.getSellers([1n, 1]);

      expect(sellersPage1).to.be.an("array");
      expect(sellersPage1.length).to.be.lessThanOrEqual(1);
    });

    it("should register additional seller", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory, lumerinToken } = contracts;
      const { buyer } = accounts;
      const minStake = await cloneFactory.read.minSellerStake();

      // Transfer tokens and register new seller
      await lumerinToken.write.transfer([buyer.account.address, minStake]);
      await lumerinToken.write.approve([cloneFactory.address, minStake], {
        account: buyer.account,
      });

      await cloneFactory.write.sellerRegister([minStake], {
        account: buyer.account,
      });

      // Check seller is registered
      const [sellerInfo, isActive, isRegistered] = await cloneFactory.read.sellerByAddress([
        buyer.account.address,
      ]);
      expect(isRegistered).to.be.true;
      expect(isActive).to.be.true;
      expect(sellerInfo.stake).to.equal(minStake);
    });
  });

  describe("Error Conditions", function () {
    it("should handle seller deregistration with contracts", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { seller } = accounts;

      // Seller should not be able to deregister if they have contracts
      await expect(
        cloneFactory.write.sellerDeregister({
          account: seller.account,
        })
      ).to.be.rejectedWith("seller has contracts");
    });

    it("should handle insufficient stake registration", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory, lumerinToken } = contracts;
      const { validator } = accounts;

      const minStake = await cloneFactory.read.minSellerStake();
      const insufficientStake = minStake / 2n;

      await lumerinToken.write.transfer([validator.account.address, insufficientStake]);
      await lumerinToken.write.approve([cloneFactory.address, insufficientStake], {
        account: validator.account,
      });

      await expect(
        cloneFactory.write.sellerRegister([insufficientStake], {
          account: validator.account,
        })
      ).to.be.rejectedWith("stake is less than required minimum");
    });

    it("should handle non-registered seller deregistration", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { validator } = accounts;

      await expect(
        cloneFactory.write.sellerDeregister({
          account: validator.account,
        })
      ).to.be.rejectedWith("seller is not registered");
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

    it("should handle contract creation", async function () {
      const { contracts, accounts } = await loadFixture(deployLocalFixture);
      const { cloneFactory } = contracts;
      const { seller } = accounts;

      const initialContractCount = (await cloneFactory.read.getContractList()).length;

      // Create a new contract
      const hash = await cloneFactory.write.setCreateNewRentalContractV2(
        [
          0n,
          0n,
          BigInt(1000000000000), // 1 TH/s
          BigInt(3600), // 1 hour
          10, // 10% profit
          seller.account.address,
          "test-pubkey-new",
        ],
        {
          account: seller.account,
        }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });
      expect(receipt.logs.length).to.be.greaterThan(0);

      const newContractCount = (await cloneFactory.read.getContractList()).length;
      expect(newContractCount).to.equal(initialContractCount + 1);
    });
  });

  describe("Purchase Flow", function () {
    it("should handle contract purchase validation", async function () {
      const { contracts, accounts, config } = await loadFixture(deployLocalFixture);
      const { cloneFactory, lumerinToken, usdcMock } = contracts;
      const { buyer, validator, seller } = accounts;

      // Create a new contract to purchase
      const hash = await cloneFactory.write.setCreateNewRentalContractV2(
        [
          0n,
          0n,
          BigInt(1000000000000), // 1 TH/s
          BigInt(3600), // 1 hour
          10, // 10% profit
          seller.account.address,
          "test-pubkey-purchase",
        ],
        {
          account: seller.account,
        }
      );

      const receipt = await accounts.pc.waitForTransactionReceipt({ hash });

      // Get the new contract address from contract list
      const contractList = await cloneFactory.read.getContractList();
      const newContractAddress = contractList[contractList.length - 1];

      const implementation = await viem.getContractAt(
        "contracts/marketplace/Implementation.sol:Implementation",
        newContractAddress
      );

      const [price, fee] = await implementation.read.priceAndFee();

      // Approve tokens for purchase
      await usdcMock.write.approve([cloneFactory.address, price], {
        account: buyer.account,
      });
      await lumerinToken.write.approve([cloneFactory.address, fee], {
        account: buyer.account,
      });

      // Purchase the contract
      await cloneFactory.write.setPurchaseRentalContractV2(
        [newContractAddress, validator.account.address, "validator-url", "dest-url", 0],
        {
          account: buyer.account,
        }
      );

      // Verify contract state changed to running
      const state = await implementation.read.contractState();
      expect(state).to.equal(1); // Running state
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
});
