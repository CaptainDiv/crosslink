import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreTimingCorrelation } from "../src/signals/timingCorrelation.ts";
import { healthyWindow } from "./fixtures.ts";

test("no fundedAt given is not evaluated, not fabricated", () => {
  const result = scoreTimingCorrelation(healthyWindow(), { amount: 1_000_000n });
  assert.equal(result.status, "not_evaluated");
  assert.equal(result.value, undefined);
});

test("funded 5 seconds ago, notes not yet mature, is flagged", () => {
  const now = 1_000_000;
  const result = scoreTimingCorrelation(healthyWindow(), {
    amount: 1_000_000n,
    fundedAt: now - 5,
    now,
  });
  assert.equal(result.status, "flagged");
});

test("funded well past maturity + safety margin is clear", () => {
  const now = 1_000_000;
  const result = scoreTimingCorrelation(healthyWindow(), {
    amount: 1_000_000n,
    fundedAt: now - 3600,
    now,
  });
  assert.equal(result.status, "clear");
});

test("funded just past maturity but inside the safety margin is still flagged", () => {
  const now = 1_000_000;
  // healthyWindow avgBlockTimeSeconds = 2, maturity = 10 blocks = 20s
  const result = scoreTimingCorrelation(healthyWindow(), {
    amount: 1_000_000n,
    fundedAt: now - 30,
    now,
  });
  assert.equal(result.status, "flagged");
});
