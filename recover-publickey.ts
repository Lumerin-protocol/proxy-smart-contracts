import { secp256k1 } from "@noble/curves/secp256k1";
import { hexToBytes, bytesToHex } from "@noble/curves/abstract/utils";

const pubkey =
  "04451961c396e6f5c2124158382faf30cdb88c857d9ea087a6f9624b47689b1fd6645c84bb45c2502190adfca047f32fd0572e6e51b98ed531fe3fc1f678a21515";
console.log("uncompressed", pubkey);
const point = secp256k1.ProjectivePoint.fromHex(pubkey);

const uncompressed = point.toHex(false);
console.log("uncompressed", uncompressed);

const compressed = point.toRawBytes(true);

const compressedPoint = {
  yParity: compressed[0] === hexToBytes("03")[0], // 02 - even - false - 0, 03 - odd - true - 1
  x: compressed.slice(1),
};

const rec = new Uint8Array(33);
rec.set(hexToBytes(compressedPoint.yParity ? "03" : "02"));
rec.set(compressedPoint.x, 1);

const decompressed = secp256k1.ProjectivePoint.fromHex(bytesToHex(rec));
console.log(decompressed);

console.log(decompressed.toHex(false));
