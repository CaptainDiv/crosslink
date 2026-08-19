import { MATURITY_BLOCKS, TIMING_SAFETY_MARGIN_SECONDS } from "../constants.ts";
import type { Candidate, PoolWindow, SignalResult } from "../types.ts";

/**
 * "How close is this payout to the payer's funding leg?" — the funding
 * timestamp is self-reported (the wallet's own local state; the SDK/Phase 1
 * note-discovery service that would let the meter observe it independently
 * isn't wired up yet). If it isn't given, this signal is honestly skipped
 * rather than guessed at.
 */
export function scoreTimingCorrelation(window: PoolWindow, candidate: Candidate): SignalResult {
  if (candidate.fundedAt === undefined) {
    return {
      id: "timing_correlation",
      status: "not_evaluated",
      headline: "Funding time not provided.",
      detail: "Enter when you funded your shielded balance to check this signal.",
    };
  }

  const now = candidate.now ?? Math.floor(Date.now() / 1000);
  const elapsedSeconds = now - candidate.fundedAt;
  const maturitySeconds = MATURITY_BLOCKS * window.avgBlockTimeSeconds;

  if (elapsedSeconds < maturitySeconds) {
    return {
      id: "timing_correlation",
      status: "flagged",
      headline: "Your funding note hasn't matured yet.",
      detail: `Notes mature ${MATURITY_BLOCKS} blocks (~${Math.ceil(maturitySeconds)}s) after creation. You funded ${Math.max(0, Math.floor(elapsedSeconds))}s ago — this send would fail or reveal an immature note.`,
      value: elapsedSeconds,
    };
  }

  if (elapsedSeconds < maturitySeconds + TIMING_SAFETY_MARGIN_SECONDS) {
    return {
      id: "timing_correlation",
      status: "flagged",
      headline: "You funded very recently.",
      detail: `You funded ${Math.floor(elapsedSeconds)}s ago. Wait until at least ${Math.ceil(maturitySeconds + TIMING_SAFETY_MARGIN_SECONDS)}s after funding so this payout doesn't sit right next to it in time.`,
      value: elapsedSeconds,
    };
  }

  return {
    id: "timing_correlation",
    status: "clear",
    headline: "Enough time has passed since funding.",
    detail: `You funded ${Math.floor(elapsedSeconds / 60)} minute(s) ago — outside the maturity + safety window.`,
    value: elapsedSeconds,
  };
}
