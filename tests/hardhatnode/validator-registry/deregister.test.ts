import { expect } from "chai";
import { addValidatorFixture, deployFixture } from "./utils/fixtures";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { catchError, getTxDeltaBalance } from "../../lib";

describe("Validator registry - deregister", () => {
  it("should deregister a validator", async () => {
    const { registry, accounts, pc, token, validators } = await loadFixture(addValidatorFixture);
    const { alice } = accounts;
    const exp = validators.alice;

    const hash = await registry.write.validatorDeregister({
      account: alice.account,
    });

    // check the event
    const events = await registry.getEvents.ValidatorDeregistered({
      validator: alice.account.address,
    });
    expect(events.length).to.equal(1);

    // check validator record to be empty
    await catchError(registry.abi, "ValidatorNotFound", () =>
      registry.read.getValidator([exp.addr])
    );

    // check the stake refund
    const deltaAlice = await getTxDeltaBalance(pc, hash, alice.account.address, token);
    const deltaContract = await getTxDeltaBalance(pc, hash, registry.address, token);
    expect(deltaAlice).to.equal(exp.stake);
    expect(deltaContract).to.equal(-exp.stake);
    expect(await registry.read.totalStake()).to.equal(0n);

    // check validator count
    expect(await registry.read.validatorsLength()).to.equal(0n);
    expect(await registry.read.activeValidatorsLength()).to.equal(0n);
  });

  it("should deregister error if validator not found", async () => {
    const { registry, accounts } = await loadFixture(deployFixture);
    const { alice } = accounts;

    await catchError(registry.abi, "ValidatorNotFound", () =>
      registry.write.validatorDeregister({
        account: alice.account,
      })
    );
  });
});
