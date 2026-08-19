import { test } from "node:test";
import assert from "node:assert/strict";
import { ed25519 } from "@noble/curves/ed25519";
import { ec } from "starknet";
import { deriveSeeds, MAX_VIEWING_KEY } from "../src/derive.ts";
import { DERIVATION_MESSAGE_BYTES } from "../src/message.ts";

const STARK_CURVE_ORDER: bigint = ec.starkCurve.CURVE.n;

function synthKeypair() {
  const secretKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  return { secretKey, publicKey };
}

test("ed25519 signing is deterministic: same key + message → identical signature", () => {
  const { secretKey } = synthKeypair();
  const sig1 = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);
  const sig2 = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);
  assert.deepEqual(sig1, sig2);
});

test("deriveSeeds rejects a signature that is not 64 bytes", () => {
  assert.throws(() => deriveSeeds(new Uint8Array(63)));
  assert.throws(() => deriveSeeds(new Uint8Array(65)));
});

test("a single flipped bit in the signature changes both seeds", () => {
  const { secretKey } = synthKeypair();
  const signature = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);
  const flipped = Uint8Array.from(signature);
  flipped[0] = (flipped[0] ?? 0) ^ 0x01;

  const original = deriveSeeds(signature);
  const mutated = deriveSeeds(flipped);

  assert.notEqual(original.spendingKeySeed, mutated.spendingKeySeed);
  assert.notEqual(original.viewingKeySeed, mutated.viewingKeySeed);
});

test("spendingKeySeed is a bigint in [1, n-1]", () => {
  const { secretKey } = synthKeypair();
  const signature = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);
  const { spendingKeySeed } = deriveSeeds(signature);

  assert.equal(typeof spendingKeySeed, "bigint");
  assert.ok(spendingKeySeed >= 1n);
  assert.ok(spendingKeySeed <= STARK_CURVE_ORDER - 1n);
});

test("viewingKeySeed is a bigint in [1, MAX_VIEWING_KEY]", () => {
  const { secretKey } = synthKeypair();
  const signature = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);
  const { viewingKeySeed } = deriveSeeds(signature);

  assert.equal(typeof viewingKeySeed, "bigint");
  assert.ok(viewingKeySeed >= 1n);
  assert.ok(viewingKeySeed <= MAX_VIEWING_KEY);
});

test("same signature always derives the same seeds", () => {
  const { secretKey } = synthKeypair();
  const signature = ed25519.sign(DERIVATION_MESSAGE_BYTES, secretKey);

  const first = deriveSeeds(signature);
  const second = deriveSeeds(signature);

  assert.equal(first.spendingKeySeed, second.spendingKeySeed);
  assert.equal(first.viewingKeySeed, second.viewingKeySeed);
});
