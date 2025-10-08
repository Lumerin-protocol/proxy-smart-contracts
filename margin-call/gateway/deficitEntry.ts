export type DeficitEntry = {
  address: `0x${string}`;
  collateralDeficit: bigint;
  balance: bigint;
  percentage: number;
};
