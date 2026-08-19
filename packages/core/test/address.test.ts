import { test } from "node:test";
import assert from "node:assert/strict";
import { ed25519 } from "@noble/curves/ed25519";
import { deriveIdentity } from "../src/index.ts";
import {
  DERIVATION_MESSAGE_BYTES,
  LEGACY_DERIVATION_MESSAGE,
} from "../src/message.ts";

// Fixed synthetic ed25519 secret key (never a real wallet key). Regression
// lock on the whole pipeline: message → signature → HKDF → grindKey →
// Stark public key → counterfactual address.
const GOLDEN_SECRET_KEY = new Uint8Array(32).fill(7);
const GOLDEN_SIGNATURE = ed25519.sign(DERIVATION_MESSAGE_BYTES, GOLDEN_SECRET_KEY);

const EXPECTED_STARK_PUBLIC_KEY =
  3439191651636782922181122309030860169408292242168438165119147310754041289921n;
const EXPECTED_ADDRESS =
  0x6f8d9586d1f5492889d881ceb7d2f18f8516ff23137c5328e8400812bae7an;
const EXPECTED_VIEWING_KEY =
  1350324574965513782720014009071872873289445599092613409631521122301320884899n;

test("golden vector: fixed secret key derives the exact expected address", () => {
  const identity = deriveIdentity(GOLDEN_SIGNATURE);

  assert.equal(identity.public.starkPublicKey, EXPECTED_STARK_PUBLIC_KEY);
  assert.equal(identity.public.address, EXPECTED_ADDRESS);
  assert.equal(identity.public.viewingKey, EXPECTED_VIEWING_KEY);
});

test("legacy PRD message signature derives a different address", () => {
  const legacySignature = ed25519.sign(
    new TextEncoder().encode(LEGACY_DERIVATION_MESSAGE),
    GOLDEN_SECRET_KEY,
  );

  const currentIdentity = deriveIdentity(GOLDEN_SIGNATURE);
  const legacyIdentity = deriveIdentity(legacySignature);

  assert.notEqual(
    currentIdentity.public.address,
    legacyIdentity.public.address,
  );
});

test("deriveIdentity is deterministic across repeated calls", () => {
  const first = deriveIdentity(GOLDEN_SIGNATURE);
  const second = deriveIdentity(GOLDEN_SIGNATURE);

  assert.equal(first.public.address, second.public.address);
  assert.equal(first.public.starkPublicKey, second.public.starkPublicKey);
  assert.equal(first.public.viewingKey, second.public.viewingKey);
});
