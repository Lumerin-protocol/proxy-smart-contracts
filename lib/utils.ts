import {env} from 'process';

/** Returns hex string without 0x prefix */
export function remove0xPrefix(privateKey: string) {
  return privateKey.replace('0x', '');
}

export function trimRight64Bytes(publicKeyHex: string){
  if (publicKeyHex.length > 128) {
    return publicKeyHex.slice(-128);
  }
  return publicKeyHex;
}

/** Adds 04 prefix to the private key if required so its length will be 65 bytes */
export function add65BytesPrefix(key: string){
  if (key.length === 128) {
    return `04${key}`;
  }
  return key;
}

/** Converts terahash per second to hash per second */
export function THPStoHPS(thps: number) {
  return thps * 10 ** 12;
}

/** Converts human readable LMR value to LMR * 10 ** 8 the decimal value used for storage and calculations */
export function LMRToLMRWithDecimals(lmr: number) {
  return lmr * 10 ** 8;
}

export function hoursToSeconds(hours: number) {
  return hours * 3600;
}

export function noop(...args: any[]) {}

/** Returns true if all specified env variables are set */
export function requireEnvsSet<T extends string | number | symbol>(...envs:[T, ...T[]]): Record<typeof envs[number], string> {
  for (const envName of envs){
    requireTruthyString(process.env[envName]);
  }
  return process.env as Record<typeof envs[number], string>;
}

export function requireTruthyString(value: string | undefined): asserts value is string{
  if (!value) {
    throw new Error(`Environment variable ${value} is required but not set`);
  }
}