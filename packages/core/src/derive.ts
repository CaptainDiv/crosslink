import { sha256 } from "@noble/hashes/sha2";
import { extract, expand } from "@noble/hashes/hkdf";
import { ec } from "starknet";

const HKDF_SALT = sha256(new TextEncoder().encode("crosslink/v1/solana-ed25519"));
const SPENDING_KEY_INFO = new TextEncoder().encode(
  "crosslink/v1/starknet-spending-key",
);
const VIEWING_KEY_INFO = new TextEncoder().encode("crosslink/v1/viewing-key");

const STARK_CURVE_ORDER: bigint = ec.starkCurve.CURVE.n;

// TODO(phase-1): assert this equals the Privacy SDK's exported viewing-key
// range once the SDK is installed.
export const MAX_VIEWING_KEY: bigint = STARK_CURVE_ORDER >> 1n;

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * StarkEx-style grindKey: hash `seed || counter`, reject draws above the
 * largest multiple of `max + 1` that fits in 256 bits, then reduce mod
 * `max + 1`. Avoids the modulo bias a plain `hash(seed) % max` would
 * introduce.
 */
function grindToRange(seed: Uint8Array, max: bigint): bigint {
  const range = max + 1n;
  const twoTo256 = 1n << 256n;
  const largestMultiple = twoTo256 - (twoTo256 % range);

  let counter = 0;
  for (;;) {
    const counterBytes = new TextEncoder().encode(counter.toString());
    const input = new Uint8Array(seed.length + counterBytes.length);
    input.set(seed, 0);
    input.set(counterBytes, seed.length);

    const draw = bytesToBigInt(sha256(input));
    if (draw < largestMultiple) {
      const reduced = draw % range;
      return reduced === 0n ? 1n : reduced;
    }
    counter += 1;
  }
}

export interface DerivedIdentityPublic {
  readonly starkPublicKey: bigint;
  readonly address: bigint;
  readonly viewingKey: bigint;
}

export interface DerivedIdentitySecret {
  readonly spendingKey: bigint;
}

export interface DerivedIdentity {
  readonly public: DerivedIdentityPublic;
  readonly secret: DerivedIdentitySecret;
}

/**
 * Derives spending-key and viewing-key seeds from a raw ed25519 signature.
 * Does not compute the public key or address — callers combine this with
 * address.ts. Kept separate so tests can exercise seed derivation without
 * pulling in contract-address math.
 */
export function deriveSeeds(signature: Uint8Array): {
  spendingKeySeed: bigint;
  viewingKeySeed: bigint;
} {
  if (signature.length !== 64) {
    throw new Error(
      `expected a 64-byte ed25519 signature, got ${signature.length} bytes`,
    );
  }

  const prk = extract(sha256, signature, HKDF_SALT);
  const spendingKeyMaterial = expand(sha256, prk, SPENDING_KEY_INFO, 32);
  const viewingKeyMaterial = expand(sha256, prk, VIEWING_KEY_INFO, 32);

  const spendingKeySeed = grindToRange(
    spendingKeyMaterial,
    STARK_CURVE_ORDER - 1n,
  );
  const viewingKeySeed = grindToRange(viewingKeyMaterial, MAX_VIEWING_KEY);

  return { spendingKeySeed, viewingKeySeed };
}
