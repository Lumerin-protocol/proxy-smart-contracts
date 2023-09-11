/**
 * Returns hex string without 0x prefix
 * @param {string} privateKey 
 * @returns 
 */
const remove0xPrefix = privateKey => privateKey.replace('0x', '');

/**
 * 
 * @param {string} publicKeyHex 
 * @returns string
 */
const trimRight64Bytes = publicKeyHex => {
  if (publicKeyHex.length === 130) {
    return publicKeyHex.slice(2);
  }
  return publicKeyHex;
}

/**
 * 
 * @param {string} key 
 * @returns string
 */
const add65BytesPrefix = key => {
  if (key.length === 128) {
    return `04${key}`;
  }
  return key;
}

module.exports = {
  remove0xPrefix,
  trimRight64Bytes,
  add65BytesPrefix,
}