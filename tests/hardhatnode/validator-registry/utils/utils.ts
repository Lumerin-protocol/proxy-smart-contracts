import {
  type Abi,
  type DecodeErrorResultReturnType,
  BaseError,
  InvalidInputRpcError,
  ContractFunctionRevertedError,
  UnknownRpcError,
  decodeErrorResult,
  type PublicClient,
} from "viem";

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
