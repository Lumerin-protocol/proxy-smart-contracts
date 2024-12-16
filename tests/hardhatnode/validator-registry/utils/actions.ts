import { expect } from "chai";
import type { ContractTypesMap } from "hardhat/types";

type Validator = {
  addr: `0x${string}`;
};

export async function complain(
  registry: ContractTypesMap["ValidatorRegistry"],
  validator: Validator,
  complainers: Validator[],
  punishThreshold: number
) {
  for (let i = 0; i < punishThreshold; i++) {
    const complainer = complainers[i % complainers.length];
    await registry.write.validatorComplain([validator.addr], {
      account: complainer.addr,
    });

    // check the complain event
    const complainEvents = await registry.getEvents.ValidatorComplain({
      validator: validator.addr,
      complainer: complainer.addr,
    });
    expect(complainEvents.length).to.equal(1);
  }
}
