import { defineConfig } from "@wagmi/cli";
import { hardhat } from "@wagmi/cli/plugins";

export default defineConfig({
  plugins: [
    hardhat({
      artifacts: "./artifacts/contracts",
      project: ".",
      exclude: ["*Test.sol/**", "vesting/**"],
      commands: {
        build: "yarn hardhat --config hardhat-base.config.ts compile",
        rebuild: "yarn hardhat --config hardhat-base.config.ts compile",
      },
    }),
  ],
  out: "./build-js/src/abi/abi.ts",
});
