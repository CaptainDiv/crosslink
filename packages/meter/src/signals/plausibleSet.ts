import { PLAUSIBLE_SET_THIN_THRESHOLD } from "../constants.ts";
import type { Candidate, PoolWindow, SignalResult } from "../types.ts";

/**
 * "How many deposits could explain this withdrawal in-window?" — count of
 * public USDC deposits with amount >= the candidate send, in the recent
 * window. Directly computable; this is the anonymity-set size itself.
 */
export function scorePlausibleSet(window: PoolWindow, candidate: Candidate): SignalResult {
  const count = window.usdcDeposits.filter((d) => d.amount >= candidate.amount).length;

  if (count < PLAUSIBLE_SET_THIN_THRESHOLD) {
    return {
      id: "plausible_set",
      status: "flagged",
      headline: "Privacy is weak right now.",
      detail: `Only ${count} deposit(s) in the window could explain this payout. The anonymity set is thin.`,
      value: count,
    };
  }

  return {
    id: "plausible_set",
    status: "clear",
    headline: "Unlinkable within a reasonable set.",
    detail: `${count} deposits in the window could explain this payout.`,
    value: count,
  };
}
