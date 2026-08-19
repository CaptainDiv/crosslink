import { scoreAmountUniqueness } from "./signals/amountUniqueness.ts";
import { scoreChannelFreshness } from "./signals/channelFreshness.ts";
import { scorePlausibleSet } from "./signals/plausibleSet.ts";
import { scoreTimingCorrelation } from "./signals/timingCorrelation.ts";
import { scoreUserLinkageWarning } from "./signals/warnings.ts";
import type { Candidate, MeterResult, PoolWindow, SignalResult } from "./types.ts";

function pickVerdict(signals: SignalResult[]): Pick<MeterResult, "verdict" | "headline" | "detail"> {
  const byId = new Map(signals.map((s) => [s.id, s]));
  const timing = byId.get("timing_correlation");
  const plausibleSet = byId.get("plausible_set");
  const amount = byId.get("amount_uniqueness");

  if (timing && timing.status === "flagged") {
    return { verdict: "too_soon", headline: timing.headline, detail: timing.detail };
  }
  if (plausibleSet && plausibleSet.status === "flagged") {
    return { verdict: "thin_pool", headline: plausibleSet.headline, detail: plausibleSet.detail };
  }
  if (amount && amount.status === "flagged") {
    return { verdict: "distinctive_amount", headline: amount.headline, detail: amount.detail };
  }
  return {
    verdict: "clear",
    headline: "Unlinkable given current pool state.",
    detail: "No signal is flagged for this amount and timing, against the current recent-activity window.",
  };
}

/**
 * Scores one pending send against a fetched public pool window. Pure
 * function — pass a live `fetchPoolWindow()` result for real scoring, or a
 * fixture for tests.
 */
export function scorePendingSend(window: PoolWindow, candidate: Candidate): MeterResult {
  const amountUniqueness = scoreAmountUniqueness(window, candidate);
  const timingCorrelation = scoreTimingCorrelation(window, candidate);
  const channelFreshness = scoreChannelFreshness(window);
  const plausibleSet = scorePlausibleSet(window, candidate);
  const userLinkageWarning = scoreUserLinkageWarning([
    amountUniqueness,
    timingCorrelation,
    channelFreshness,
    plausibleSet,
  ]);

  const signals = [amountUniqueness, timingCorrelation, channelFreshness, plausibleSet, userLinkageWarning];

  return {
    ...pickVerdict(signals),
    signals,
    poolStats: {
      fromBlock: window.fromBlock,
      toBlock: window.toBlock,
      usdcDepositCount: window.usdcDeposits.length,
      usdcWithdrawalCount: window.usdcWithdrawals.length,
    },
  };
}
