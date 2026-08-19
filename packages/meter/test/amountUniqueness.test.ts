import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreAmountUniqueness } from "../src/signals/amountUniqueness.ts";
import { healthyWindow, thinWindow } from "./fixtures.ts";

test("a common amount in a healthy pool is clear", () => {
  const result = scoreAmountUniqueness(healthyWindow(), { amount: 1_000_010n });
  assert.equal(result.status, "clear");
  assert.ok((result.value ?? 0) >= 3);
});

test("a lone amount in a thin pool is flagged distinctive", () => {
  const result = scoreAmountUniqueness(thinWindow(), { amount: 5_000_000n });
  assert.equal(result.status, "flagged");
  assert.ok((result.value ?? 99) < 3);
});

test("a wildly different amount has zero matches", () => {
  const result = scoreAmountUniqueness(healthyWindow(), { amount: 9_999_999_999n });
  assert.equal(result.status, "flagged");
  assert.equal(result.value, 0);
});
