import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  DERIVATION_MESSAGE,
  DERIVATION_MESSAGE_BYTES,
  LEGACY_DERIVATION_MESSAGE,
} from "../src/message.ts";

// Golden constant, pinned by SHA-256 so any byte-level drift in the message
// fails loudly here rather than silently relocating every derived address.
const EXPECTED_SHA256 =
  "4d3d4ed486db411007369bd10d58f36dc7d754191486a7ab7f88e3dfc1939d49";

test("message is exactly 53 bytes", () => {
  assert.equal(DERIVATION_MESSAGE_BYTES.length, 53);
});

test("message sha256 matches the golden constant", () => {
  const digest = createHash("sha256")
    .update(DERIVATION_MESSAGE_BYTES)
    .digest("hex");
  assert.equal(digest, EXPECTED_SHA256);
});

test("every byte is ASCII (< 0x80)", () => {
  for (const byte of DERIVATION_MESSAGE_BYTES) {
    assert.ok(byte < 0x80, `byte ${byte} is not ASCII`);
  }
});

test("separator is a bare \\n with no \\r", () => {
  assert.ok(DERIVATION_MESSAGE.includes("\n"));
  assert.ok(!DERIVATION_MESSAGE.includes("\r"));
});

test("legacy PRD string differs from the current message", () => {
  assert.notEqual(LEGACY_DERIVATION_MESSAGE, DERIVATION_MESSAGE);
});
