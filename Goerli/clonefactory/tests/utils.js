/**
 * Converts number to string with plain numbers (no exponent)
 * @param {number} number 
 * @returns {string} 
 */
function ToString(number) {
  return number.toLocaleString('fullwide', {useGrouping:false})
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
function RandomIPAddress(){
  const randomPart = () => Math.floor(Math.random()*256)
  return `${randomPart()}.${randomPart()}.${randomPart()}.${randomPart()}`
}

/**
 * @param {import("web3").default} web3
 * @param {number} seconds
 * @returns {Promise<void>}
 */
async function AdvanceBlockTime(web3, seconds){
  const { timestamp } = await web3.eth.getBlock(await web3.eth.getBlockNumber());
  await new Promise((resolve,reject)=>{
    web3.currentProvider.send({
      method: "evm_mine",
      params: [Number(timestamp) + seconds],
      jsonrpc: '2.0',
      id: new Date().getTime(),
    }, (err, data) => err ? reject(err) : resolve(data))
  })
}

const LMNDecimals = 10**8;
const ToLMNDecimals = (number) => number * LMNDecimals;

const ETHDecimals = 10**18;
const ToETHDecimals = (number) => number * ETHDecimals;

module.exports = {
  ToString,
  RandomEthAddress,
  RandomIPAddress,
  LMNDecimals,
  ToLMNDecimals,
  ETHDecimals,
  ToETHDecimals,
  AdvanceBlockTime,
}