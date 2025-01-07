import {
  type Abi,
  type DecodeErrorResultReturnType,
  BaseError,
  InvalidInputRpcError,
  ContractFunctionRevertedError,
  UnknownRpcError,
  decodeErrorResult,
  type PublicClient,
  fromHex,
  fromBytes,
  type Account,
  keccak256,
  toBytes,
  recoverPublicKey,
  type WalletActions,
} from "viem";
import { secp256k1 } from "@noble/curves/secp256k1";
import { hexToBytes, bytesToHex } from "@noble/curves/abstract/utils";

/** helper function to catch errors and check if the error is the expected one
 * @example
 * await catchError(abi, "ErrorName", async () => {
 *   await contract.method();
 * });
 **/
export async function catchError<const TAbi extends Abi | readonly unknown[]>(
  abi: TAbi | undefined,
  error:
    | DecodeErrorResultReturnType<TAbi>["errorName"]
    | DecodeErrorResultReturnType<TAbi>["errorName"][],
  cb: () => Promise<unknown>
) {
  try {
    await cb();
    throw new Error(`No error was thrown, expected error "${error}"`);
  } catch (err) {
    if (Array.isArray(error)) {
      return expectError(err, abi, error);
    }
    return expectError(err, abi, [error]);
  }
}

export function expectError<const TAbi extends Abi | readonly unknown[]>(
  err: any,
  abi: TAbi | undefined,
  errors: DecodeErrorResultReturnType<TAbi>["errorName"][]
) {
  for (const error of errors) {
    if (isErr(err, abi, error)) {
      return;
    }
  }

  throw new Error(
    `Expected one of blockchain custom errors "${errors.join(" | ")}" was not thrown\n\n${err}`,
    { cause: err }
  );
}

export function isErr<const TAbi extends Abi | readonly unknown[]>(
  err: any,
  abi: TAbi | undefined,
  error: DecodeErrorResultReturnType<TAbi>["errorName"]
): boolean {
  if (err instanceof BaseError) {
    const revertError = err.walk((err) => {
      return (
        err instanceof InvalidInputRpcError ||
        err instanceof ContractFunctionRevertedError ||
        err instanceof UnknownRpcError
      );
    });

    // support for regular provider
    if (revertError instanceof ContractFunctionRevertedError) {
      const errorName = revertError.data?.errorName ?? "";
      if (errorName === error) {
        return true;
      }
    }

    // support for hardhat node
    let data: `0x${string}` = "0x";
    if (revertError instanceof InvalidInputRpcError) {
      data = (revertError?.cause as any)?.data?.data;
    } else if (revertError instanceof UnknownRpcError) {
      data = (revertError.cause as any)?.data;
    }

    if (data) {
      try {
        const decodedError = decodeErrorResult({ abi, data });
        if (decodedError.errorName === error) {
          return true;
        }
      } catch (e) {
        console.error("!!!!", e);
        return false;
      }
    }
  }

  console.error(err);
  return false;
}

interface BalanceOf {
  read: {
    balanceOf: (a: [`0x${string}`], b?: { blockNumber?: bigint }) => Promise<bigint>;
  };
}

/** Returns the change of address token balance due to the transaction */
export async function getTxDeltaBalance(
  pc: PublicClient,
  txHash: `0x${string}`,
  address: `0x${string}`,
  token: BalanceOf
): Promise<bigint> {
  const receipt = await pc.waitForTransactionReceipt({ hash: txHash });
  const before = await token.read.balanceOf([address], {
    blockNumber: receipt.blockNumber - 1n,
  });
  const after = await token.read.balanceOf([address]);
  return after - before;
}

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
