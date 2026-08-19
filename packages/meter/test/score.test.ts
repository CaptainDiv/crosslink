import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePendingSend } from "../src/score.ts";
import { healthyWindow, thinWindow } from "./fixtures.ts";

test("a common amount, healthy pool, no funding time given: clear", () => {
  const result = scorePendingSend(healthyWindow(), { amount: 1_000_010n });
  assert.equal(result.verdict, "clear");
  assert.equal(result.signals.length, 5);
});

test("thin pool drives a thin_pool verdict even for a matched amount", () => {
  const result = scorePendingSend(thinWindow(), { amount: 5_000_000n });
  assert.equal(result.verdict, "thin_pool");
});

test("funding too recently drives a too_soon verdict, overriding other signals", () => {
  const now = 1_000_000;
  const result = scorePendingSend(healthyWindow(), {
    amount: 1_000_010n,
    fundedAt: now - 1,
    now,
  });
  assert.equal(result.verdict, "too_soon");
});

test("poolStats reflect the window's raw counts", () => {
  const window = healthyWindow();
  const result = scorePendingSend(window, { amount: 1_000_010n });
  assert.equal(result.poolStats.usdcDepositCount, window.usdcDeposits.length);
  assert.equal(result.poolStats.usdcWithdrawalCount, window.usdcWithdrawals.length);
});
