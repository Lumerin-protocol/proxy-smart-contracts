/**
 * Returns hex string without 0x prefix
 * @param {string} privateKey 
 */
const remove0xPrefix = privateKey => privateKey.replace('0x', '');

/** @param {string} publicKeyHex */
const trimRight64Bytes = publicKeyHex => {
  if (publicKeyHex.length === 130) {
    return publicKeyHex.slice(2);
  }
  return publicKeyHex;
}

/** @param {string} key */
const add65BytesPrefix = key => {
  if (key.length === 128) {
    return `04${key}`;
  }
  return key;
}

/** @param {number} thps */
function THPStoHPS(thps) {
  return thps * Math.pow(10, 12);
}

/** @param {number} lmr */
function LMRToLMRWithDecimals(lmr) {
  return lmr * Math.pow(10, 8);
}

/** @param {number} hours */
function hoursToSeconds(hours) {
  return hours * 3600;
}

module.exports = {
  remove0xPrefix,
  trimRight64Bytes,
  add65BytesPrefix,
  THPStoHPS,
  LMRToLMRWithDecimals,
  hoursToSeconds
}