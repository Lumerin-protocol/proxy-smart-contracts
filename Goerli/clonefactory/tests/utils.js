//@ts-check
const ChildProcess = require("child_process")

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

/**
 * Executes shell command and returns stdout
 * @param {string} command 
 * @param  {...string} args 
 * @returns {string}
 */
function shell(command, ...args) {
  console.log("Running", command, ...args)

  const res = ChildProcess.spawnSync("sh", ["-c", [command, ...args].join(" ")])
  if (res.error) {
    throw res.error
  }
  console.log(res.stdout.toString())
  return res.stdout.toString().trim()
}

/**
 * Executes shell command and logs output
 * @param {string[]} cmd 
 * @param {(s: string)=>void} [logger]
 * @returns {Promise<void>}
 */
function shellLog(cmd, logger = () => { }) {
  return new Promise((resolve, reject) => {
    logger("Running: " + cmd.join(" "))
    const d = ChildProcess.spawn("sh", ["-c", cmd.join(" ")])
    d.stdout.on("data", (data) => {
      logger(data.toString())
    })
    d.stderr.on("data", (data) => {
      logger(data.toString())
    })
    d.on("error", (err) => {
      logger(err.toString())
    })
    d.on("close", (code) => {
      logger(`Process exited with code ${code}`)
      resolve()
    })
  })
}

/**
 * @typedef {Object} ShellBackground
 * @property {() => void} stop // Stops process
 * @property {Promise<{stdout: string, stderr: string}>} donePromise // Promise that resolves when process exits
 */

/**
 * Executes shell command in background and returns promise that resolves when process exits
 * @param {string[]} command 
 * @param {(s: string)=>void} [logger]
 * @returns {ShellBackground} 
 */
function shellBackground(command, logger = () => { }) {
  const d = ChildProcess.spawn("sh", ["-c", command.join(" ")])

  const donePromise = new Promise((resolve, reject) => {
    d.stdout.on("data", (data) => {
      logger(data.toString())
    })
    d.stderr.on("data", (data) => {
      logger(data.toString())
    })
    d.on("error", (err) => {
      logger(err.toString())
    })
    d.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: d.stdout.toString(), stderr: d.stderr.toString() })
      } else {
        logger(`Process exited with code ${code}`)
        reject(new Error(`Process exited with code ${code}`))
      }
    })
    d.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout: d.stdout.toString(), stderr: d.stderr.toString() })
      } else {
        logger(`Process exited with code ${code}`)
        reject(new Error(`Process exited with code ${code}`))
      }
    })
  })

  const stop = () => {
    const result = d.kill('SIGKILL')
    logger(`Send sigkill signal to process. Result: ${result}`)
  }

  return { stop, donePromise }
}

// The addresses for deployed contracts in local testnet (hardhat node, anvil)
const LocalTestnetAddresses = {
  lumerinAddress: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  cloneFactoryAddress: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
  faucetAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  owner: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  seller: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  buyer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  validatorAddr: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
  deployerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  ownerPrivateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  sellerPrivateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  buyerPrivateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  validatorPrivateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"

module.exports = {
  ToString,
  RandomEthAddress,
  RandomIPAddress,
  AdvanceBlockTime,
  LocalTestnetAddresses,
  ZERO_ADDRESS,
  shell,
  shellLog,
  shellBackground,
}