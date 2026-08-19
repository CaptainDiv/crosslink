import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "determinism-worker.mts");

// A fixed synthetic ed25519 secret key, hex-encoded so it can cross a
// process boundary as a CLI arg. Never a real wallet key.
const SYNTHETIC_SECRET_KEY_HEX = "03".repeat(32);

function runWorker(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--experimental-strip-types", WORKER_PATH, SYNTHETIC_SECRET_KEY_HEX],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`worker exited with code ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
    child.on("error", reject);
  });
}

console.log("Spawning two fresh node processes, each deriving independently...");

const [addressA, addressB] = await Promise.all([runWorker(), runWorker()]);

console.log(`process A → ${addressA}`);
console.log(`process B → ${addressB}`);

if (addressA === addressB) {
  console.log("MATCH — same wallet + message → same Starknet address, across runs.");
  process.exit(0);
} else {
  console.error("MISMATCH — the Phase 0 gate fails. Do not proceed to Phase 1.");
  process.exit(1);
}
