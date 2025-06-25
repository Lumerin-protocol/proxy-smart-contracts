import { expect } from "chai";
import { getAddress, parseUnits, zeroAddress } from "viem";
import { addValidatorFixture, deployFixture } from "./utils/fixtures";
import { catchError, getTxDeltaBalance } from "../../lib";
import { compressPublicKey } from "../../../lib/pubkey";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("ValidatorRegistry - register", () => {
  it("should allow to register a validator", async () => {
    const { registry, accounts, pc, token, validators } = await loadFixture(addValidatorFixture);
    const { alice } = accounts;
    const exp = validators.alice;

    // check the event
    const events = await registry.getEvents.ValidatorRegisteredUpdated({
      validator: alice.account.address,
    });
    expect(events.length).to.equal(1);

    // check validator record
    const valid = await registry.read.getValidator([exp.addr]);
    expect(valid.host).to.equal(exp.host);
    expect(valid.addr).to.equal(exp.addr);
    expect(valid.stake).to.equal(exp.stake);
    expect(valid.lastComplainer).to.equal(zeroAddress);
    expect(valid.complains).to.equal(0);

    // check the balance change
    const deltaAlice = await getTxDeltaBalance(pc, exp.hash, alice.account.address, token);
    const deltaContract = await getTxDeltaBalance(pc, exp.hash, registry.address, token);
    expect(deltaAlice).to.equal(-exp.stake);
    expect(deltaContract).to.equal(exp.stake);
    expect(await registry.read.totalStake()).to.equal(exp.stake);

    // check validator count
    expect(await registry.read.validatorsLength()).to.equal(1n);
    expect(await registry.read.activeValidatorsLength()).to.equal(1n);
  });

  it("should fail to register a validator with insufficient stake", async () => {
    const { registry, accounts, config } = await loadFixture(deployFixture);
    const { alice } = accounts;
    const exp = {
      host: "localhost:3000",
      stake: config.stakeMinimum - 1n,
      addr: getAddress(alice.account.address),
    };

    const pubKey = compressPublicKey(accounts.bob.account.publicKey!);

    await catchError(registry.abi, "InsufficientStake", () =>
      registry.simulate.validatorRegister([exp.stake, pubKey.yParity, pubKey.x, exp.host], {
        account: alice.account.address,
      })
    );
  });

  it("should fail to register a validator with insufficient allowance", async () => {
    const { registry, accounts, config, token } = await loadFixture(deployFixture);
    const { alice } = accounts;
    const exp = {
      host: "localhost:3000",
      stake: config.stakeRegister,
      addr: getAddress(alice.account.address),
    };
    const pubKey = compressPublicKey(accounts.alice.account.publicKey!);

    await token.write.approve([registry.address, config.stakeRegister - 1n], {
      account: alice.account,
    });
    await catchError(token.abi, "ERC20InsufficientAllowance", () =>
      registry.simulate.validatorRegister([exp.stake, pubKey.yParity, pubKey.x, exp.host], {
        account: alice.account.address,
      })
    );
  });

  it("should fail to register a validator with host too long", async () => {
    const { registry, accounts, config } = await loadFixture(deployFixture);
    const { alice } = accounts;
    const exp = {
      host: "a".repeat(256),
      stake: config.stakeRegister,
      addr: getAddress(alice.account.address),
    };
    const pubKey = compressPublicKey(accounts.alice.account.publicKey!);

    await catchError(registry.abi, "HostTooLong", () =>
      registry.simulate.validatorRegister([exp.stake, pubKey.yParity, pubKey.x, exp.host], {
        account: alice.account.address,
      })
    );
  });

  it("should add to stake and update url on re-register", async () => {
    const { registry, accounts, pc, token, validators } = await loadFixture(addValidatorFixture);
    const { alice } = accounts;
    const exp = validators.alice;

    const newHost = "localhost:3001";
    const addStake = parseUnits("2", 8);
    const newStake = exp.stake + addStake;
    const pubKey = compressPublicKey(accounts.alice.account.publicKey!);

    const hash = await registry.write.validatorRegister(
      [addStake, pubKey.yParity, pubKey.x, newHost],
      {
        account: alice.account,
      }
    );

    // check the event
    const events2 = await registry.getEvents.ValidatorRegisteredUpdated({ validator: exp.addr });
    expect(events2.length).to.equal(1);

    // check validator record
    const valid = await registry.read.getValidator([exp.addr]);
    expect(valid.host).to.equal(newHost);
    expect(valid.addr).to.equal(exp.addr);
    expect(valid.stake).to.equal(newStake);
    expect(valid.lastComplainer).to.equal(zeroAddress);
    expect(valid.complains).to.equal(0);

    // check the balance change
    const deltaAlice = await getTxDeltaBalance(pc, hash, alice.account.address, token);
    const deltaContract = await getTxDeltaBalance(pc, hash, registry.address, token);
    expect(deltaAlice).to.equal(-addStake);
    expect(deltaContract).to.equal(addStake);
    expect(await registry.read.totalStake()).to.equal(newStake);
  });
});
