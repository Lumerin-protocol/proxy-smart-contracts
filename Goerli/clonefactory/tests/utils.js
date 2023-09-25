/**
 * Converts number to string with plain numbers (no exponent)
 * @param {number} number 
 * @returns {string} 
 */
function ToString(number) {
  return number.toLocaleString('fullwide', { useGrouping: false })
}

/**
 * @returns {string}
 */
function RandomEthAddress() {
  let address = "0x";
  const possibleChars = "0123456789abcdef";
  for (let i = 0; i < 40; i++) {
    address += possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
  }
  return address;
}

/**
 * @returns {string}
 */
function RandomIPAddress() {
  const randomPart = () => Math.floor(Math.random() * 256)
  return `${randomPart()}.${randomPart()}.${randomPart()}.${randomPart()}`
}

/**
 * @param {import("web3").default} web3
 * @param {number} seconds
 * @returns {Promise<void>}
 */
async function AdvanceBlockTime(web3, seconds) {
  await new Promise((resolve, reject) => {
    web3.currentProvider.send({
      method: "evm_increaseTime",
      params: [seconds],
      jsonrpc: '2.0',
      id: new Date().getTime(),
    }, (err, data) => err ? reject(err) : resolve(data))
  })
  await new Promise((resolve, reject) => {
    web3.currentProvider.send({
      method: "evm_mine",
      jsonrpc: '2.0',
      id: new Date().getTime(),
    }, (err, data) => err ? reject(err) : resolve(data))
  })
}

// The addresses for deployed contracts in local testnet (hardhat node, anvil)
const LocalTestnetAddresses = {
  lumerinAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  cloneFactoryAddress: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  faucetAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  owner: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  seller: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  buyer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  deployerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
}

module.exports = {
  ToString,
  RandomEthAddress,
  RandomIPAddress,
  AdvanceBlockTime,
  LocalTestnetAddresses,
}