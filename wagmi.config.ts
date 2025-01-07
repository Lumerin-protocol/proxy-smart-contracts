import { defineConfig } from "@wagmi/cli";
import { hardhat } from "@wagmi/cli/plugins";

export default defineConfig({
  plugins: [
    hardhat({
      artifacts: "./artifacts/contracts",
      project: ".",
      exclude: ["*Test.sol/**", "vesting/**"],
    }),
  ],
  out: "./build-js/src/abi/abi.ts",
});
