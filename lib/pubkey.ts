import { fromHex, fromBytes } from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hexToBytes, bytesToHex } from "@noble/curves/abstract/utils";
import { type Account, keccak256, toBytes, recoverPublicKey, type WalletActions } from "viem";

// Workaround to obtain public keys for the accounts in hardhat
export async function getPublicKey(account: WalletActions<undefined, Account>) {
  const message = "abc";
  const sig = await account.signMessage({ message });
  const rec = keccak256(toBytes(`\x19Ethereum Signed Message:\n${message.length}${message}`));
  const pubkey = await recoverPublicKey({ hash: rec, signature: sig });
  return pubkey;
}

export function compressPublicKey(pubKey: `0x${string}`) {
  const pubKeyBytes = fromHex(pubKey, "bytes");
  const point = secp256k1.ProjectivePoint.fromHex(pubKeyBytes);
  const compressed = point.toRawBytes(true);

  return {
    yParity: compressed[0] === hexToBytes("03")[0], // 02 - even - false - 0, 03 - odd - true - 1
    x: fromBytes(compressed.slice(1), "hex"),
  };
}

export function decompressPublicKey(yParity: boolean, x: `0x${string}`): `0x${string}` {
  const xBytes = fromHex(x, "bytes");

  const rec = new Uint8Array(33);
  rec.set(hexToBytes(yParity ? "03" : "02"));
  rec.set(xBytes, 1);

  const decompressed = secp256k1.ProjectivePoint.fromHex(bytesToHex(rec));

  return fromBytes(decompressed.toRawBytes(false), "hex");
}
