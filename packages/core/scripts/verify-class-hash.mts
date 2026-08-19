import { readFileSync } from "node:fs";
import { RpcProvider } from "starknet";
import { ACCOUNT_CLASS_HASH } from "../src/constants.ts";

function loadEnvRpcUrl(): string | undefined {
  try {
    const envFile = readFileSync(
      new URL("../../../.env", import.meta.url),
      "utf8",
    );
    const match = envFile.match(/^STARKNET_RPC=(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const configuredUrl = loadEnvRpcUrl();
const hasRealKey = configuredUrl !== undefined && !configuredUrl.includes("YOUR_KEY_HERE");

const provider = hasRealKey
  ? new RpcProvider({ nodeUrl: configuredUrl })
  : new RpcProvider({ nodeUrl: "SN_MAIN" });

if (!hasRealKey) {
  console.log(
    "STARKNET_RPC in .env is still the placeholder — falling back to " +
      "starknet.js's bundled public mainnet node (Zan). Set a real Alchemy " +
      "key in .env for a more reliable endpoint.",
  );
}

console.log(`Checking class hash 0x${ACCOUNT_CLASS_HASH.toString(16)} on SN_MAIN...`);

try {
  const contractClass = await provider.getClassByHash(ACCOUNT_CLASS_HASH);
  const entryPointKinds = Object.keys(
    (contractClass as { entry_points_by_type?: Record<string, unknown> })
      .entry_points_by_type ?? {},
  );
  console.log("DECLARED: class hash is declared on mainnet.");
  console.log(`Entry point kinds: ${entryPointKinds.join(", ") || "(none reported)"}`);
  process.exit(0);
} catch (error) {
  console.error("NOT DECLARED (or RPC error) — do not proceed on this class hash.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
