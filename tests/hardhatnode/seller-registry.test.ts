import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { deployLocalFixture } from "./fixtures-2";
import { viem } from "hardhat";
import { getPublicKey } from "../../lib/pubkey";
import { expectIsError } from "../utils";

describe("CloneFactory Seller Registry", function () {
  describe("Seller Registration", function () {
    it("should allow seller registration with sufficient stake", async function () {
      const { contracts, config } = await loadFixture(deployLocalFixture);
      const [, , newSeller] = await viem.getWalletClients();

      const stakeAmount = config.cloneFactory.minSellerStake;

      // Transfer tokens to new seller
      await contracts.lumerinToken.write.transfer([newSeller.account.address, stakeAmount]);

      // Approve tokens for CloneFactory
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, stakeAmount], {
        account: newSeller.account,
      });

      // Register seller
      await contracts.cloneFactory.write.sellerRegister([stakeAmount], {
        account: newSeller.account,
      });

      // Verify seller can create contracts (indirect verification of registration)
      const speed = 1000000000000000000000n; // 1 ZH/s
      const length = 3600n; // 1 hour
      const profitTarget = 10;
      const pubKey = await getPublicKey(newSeller);

      await contracts.cloneFactory.write.setCreateNewRentalContractV2(
        [0n, 0n, speed, length, profitTarget, newSeller.account.address, pubKey],
        { account: newSeller.account }
      );
    });

    it("should fail registration with insufficient stake", async function () {
      const { contracts, config } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      const insufficientStake = config.cloneFactory.minSellerStake - 1n;

      // Transfer insufficient tokens to new seller
      await contracts.lumerinToken.write.transfer([newSeller.account.address, insufficientStake]);

      // Approve tokens for CloneFactory
      await contracts.lumerinToken.write.approve(
        [contracts.cloneFactory.address, insufficientStake],
        {
          account: newSeller.account,
        }
      );

      // Attempt to register seller with insufficient stake
      try {
        await contracts.cloneFactory.write.sellerRegister([insufficientStake], {
          account: newSeller.account,
        });
        expect.fail("Should have failed with insufficient stake");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("stake is less than required minimum");
      }
    });

    it("should allow multiple registrations by same seller to increase stake", async function () {
      const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      const firstStake = config.cloneFactory.minSellerStake / 2n;
      const secondStake = config.cloneFactory.minSellerStake;

      // Transfer tokens to new seller
      await contracts.lumerinToken.write.transfer([newSeller.account.address, secondStake]);

      // First registration with partial stake (should fail)
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, firstStake], {
        account: newSeller.account,
      });

      try {
        await contracts.cloneFactory.write.sellerRegister([firstStake], {
          account: newSeller.account,
        });
        expect.fail("Should have failed with insufficient stake");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("stake is less than required minimum");
      }

      // Second registration to meet minimum (should succeed)
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, secondStake], {
        account: newSeller.account,
      });

      await contracts.cloneFactory.write.sellerRegister([secondStake], {
        account: newSeller.account,
      });

      // Verify seller can create contracts
      const speed = 1000000000000000000000n;
      const length = 3600n;
      const profitTarget = 10;
      const pubKey = await getPublicKey(newSeller);

      await contracts.cloneFactory.write.setCreateNewRentalContractV2(
        [0n, 0n, speed, length, profitTarget, newSeller.account.address, pubKey],
        { account: newSeller.account }
      );

      expect(true).to.be.true;
    });

    it("should transfer stake tokens to CloneFactory on registration", async function () {
      const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      const stakeAmount = config.cloneFactory.minSellerStake;

      // Transfer tokens to new seller
      await contracts.lumerinToken.write.transfer([newSeller.account.address, stakeAmount]);

      // Check initial balances
      const initialSellerBalance = await contracts.lumerinToken.read.balanceOf([
        newSeller.account.address,
      ]);
      const initialFactoryBalance = await contracts.lumerinToken.read.balanceOf([
        contracts.cloneFactory.address,
      ]);

      // Approve and register
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, stakeAmount], {
        account: newSeller.account,
      });

      await contracts.cloneFactory.write.sellerRegister([stakeAmount], {
        account: newSeller.account,
      });

      // Check final balances
      const finalSellerBalance = await contracts.lumerinToken.read.balanceOf([
        newSeller.account.address,
      ]);
      const finalFactoryBalance = await contracts.lumerinToken.read.balanceOf([
        contracts.cloneFactory.address,
      ]);

      expect(finalSellerBalance).to.equal(initialSellerBalance - stakeAmount);
      expect(finalFactoryBalance).to.equal(initialFactoryBalance + stakeAmount);
    });
  });

  describe("Seller Deregistration", function () {
    it("should allow deregistration when seller has no active contracts", async function () {
      const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      const stakeAmount = config.cloneFactory.minSellerStake;

      // Register seller first
      await contracts.lumerinToken.write.transfer([newSeller.account.address, stakeAmount]);
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, stakeAmount], {
        account: newSeller.account,
      });
      await contracts.cloneFactory.write.sellerRegister([stakeAmount], {
        account: newSeller.account,
      });

      // Check initial balance
      const initialBalance = await contracts.lumerinToken.read.balanceOf([
        newSeller.account.address,
      ]);

      // Deregister seller
      await contracts.cloneFactory.write.sellerDeregister({
        account: newSeller.account,
      });

      // Check final balance - should have stake returned
      const finalBalance = await contracts.lumerinToken.read.balanceOf([newSeller.account.address]);
      expect(finalBalance).to.equal(initialBalance + stakeAmount);

      // Verify seller can no longer create contracts
      const speed = 1000000000000000000000n;
      const length = 3600n;
      const profitTarget = 10;
      const pubKey = await getPublicKey(newSeller);

      try {
        await contracts.cloneFactory.write.setCreateNewRentalContractV2(
          [0n, 0n, speed, length, profitTarget, newSeller.account.address, pubKey],
          { account: newSeller.account }
        );
        expect.fail("Should not allow contract creation after deregistration");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller is not registered");
      }
    });

    it("should fail deregistration when seller has active contracts", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller } = accounts;

      // Try to deregister seller who has contracts
      try {
        await contracts.cloneFactory.write.sellerDeregister({
          account: seller.account,
        });
        expect.fail("Should not allow deregistration with active contracts");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller has contracts");
      }
    });

    it("should fail deregistration for unregistered seller", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const [, , , , , unregisteredSeller] = await viem.getWalletClients();

      try {
        await contracts.cloneFactory.write.sellerDeregister({
          account: unregisteredSeller.account,
        });
        expect.fail("Should not allow deregistration of unregistered seller");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller is not registered");
      }
    });
  });

  describe("Seller Access Control", function () {
    it("should prevent unregistered sellers from creating contracts", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const [, , , , , unregisteredSeller] = await viem.getWalletClients();

      const speed = 1000000000000000000000n;
      const length = 3600n;
      const profitTarget = 10;
      const pubKey = await getPublicKey(unregisteredSeller);

      try {
        await contracts.cloneFactory.write.setCreateNewRentalContractV2(
          [0n, 0n, speed, length, profitTarget, unregisteredSeller.account.address, pubKey],
          { account: unregisteredSeller.account }
        );
        expect.fail("Should not allow contract creation by unregistered seller");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller is not registered");
      }
    });

    it("should prevent sellers with insufficient stake from creating contracts", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, owner } = accounts;

      // Get the seller's current stake (they were registered in the fixture)
      const [sellerInfo, isActive, isRegistered] =
        await contracts.cloneFactory.read.sellerByAddress([seller.account.address]);
      expect(isRegistered).to.be.true;
      expect(isActive).to.be.true;

      // Increase minimum stake to be higher than the seller's current stake
      const newMinStake = sellerInfo.stake + 1000000000n; // Add 10 LMR (8 decimals)

      await contracts.cloneFactory.write.setMinSellerStake([newMinStake], {
        account: owner.account,
      });

      // Verify the seller is now inactive due to insufficient stake
      const [, isActiveAfterUpdate] = await contracts.cloneFactory.read.sellerByAddress([
        seller.account.address,
      ]);
      expect(isActiveAfterUpdate).to.be.false;

      // Try to create a contract - should fail
      const speed = 1000000000000000000000n; // 1 ZH/s
      const length = 3600n; // 1 hour
      const profitTarget = 10;
      const pubKey = await getPublicKey(seller);

      try {
        await contracts.cloneFactory.write.setCreateNewRentalContractV2(
          [0n, 0n, speed, length, profitTarget, seller.account.address, pubKey],
          { account: seller.account }
        );
        expect.fail("Should not allow contract creation by seller with insufficient stake");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller is not active");
      }
    });

    it("should prevent contract purchases from inactive sellers", async function () {
      const { accounts, contracts, config } = await loadFixture(deployLocalFixture);
      const { seller, owner, validator, buyer } = accounts;

      // Get the seller's current stake (they were registered in the fixture)
      const [sellerInfo, isActive, isRegistered] =
        await contracts.cloneFactory.read.sellerByAddress([seller.account.address]);
      expect(isRegistered).to.be.true;
      expect(isActive).to.be.true;

      // Increase minimum stake to be higher than the seller's current stake
      const newMinStake = sellerInfo.stake + 1000000000n; // Add 10 LMR (8 decimals)

      await contracts.cloneFactory.write.setMinSellerStake([newMinStake], {
        account: owner.account,
      });

      // Verify the seller is now inactive due to insufficient stake
      const [, isActiveAfterUpdate] = await contracts.cloneFactory.read.sellerByAddress([
        seller.account.address,
      ]);
      expect(isActiveAfterUpdate).to.be.false;

      try {
        await contracts.cloneFactory.write.setPurchaseRentalContractV2(
          [config.cloneFactory.contractAddresses[0], validator.account.address, "", "", 0],
          { account: buyer.account }
        );
        expect.fail("Should not allow contract purchase by seller with insufficient stake");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller is not active");
      }
    });
  });

  describe("Contract Deletion and Seller State", function () {
    it("should allow deregistration after all contracts are deleted", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller } = accounts;

      // Get list of seller's contracts
      const contractList = await contracts.cloneFactory.read.getContractList();

      // Delete all contracts
      await contracts.cloneFactory.write.setContractsDeleted([contractList, true], {
        account: seller.account,
      });

      // Now deregistration should succeed
      await contracts.cloneFactory.write.sellerDeregister({
        account: seller.account,
      });

      // Verify stake was returned
      const finalBalance = await contracts.lumerinToken.read.balanceOf([seller.account.address]);
      expect(finalBalance).to.not.equal(0n);
    });

    it("should restore seller contract tracking when contracts are restored", async function () {
      const { accounts, contracts } = await loadFixture(deployLocalFixture);
      const { seller, buyer } = accounts;

      // Get first contract
      const contractList = await contracts.cloneFactory.read.getContractList();
      const firstContract = [contractList[0]];

      // Delete contract
      await contracts.cloneFactory.write.setContractsDeleted([firstContract, true], {
        account: seller.account,
      });

      // Verify contract is deleted and cannot be purchased
      const impl = await viem.getContractAt("Implementation", contractList[0]);
      const isDeleted = await impl.read.isDeleted();
      expect(isDeleted).to.be.true;

      // Restore contract
      await contracts.cloneFactory.write.setContractsDeleted([firstContract, false], {
        account: seller.account,
      });

      // Verify contract is restored and can be purchased
      const isDeletedAfterRestore = await impl.read.isDeleted();
      expect(isDeletedAfterRestore).to.be.false;

      // Try to purchase the restored contract to verify it's functional
      const [price, fee] = await impl.read.priceAndFee();

      // Approve tokens for purchase
      await contracts.usdcMock.write.approve([contracts.cloneFactory.address, price], {
        account: buyer.account,
      });
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, fee], {
        account: buyer.account,
      });

      // Purchase should succeed for restored contract
      await contracts.cloneFactory.write.setPurchaseRentalContractV2(
        [contractList[0], accounts.validator.account.address, "validatorURL", "destURL", 0],
        { account: buyer.account }
      );

      // If we reach here, the purchase was successful, confirming the contract is properly restored
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero stake registration attempt", async function () {
      const { contracts } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      try {
        await contracts.cloneFactory.write.sellerRegister([0n], {
          account: newSeller.account,
        });
        expect.fail("Should not allow zero stake registration");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("stake is less than required minimum");
      }
    });

    it("should handle registration with exact minimum stake", async function () {
      const { contracts, config } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      const exactMinStake = config.cloneFactory.minSellerStake;

      await contracts.lumerinToken.write.transfer([newSeller.account.address, exactMinStake]);
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, exactMinStake], {
        account: newSeller.account,
      });

      await contracts.cloneFactory.write.sellerRegister([exactMinStake], {
        account: newSeller.account,
      });

      // Should be able to create contracts with exact minimum stake
      const speed = 1000000000000000000000n;
      const length = 3600n;
      const profitTarget = 10;
      const pubKey = await getPublicKey(newSeller);

      await contracts.cloneFactory.write.setCreateNewRentalContractV2(
        [0n, 0n, speed, length, profitTarget, newSeller.account.address, pubKey],
        { account: newSeller.account }
      );

      expect(true).to.be.true;
    });

    it("should handle multiple deregistration attempts", async function () {
      const { contracts, config } = await loadFixture(deployLocalFixture);
      const [, , , , , newSeller] = await viem.getWalletClients();

      // Register seller
      const stakeAmount = config.cloneFactory.minSellerStake;
      await contracts.lumerinToken.write.transfer([newSeller.account.address, stakeAmount]);
      await contracts.lumerinToken.write.approve([contracts.cloneFactory.address, stakeAmount], {
        account: newSeller.account,
      });
      await contracts.cloneFactory.write.sellerRegister([stakeAmount], {
        account: newSeller.account,
      });

      // First deregistration should succeed
      await contracts.cloneFactory.write.sellerDeregister({
        account: newSeller.account,
      });

      // Second deregistration should fail
      try {
        await contracts.cloneFactory.write.sellerDeregister({
          account: newSeller.account,
        });
        expect.fail("Should not allow double deregistration");
      } catch (err) {
        expectIsError(err);
        expect(err.message).to.include("seller is not registered");
      }
    });
  });
});
