import { expect } from "chai";
import { zeroAddress } from "viem";
import { add3ValidatorsFixture, deployFixture } from "./utils/fixtures";
import { catchError } from "../../lib";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { complain } from "./utils/actions";

describe("ValidatorRegistry - getters", () => {
  it("should get validator by address", async () => {
    const {
      validators: { alice },
      registry,
    } = await loadFixture(add3ValidatorsFixture);
    const v = await registry.read.getValidator([alice.addr]);

    expect(v.addr).to.equal(alice.addr);
    expect(v.host).to.equal(alice.host);
    expect(v.stake).to.equal(alice.stake);
    expect(v.lastComplainer).to.equal(zeroAddress);
    expect(v.complains).to.equal(0);
  });

  it("should error when validator not found", async () => {
    const { registry, accounts } = await loadFixture(deployFixture);

    await catchError(registry.abi, "ValidatorNotFound", () =>
      registry.read.getValidator([accounts.alice.account.address])
    );
  });

  it("should get validators length", async () => {
    const { registry } = await loadFixture(add3ValidatorsFixture);
    const l = await registry.read.validatorsLength();
    expect(l).to.equal(3n);
  });

  it("should get active validators length", async () => {
    const { registry } = await loadFixture(add3ValidatorsFixture);
    const l = await registry.read.activeValidatorsLength();
    expect(l).to.equal(3n);
  });

  it("should get length correctly when 1 validator being inactive", async () => {
    const {
      validators: { alice, bob, carol },
      config,
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    await complain(registry, alice, [bob, carol], config.punishThreshold * 3);

    const activeLength = await registry.read.activeValidatorsLength();
    expect(activeLength).to.equal(2n);

    const allLength = await registry.read.validatorsLength();
    expect(allLength).to.equal(3n);
  });

  it("should query validators correctly when 1 validator being inactive", async () => {
    const {
      validators: { alice, bob, carol },
      config,
      registry,
    } = await loadFixture(add3ValidatorsFixture);

    await complain(registry, alice, [bob, carol], config.punishThreshold * 3);

    const active = await registry.read.getActiveValidators([0n, 10]);
    expect(active).to.have.length(2);
    expect(active).to.include.members([bob.addr, carol.addr]);

    const all = await registry.read.getValidators([0n, 10]);
    expect(all).to.have.length(3);
    expect(all).to.include.members([alice.addr, bob.addr, carol.addr]);
  });
});
