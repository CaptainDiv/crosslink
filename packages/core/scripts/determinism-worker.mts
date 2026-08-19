import { ed25519 } from "@noble/curves/ed25519";
import { deriveIdentity, DERIVATION_MESSAGE_BYTES } from "../src/index.ts";

const secretKeyHex = process.argv[2];
if (!secretKeyHex) {
  throw new Error("usage: determinism-worker.mts <secret-key-hex>");
}

const secretKey = Uint8Array.from(Buffer.from(secretKeyHex, "hex"));
const signature = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);
const identity = deriveIdentity(signature);

process.stdout.write(`0x${identity.public.address.toString(16)}`);
