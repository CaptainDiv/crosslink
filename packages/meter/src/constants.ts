/**
 * Live mainnet pool, per CLAUDE.md. Same address as STRK20_POOL in .env.example.
 */
export const POOL_ADDRESS: bigint =
  0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812an;

/**
 * USDC's token address inside the pool. Confirmed live via a `symbol()` call
 * against the token address found on real Deposit events (2026-08-19) —
 * not assumed from an external token list, since the pool also carries
 * STRK, WBTC and several test tokens (SLAY, strkBTC, DOG) through the same
 * Deposit/Withdrawal event stream.
 */
export const USDC_TOKEN_ADDRESS: bigint =
  0x33068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fbn;

/** Notes mature 10 blocks after creation — CLAUDE.md pool semantics. */
export const MATURITY_BLOCKS = 10;

/** Default recent-activity window: ~2 days at Starknet's current ~1.7s block time. */
export const DEFAULT_WINDOW_BLOCKS = 100_000;

/** How far back to probe a second block to estimate the current block time. */
export const BLOCK_TIME_PROBE_BLOCKS = 10_000;

/** Sub-window for the channel-freshness proxy signal. */
export const CHANNEL_FRESHNESS_WINDOW_SECONDS = 60 * 60;

/** PRD example verdict: "You funded 40 seconds ago. Wait 5 minutes." */
export const TIMING_SAFETY_MARGIN_SECONDS = 5 * 60;

/** Amount uniqueness: candidate amount is "the same" as another within this tolerance. */
export const AMOUNT_TOLERANCE_BPS = 100n; // 1%

/** Below this many matching amounts in-window, an amount is flagged distinctive. */
export const AMOUNT_UNIQUENESS_MIN_MATCHES = 3;

/** Below this many in-window deposits ≥ candidate amount, the pool is "thin" for this send. */
export const PLAUSIBLE_SET_THIN_THRESHOLD = 10;

/** Below this many pool-wide note-creation events in the freshness sub-window, channel-open cover is thin. */
export const CHANNEL_FRESHNESS_THIN_THRESHOLD = 5;
