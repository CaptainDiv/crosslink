export interface DepositEvent {
  kind: "deposit";
  userAddr: bigint;
  token: bigint;
  amount: bigint;
  blockNumber: number;
  txHash: string;
}

export interface WithdrawalEvent {
  kind: "withdrawal";
  toAddr: bigint;
  token: bigint;
  amount: bigint;
  blockNumber: number;
  txHash: string;
}

/**
 * Pool-wide new-note activity (EncNoteCreated / OpenNoteCreated). Amounts and
 * owners are not decoded — they're encrypted or irrelevant to this proxy —
 * only the fact and block number of note creation matter here.
 */
export interface NoteCreatedEvent {
  kind: "note_created";
  blockNumber: number;
  txHash: string;
}

export type PoolEvent = DepositEvent | WithdrawalEvent | NoteCreatedEvent;

/** A pending send the meter is asked to evaluate, plus the fetched public window it's scored against. */
export interface Candidate {
  /** USDC amount in smallest units (6 decimals). */
  amount: bigint;
  /**
   * Unix seconds the payer funded their shielded balance, if known.
   * Self-reported — this is the wallet's own local state, not something
   * discovered from the pool (that would require SDK/Phase 1 wiring).
   * Omit to skip the timing-correlation signal rather than fabricate it.
   */
  fundedAt?: number;
  /** Unix seconds "now". Defaults to the current time; overridable for tests. */
  now?: number;
}

export interface PoolWindow {
  fromBlock: number;
  toBlock: number;
  latestBlock: number;
  /** Estimated seconds per block, from two probed blocks in-window. */
  avgBlockTimeSeconds: number;
  usdcDeposits: DepositEvent[];
  usdcWithdrawals: WithdrawalEvent[];
  noteCreations: NoteCreatedEvent[];
}

export type SignalId =
  | "amount_uniqueness"
  | "timing_correlation"
  | "channel_freshness"
  | "plausible_set"
  | "user_linkage_warning";

export type SignalStatus = "clear" | "flagged" | "not_evaluated";

export interface SignalResult {
  id: SignalId;
  status: SignalStatus;
  headline: string;
  detail: string;
  /** Raw metric backing this signal, where one exists (a count, a ratio, a second count). */
  value?: number;
}

export type Verdict = "clear" | "distinctive_amount" | "too_soon" | "thin_pool";

export interface MeterResult {
  verdict: Verdict;
  headline: string;
  detail: string;
  signals: SignalResult[];
  poolStats: {
    fromBlock: number;
    toBlock: number;
    usdcDepositCount: number;
    usdcWithdrawalCount: number;
  };
}
