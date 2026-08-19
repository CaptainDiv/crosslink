import { test } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { createSecret } from "../src/secrets.ts";

test("secret.spendingKey is directly readable", () => {
  const secret = createSecret(42n);
  assert.equal(secret.spendingKey, 42n);
});

test("JSON.stringify on the secret throws rather than leaking the key", () => {
  const secret = createSecret(42n);
  assert.throws(() => JSON.stringify(secret));
});

test("JSON.stringify on a container holding the secret does not leak the key", () => {
  const secret = createSecret(42n);
  assert.throws(() => JSON.stringify({ secret }));
});

test("util.inspect on the secret shows [redacted]", () => {
  const secret = createSecret(42n);
  assert.equal(inspect(secret), "[redacted]");
});

test("util.inspect on a container holding the secret does not print the key", () => {
  const secret = createSecret(42n);
  const output = inspect({ secret });
  assert.ok(!output.includes("42n"));
  assert.ok(output.includes("[redacted]"));
});
