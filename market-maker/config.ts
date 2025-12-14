import { type Static, type StringOptions, type TUnsafe, Type } from "@sinclair/typebox";
import envSchema from "env-schema";
import { Ajv } from "ajv";
import formatsPlugin from "ajv-formats";

const TypeEthAddress = (opt?: StringOptions) =>
  Type.String({ ...opt, pattern: "^0x[a-fA-F0-9]{40}$" }) as TUnsafe<`0x${string}`>;

const TypePrivateKey = (opt?: StringOptions) =>
  Type.String({ ...opt, pattern: "^0x[a-fA-F0-9]{64}$" }) as TUnsafe<`0x${string}`>;

const schema = Type.Object({
  SUBGRAPH_URL: Type.String({ format: "uri" }),
  SUBGRAPH_API_KEY: Type.String(),
  FLOAT_AMOUNT: Type.Number({ minimum: 0, multipleOf: 1 }),
  SPREAD_AMOUNT: Type.Number({ minimum: 0, multipleOf: 1 }),
  GRID_LEVELS: Type.Number({ minimum: 0, multipleOf: 1 }),
  ACTIVE_QUOTING_AMOUNT_RATIO: Type.Number({ minimum: 0, maximum: 1 }),
  FUTURES_ADDRESS: TypeEthAddress(),
  ETH_NODE_URL: Type.String({ format: "uri" }),
  PRIVATE_KEY: TypePrivateKey(),
  LOOP_INTERVAL_MS: Type.Number({ minimum: 0, multipleOf: 1 }),
  MAX_POSITION: Type.Number({ minimum: 0, multipleOf: 1 }),
  LOG_LEVEL: Type.String(),
});

export type Config = Static<typeof schema>;

// Create custom Ajv instance with format validation
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: true,
  useDefaults: true,
  coerceTypes: true,
});

// Add format validators (including "uri")
formatsPlugin.default(ajv);

export const getConfig = () => {
  const config = envSchema<Config>({
    schema,
    dotenv: true, // load .env if it is there, default: false
    ajv, // Pass our custom Ajv instance with format support
  });

  return {
    ...config,
    FLOAT_AMOUNT: BigInt(config.FLOAT_AMOUNT),
    SPREAD_AMOUNT: BigInt(config.SPREAD_AMOUNT),
    GRID_LEVELS: BigInt(config.GRID_LEVELS),
    MAX_POSITION: BigInt(config.MAX_POSITION),
  };
};
