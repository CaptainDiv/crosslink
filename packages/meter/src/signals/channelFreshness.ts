import { CHANNEL_FRESHNESS_THIN_THRESHOLD, CHANNEL_FRESHNESS_WINDOW_SECONDS } from "../constants.ts";
import type { PoolWindow, SignalResult } from "../types.ts";

/**
 * "Was a channel opened in tight succession with this transfer?" — the real
 * question needs the sender's own channel key, which only the SDK/wallet
 * (Phase 1, not wired up here) can see. This is a pool-wide proxy instead:
 * how much channel/subchannel-opening activity (EncNoteCreated +
 * OpenNoteCreated) exists right now to blend a fresh channel into. It is
 * NOT a read of any specific user's channel — labeled as a proxy in the UI.
 */
export function scoreChannelFreshness(window: PoolWindow): SignalResult {
  const subWindowBlocks = Math.max(
    1,
    Math.round(CHANNEL_FRESHNESS_WINDOW_SECONDS / window.avgBlockTimeSeconds),
  );
  const cutoff = window.toBlock - subWindowBlocks;
  const recentCount = window.noteCreations.filter((e) => e.blockNumber >= cutoff).length;

  if (recentCount < CHANNEL_FRESHNESS_THIN_THRESHOLD) {
    return {
      id: "channel_freshness",
      status: "flagged",
      headline: "Little channel-opening cover right now (pool-wide proxy).",
      detail: `Only ${recentCount} new-note events pool-wide in the last hour. A freshly opened channel would stand out. This is a pool-wide proxy, not a read of your specific channel — that needs a connected wallet.`,
      value: recentCount,
    };
  }

  return {
    id: "channel_freshness",
    status: "clear",
    headline: "Reasonable channel-opening cover right now (pool-wide proxy).",
    detail: `${recentCount} new-note events pool-wide in the last hour. This is a pool-wide proxy, not a read of your specific channel — that needs a connected wallet.`,
    value: recentCount,
  };
}
