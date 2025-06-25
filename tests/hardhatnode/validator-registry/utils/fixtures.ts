import { viem } from "hardhat";
import { encodeFunctionData, getAddress, parseUnits } from "viem";
import { compressPublicKey, getPublicKey } from "../../../../lib/pubkey";

export async function deployFixture() {
  const [owner, alice, bob, carol] = await viem.getWalletClients();

  owner.account.publicKey = await getPublicKey(owner);
  alice.account.publicKey = await getPublicKey(alice);
  bob.account.publicKey = await getPublicKey(bob);
  carol.account.publicKey = await getPublicKey(carol);

  const token = await viem.deployContract("contracts/mocks/LumerinTokenMock.sol:LumerinToken", []);

  const pc = await viem.getPublicClient();
  const config = {
    token: getAddress(token.address),
    stakeMinimum: parseUnits("0.2", 8),
    stakeRegister: parseUnits("1", 8),
    punishAmount: parseUnits("0.3", 8),
    punishThreshold: 3,
  };
  const registryImpl = await viem.deployContract(
    "contracts/validator-registry/ValidatorRegistry.sol:ValidatorRegistry",
    []
  );
  const registryProxy = await viem.deployContract("ERC1967Proxy", [
    registryImpl.address,
    encodeFunctionData({
      abi: registryImpl.abi,
      functionName: "initialize",
      args: [
        token.address,
        config.stakeMinimum,
        config.stakeRegister,
        config.punishAmount,
        config.punishThreshold,
      ],
    }),
  ]);

  const registry = await viem.getContractAt("ValidatorRegistry", registryProxy.address);

  // top up the accounts
  await token.write.transfer([alice.account.address, parseUnits("1000", 8)]);
  await token.write.transfer([bob.account.address, parseUnits("1000", 8)]);
  await token.write.transfer([carol.account.address, parseUnits("1000", 8)]);

  // approve balances (to speed up tests and avoid approve calls)
  await token.write.approve([registry.address, parseUnits("1000", 8)], { account: owner.account });
  await token.write.approve([registry.address, parseUnits("1000", 8)], { account: alice.account });
  await token.write.approve([registry.address, parseUnits("1000", 8)], { account: bob.account });
  await token.write.approve([registry.address, parseUnits("1000", 8)], { account: carol.account });

  return { accounts: { owner, alice, bob, carol }, registry, config, pc, token };
}

export async function addValidatorFixture() {
  const { registry, accounts, pc, token, config } = await deployFixture();
  const { alice } = accounts;
  const exp = {
    host: "localhost:3000",
    stake: parseUnits("1", 8),
    addr: getAddress(alice.account.address),
  };

  const pubKey = compressPublicKey(accounts.alice.account.publicKey!);

  const hash = await registry.write.validatorRegister(
    [exp.stake, pubKey.yParity, pubKey.x, exp.host],
    {
      account: alice.account,
    }
  );

  return { registry, accounts, pc, token, config, validators: { alice: { ...exp, hash } } };
}

export async function add3ValidatorsFixture() {
  const { registry, accounts, pc, token, config } = await deployFixture();
  const alice = {
    host: "localhost:3000",
    stake: parseUnits("1", 8),
    addr: getAddress(accounts.alice.account.address),
    hash: "0x0" as `0x${string}`,
    pubKey: compressPublicKey(accounts.alice.account.publicKey!),
  };
  const bob = {
    host: "localhost:3001",
    stake: parseUnits("2", 8),
    addr: getAddress(accounts.bob.account.address),
    hash: "0x0" as `0x${string}`,
    pubKey: compressPublicKey(accounts.bob.account.publicKey!),
  };
  const carol = {
    host: "localhost:3002",
    stake: parseUnits("3", 8),
    addr: getAddress(accounts.carol.account.address),
    hash: "0x0" as `0x${string}`,
    pubKey: compressPublicKey(accounts.carol.account.publicKey!),
  };

  alice.hash = await registry.write.validatorRegister(
    [alice.stake, alice.pubKey.yParity, alice.pubKey.x, alice.host],
    { account: alice.addr }
  );
  bob.hash = await registry.write.validatorRegister(
    [bob.stake, bob.pubKey.yParity, bob.pubKey.x, bob.host],
    { account: bob.addr }
  );
  carol.hash = await registry.write.validatorRegister(
    [carol.stake, carol.pubKey.yParity, carol.pubKey.x, carol.host],
    { account: carol.addr }
  );

  return { registry, accounts, pc, token, validators: { alice, bob, carol }, config };
}
