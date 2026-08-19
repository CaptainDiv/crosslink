import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePlausibleSet } from "../src/signals/plausibleSet.ts";
import { healthyWindow, thinWindow } from "./fixtures.ts";

test("a small amount against a healthy pool has a large plausible set", () => {
  const result = scorePlausibleSet(healthyWindow(), { amount: 1_000_000n });
  assert.equal(result.status, "clear");
  assert.ok((result.value ?? 0) >= 10);
});

test("thin pool deposits under threshold are flagged", () => {
  const result = scorePlausibleSet(thinWindow(), { amount: 1_000n });
  assert.equal(result.status, "flagged");
  assert.equal(result.value, 1);
});

test("an amount larger than every deposit has an empty plausible set", () => {
  const result = scorePlausibleSet(healthyWindow(), { amount: 999_999_999n });
  assert.equal(result.status, "flagged");
  assert.equal(result.value, 0);
});
