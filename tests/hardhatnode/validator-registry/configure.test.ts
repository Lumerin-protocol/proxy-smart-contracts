import { expect } from "chai";
import { getAddress, parseUnits } from "viem";
import { add3ValidatorsFixture, addValidatorFixture, deployFixture } from "./utils/fixtures";
import { compressPublicKey } from "../../../lib/pubkey";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { complain } from "./utils/actions";
import { catchError } from "../../lib";

describe("Validator registry - configure", () => {
  it("should deploy the ValidatorRegistry contract", async () => {
    await deployFixture();
  });

  it("should error on second initialize attempt", async () => {
    const { registry, config } = await loadFixture(deployFixture);
    await catchError(registry.abi, "InvalidInitialization", () =>
      registry.simulate.initialize([
        config.token,
        config.stakeMinimum,
        config.stakeRegister,
        config.punishAmount,
        config.punishThreshold,
      ])
    );
  });

  it("should verify the configuration", async () => {
    const { registry, config, token } = await loadFixture(deployFixture);
    const { stakeMinimum, stakeRegister, punishAmount, punishThreshold } = config;

    expect(await registry.read.token()).to.equal(getAddress(token.address));
    expect(await registry.read.stakeMinimum()).to.equal(stakeMinimum);
    expect(await registry.read.stakeRegister()).to.equal(stakeRegister);
    expect(await registry.read.punishAmount()).to.equal(punishAmount);
    expect(await registry.read.punishThreshold()).to.equal(punishThreshold);
  });

  it("should verify the owner", async () => {
    const { registry, accounts } = await loadFixture(deployFixture);
    expect(await registry.read.owner()).to.equal(getAddress(accounts.owner.account.address));
  });

  it("should transfer ownership to alice", async () => {
    const {
      registry,
      accounts: { owner, alice },
      config,
    } = await loadFixture(deployFixture);
    await registry.write.transferOwnership([alice.account.address], {
      account: owner.account,
    });

    // verify state
    expect(await registry.read.owner()).to.equal(getAddress(alice.account.address));

    // check the event
    const events = await registry.getEvents.OwnershipTransferred({
      previousOwner: owner.account.address,
      newOwner: alice.account.address,
    });
    expect(events.length).to.equal(1);

    // verify it is effective
    // previous owner should not be able to call the contract anymore
    await catchError(registry.abi, "OwnableUnauthorizedAccount", () =>
      registry.write.setStakeMinimum([parseUnits("0.3", 8)], { account: owner.account })
    );

    // new owner should be able to call the contract
    await registry.write.setStakeMinimum([config.stakeMinimum + 1n], { account: alice.account });
  });

  it("should update min stake", async () => {
    const { config, registry } = await loadFixture(add3ValidatorsFixture);
    const newStakeMinimum = config.stakeMinimum + 1n;

    await registry.write.setStakeMinimum([newStakeMinimum]);
    expect(await registry.read.stakeMinimum()).to.equal(newStakeMinimum);
  });

  it("should update active state when minstake increased", async () => {
    const { registry, validators } = await loadFixture(add3ValidatorsFixture);
    const newStakeMinimum = validators.alice.stake + 1n;

    await registry.write.setStakeMinimum([newStakeMinimum]);
    expect(await registry.read.activeValidatorsLength()).to.equal(3n);

    await registry.write.forceUpdateActive([validators.alice.addr]);
    expect(await registry.read.activeValidatorsLength()).to.equal(2n);
  });

  it("should update active state when minstake decreased", async () => {
    const { registry, validators } = await loadFixture(add3ValidatorsFixture);
    const newStakeMinimum = validators.alice.stake + 1n;

    // first increase the min stake to exclude alice
    await registry.write.setStakeMinimum([newStakeMinimum]);
    expect(await registry.read.activeValidatorsLength()).to.equal(3n);

    await registry.write.forceUpdateActive([validators.alice.addr]);
    expect(await registry.read.activeValidatorsLength()).to.equal(2n);

    // then decrease the min stake to include alice
    await registry.write.setStakeMinimum([validators.alice.stake]);
    expect(await registry.read.activeValidatorsLength()).to.equal(2n);

    await registry.write.forceUpdateActive([validators.alice.addr]);
    expect(await registry.read.activeValidatorsLength()).to.equal(3n);
  });

  it("should update register stake", async () => {
    const { registry, config, accounts, token } = await loadFixture(addValidatorFixture);
    const newStakeRegister = config.stakeRegister + 1n;
    await registry.write.setStakeRegister([newStakeRegister]);

    // verify the new value
    expect(await registry.read.stakeRegister()).to.equal(newStakeRegister);
    const pubKey = compressPublicKey(accounts.bob.account.publicKey!);

    // verify it is effective
    await catchError(registry.abi, "InsufficientStake", () =>
      registry.write.validatorRegister(
        [config.stakeRegister, pubKey.yParity, pubKey.x, "localhost:3000"],
        { account: accounts.bob.account }
      )
    );
  });

  it("should update punish amount", async () => {
    const {
      registry,
      config,
      validators: { alice, bob, carol },
    } = await loadFixture(add3ValidatorsFixture);
    const newPunishAmount = config.punishAmount + 1n;
    await registry.write.setPunishAmount([newPunishAmount]);

    // verify the new value
    expect(await registry.read.punishAmount()).to.equal(newPunishAmount);

    // verify it is effective
    await complain(registry, alice, [bob, carol], config.punishThreshold);
    const valid = await registry.read.getValidator([alice.addr]);
    expect(valid.stake).to.equal(alice.stake - newPunishAmount);
  });

  it("should update punish threshold", async () => {
    const {
      registry,
      config,
      validators: { alice, bob, carol },
    } = await loadFixture(add3ValidatorsFixture);
    const newPunishThreshold = config.punishThreshold - 1;
    await registry.write.setPunishThreshold([newPunishThreshold]);

    // verify the new value
    expect(await registry.read.punishThreshold()).to.equal(newPunishThreshold);

    // verify it is effective
    await complain(registry, alice, [bob, carol], newPunishThreshold);
    const valid = await registry.read.getValidator([alice.addr]);
    expect(valid.stake).to.equal(alice.stake - config.punishAmount);
  });
});
