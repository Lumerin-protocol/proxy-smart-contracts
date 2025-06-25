import { expect } from "chai";
import { getAddress } from "viem";
import { add3ValidatorsFixture } from "./utils/fixtures";
import { catchError } from "../../lib";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { complain } from "./utils/actions";
import { RandomEthAddress } from "../../utils";

describe("Validator registry - complain", () => {
  it("should complain about a validator", async () => {
    const {
      validators: { alice, bob },
      registry,
    } = await loadFixture(add3ValidatorsFixture);
    await registry.write.validatorComplain([alice.addr], { account: bob.addr });

    // check the event
    const events = await registry.getEvents.ValidatorComplain({
      validator: alice.addr,
      complainer: bob.addr,
    });
    expect(events.length).to.equal(1);

    // check validator record
    const valid = await registry.read.getValidator([alice.addr]);
    expect(valid.lastComplainer).to.equal(getAddress(bob.addr));
    expect(valid.complains).to.equal(1);
  });

  it("should error on consequent complaint from the same complainer about the same validator", async () => {
    const {
      validators: { alice, bob },
      registry,
    } = await loadFixture(add3ValidatorsFixture);
    await registry.write.validatorComplain([alice.addr], { account: bob.addr });

    await catchError(registry.abi, "AlreadyComplained", () =>
      registry.write.validatorComplain([alice.addr], { account: bob.addr })
    );
  });

  it("should error on complaint about oneself", async () => {
    const {
      validators: { alice },
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    await catchError(registry.abi, "Unauthorized", () =>
      registry.write.validatorComplain([alice.addr], { account: alice.addr })
    );
  });

  it("should error on complaint about unknown validator", async () => {
    const {
      validators: { alice },
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    await catchError(registry.abi, "ValidatorNotFound", () =>
      registry.write.validatorComplain([RandomEthAddress() as `0x${string}`], {
        account: alice.addr,
      })
    );
  });

  it("should punish a validator", async () => {
    const {
      validators: { alice, bob, carol },
      config,
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    await complain(registry, alice, [bob, carol], config.punishThreshold);

    // check the punish event
    const punishEvents = await registry.getEvents.ValidatorPunished({
      validator: alice.addr,
    });
    expect(punishEvents.length).to.equal(1);

    // check punish amount
    const valid = await registry.read.getValidator([alice.addr]);
    expect(valid.complains).to.equal(0);
    expect(valid.stake).to.equal(alice.stake - config.punishAmount);
  });

  it("should punish a validator making it inactive", async () => {
    const {
      validators: { alice, bob, carol },
      config,
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    const valid1 = await registry.read.getActiveValidators([0n, 3]);
    expect(valid1.length).to.equal(3);

    await complain(registry, alice, [bob, carol], config.punishThreshold * 3);

    const valid2 = await registry.read.getActiveValidators([0n, 3]);
    expect(valid2.length).to.equal(2);
  });

  it("should punish when balance is not sufficient without error", async () => {
    const {
      validators: { alice, bob, carol },
      config,
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    const valid1 = await registry.read.getActiveValidators([0n, 3]);
    expect(valid1.length).to.equal(3);

    await complain(registry, alice, [bob, carol], config.punishThreshold * 3);

    const valid = await registry.read.getValidator([alice.addr]);
    expect(valid.stake < config.punishAmount).to.be.true;

    await complain(registry, alice, [carol, bob], config.punishThreshold);

    const valid2 = await registry.read.getValidator([alice.addr]);
    expect(valid2.stake === 0n).to.be.true;
  });
});
