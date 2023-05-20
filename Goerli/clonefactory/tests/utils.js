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

module.exports = {
  ToString,
  RandomEthAddress,
  RandomIPAddress
}