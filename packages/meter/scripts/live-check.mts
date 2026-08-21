import { readFileSync } from "node:fs";
import { createProvider, fetchPoolWindow } from "../src/rpc.ts";
import { scorePendingSend } from "../src/score.ts";

function loadEnvRpcUrl(): string | undefined {
  try {
    const envFile = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
    const match = envFile.match(/^STARKNET_RPC=(.+)$/m);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
}

const configuredUrl = loadEnvRpcUrl();
const hasRealKey = configuredUrl !== undefined && !configuredUrl.includes("YOUR_KEY_HERE");

if (!hasRealKey) {
  console.log(
    "STARKNET_RPC in .env is still the placeholder — falling back to " +
      "packages/meter's default public RPC (rpc.starknet.lava.build). This " +
      "is also what the deployed page uses, so this is the realistic check.",
  );
}

const provider = createProvider(hasRealKey ? configuredUrl : undefined);

console.log("Fetching recent pool window from mainnet...");
const window = await fetchPoolWindow(provider);
console.log(
  `Window: blocks ${window.fromBlock}-${window.toBlock}, avg block time ${window.avgBlockTimeSeconds.toFixed(2)}s`,
);
console.log(
  `USDC deposits: ${window.usdcDeposits.length}, withdrawals: ${window.usdcWithdrawals.length}, note-creation events: ${window.noteCreations.length}`,
);

const oneUsdc = 1_000_000n; // USDC, 6 decimals
const result = scorePendingSend(window, { amount: oneUsdc });

console.log(`\nScoring a 1 USDC send with no funding time given:`);
console.log(`Verdict: ${result.verdict} — ${result.headline}`);
for (const signal of result.signals) {
  console.log(`  [${signal.status}] ${signal.id}: ${signal.headline}`);
}
