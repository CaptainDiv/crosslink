import type { SignalResult } from "../types.ts";

/**
 * Real STRK20 SDK flows surface a `USER_LINKAGE` warning on `ExecuteResult`
 * pre-submit. We have no SDK here (Phase 1 is parked), so this is a
 * rule-based synthesis in the same spirit, built from the other four
 * signals — labeled "-style" everywhere so it is never mistaken for the
 * SDK's real output.
 */
export function scoreUserLinkageWarning(otherSignals: SignalResult[]): SignalResult {
  const flagged = otherSignals.filter((s) => s.status === "flagged");
  const flaggedIds = new Set(flagged.map((s) => s.id));

  const amountFlagged = flaggedIds.has("amount_uniqueness");
  const timingFlagged = flaggedIds.has("timing_correlation");
  const plausibleSetFlagged = flaggedIds.has("plausible_set");

  const linkageRiskCount = [amountFlagged, timingFlagged, plausibleSetFlagged].filter(Boolean).length;

  if (linkageRiskCount >= 2) {
    return {
      id: "user_linkage_warning",
      status: "flagged",
      headline: "USER_LINKAGE-style warning.",
      detail: `${flagged.length} of the other signals are flagged together — this combination is the kind of pattern that would trip a linkage warning in the real SDK flow (not literally computed by it here).`,
      value: flagged.length,
    };
  }

  return {
    id: "user_linkage_warning",
    status: "clear",
    headline: "No USER_LINKAGE-style pattern detected.",
    detail: "The flagged-signal combination that would typically trip a linkage warning isn't present.",
    value: flagged.length,
  };
}
