/**
 * Returns hex string without 0x prefix
 * @param {string} privateKey 
 * @returns 
 */
const remove0xPrefix = privateKey => privateKey.replace('0x', '');

module.exports = {
  remove0xPrefix,
}