import { AMOUNT_TOLERANCE_BPS, AMOUNT_UNIQUENESS_MIN_MATCHES } from "../constants.ts";
import type { Candidate, PoolWindow, SignalResult } from "../types.ts";

function withinTolerance(a: bigint, b: bigint): boolean {
  if (a === 0n && b === 0n) return true;
  const diff = a > b ? a - b : b - a;
  const base = a > b ? a : b;
  return diff * 10_000n <= base * AMOUNT_TOLERANCE_BPS;
}

/**
 * "Is this amount distinctive in the current window?" — counts other public
 * deposit/withdrawal amounts (USDC) within a 1% band of the candidate.
 * Directly computable from public data; no proxy needed.
 */
export function scoreAmountUniqueness(window: PoolWindow, candidate: Candidate): SignalResult {
  const allAmounts = [
    ...window.usdcDeposits.map((e) => e.amount),
    ...window.usdcWithdrawals.map((e) => e.amount),
  ];
  const matches = allAmounts.filter((a) => withinTolerance(a, candidate.amount)).length;

  if (matches < AMOUNT_UNIQUENESS_MIN_MATCHES) {
    return {
      id: "amount_uniqueness",
      status: "flagged",
      headline: "This amount is distinctive in the current pool window.",
      detail: `Only ${matches} other public deposit/withdrawal in the window is within 1% of this amount. Round it or split it.`,
      value: matches,
    };
  }

  return {
    id: "amount_uniqueness",
    status: "clear",
    headline: "This amount blends in.",
    detail: `${matches} other public deposits/withdrawals in the window are within 1% of this amount.`,
    value: matches,
  };
}
