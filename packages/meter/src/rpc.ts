import { RpcProvider, hash } from "starknet";
import {
  BLOCK_TIME_PROBE_BLOCKS,
  DEFAULT_WINDOW_BLOCKS,
  POOL_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from "./constants.ts";
import type { DepositEvent, NoteCreatedEvent, PoolWindow, WithdrawalEvent } from "./types.ts";

const DEPOSIT_SELECTOR = hash.getSelectorFromName("Deposit");
const WITHDRAWAL_SELECTOR = hash.getSelectorFromName("Withdrawal");
const ENC_NOTE_CREATED_SELECTOR = hash.getSelectorFromName("EncNoteCreated");
const OPEN_NOTE_CREATED_SELECTOR = hash.getSelectorFromName("OpenNoteCreated");

const toHex = (value: bigint): string => `0x${value.toString(16)}`;

/**
 * Public SN_MAIN endpoint by default — no key required, verified working
 * against the live pool. Pass an explicit nodeUrl (e.g. a private RPC) to
 * override; the deployed page never does, so no secret ships client-side.
 */
export function createProvider(nodeUrl?: string): RpcProvider {
  return new RpcProvider(nodeUrl ? { nodeUrl } : { nodeUrl: "SN_MAIN" });
}

interface RawEvent {
  keys: string[];
  data: string[];
  block_number: number;
  transaction_hash: string;
}

async function fetchAllEvents(
  provider: RpcProvider,
  fromBlock: number,
  toBlock: number,
  keys: string[][],
  maxPages = 25,
): Promise<RawEvent[]> {
  const events: RawEvent[] = [];
  let continuationToken: string | undefined;
  let pages = 0;
  do {
    const page = await provider.getEvents({
      address: toHex(POOL_ADDRESS),
      from_block: { block_number: fromBlock },
      to_block: { block_number: toBlock },
      keys,
      chunk_size: 200,
      continuation_token: continuationToken,
    });
    events.push(...(page.events as unknown as RawEvent[]));
    continuationToken = page.continuation_token;
    pages += 1;
  } while (continuationToken !== undefined && pages < maxPages);
  return events;
}

/**
 * Fetches the pool's public activity over a recent block window and decodes
 * it into typed events. Block-number windowing only — no per-event block
 * timestamps are fetched, since every signal that needs "how long ago" works
 * off two probed reference blocks (see avgBlockTimeSeconds) rather than a
 * timestamp lookup per event. That keeps this cheap enough for a public,
 * rate-limited RPC endpoint called live from a browser.
 */
export async function fetchPoolWindow(
  provider: RpcProvider,
  windowBlocks: number = DEFAULT_WINDOW_BLOCKS,
): Promise<PoolWindow> {
  const latest = await provider.getBlockLatestAccepted();
  const latestBlock = latest.block_number;
  const fromBlock = Math.max(0, latestBlock - windowBlocks);

  const probeBlockNumber = Math.max(0, latestBlock - BLOCK_TIME_PROBE_BLOCKS);
  const [latestBlockInfo, probeBlockInfo] = await Promise.all([
    provider.getBlockWithTxHashes(latestBlock),
    provider.getBlockWithTxHashes(probeBlockNumber),
  ]);
  const blockDelta = latestBlock - probeBlockNumber;
  const avgBlockTimeSeconds =
    blockDelta > 0
      ? (latestBlockInfo.timestamp - probeBlockInfo.timestamp) / blockDelta
      : 2; // fallback if the chain hasn't produced enough blocks yet to probe

  const usdcTokenHex = toHex(USDC_TOKEN_ADDRESS);

  const [depositRaw, withdrawalRaw, encNoteRaw, openNoteRaw] = await Promise.all([
    fetchAllEvents(provider, fromBlock, latestBlock, [[DEPOSIT_SELECTOR], [], [usdcTokenHex]]),
    fetchAllEvents(provider, fromBlock, latestBlock, [[WITHDRAWAL_SELECTOR], [], [usdcTokenHex]]),
    fetchAllEvents(provider, fromBlock, latestBlock, [[ENC_NOTE_CREATED_SELECTOR]]),
    fetchAllEvents(provider, fromBlock, latestBlock, [[OPEN_NOTE_CREATED_SELECTOR]]),
  ]);

  const usdcDeposits: DepositEvent[] = depositRaw.map((e) => ({
    kind: "deposit",
    userAddr: BigInt(e.keys[1] ?? "0x0"),
    token: BigInt(e.keys[2] ?? "0x0"),
    amount: BigInt(e.data[0] ?? "0x0"),
    blockNumber: e.block_number,
    txHash: e.transaction_hash,
  }));

  const usdcWithdrawals: WithdrawalEvent[] = withdrawalRaw.map((e) => ({
    kind: "withdrawal",
    toAddr: BigInt(e.keys[1] ?? "0x0"),
    token: BigInt(e.keys[2] ?? "0x0"),
    // Withdrawal's data is [EncUserAddr (3 felts), amount] — amount is always last.
    amount: BigInt(e.data[e.data.length - 1] ?? "0x0"),
    blockNumber: e.block_number,
    txHash: e.transaction_hash,
  }));

  const noteCreations: NoteCreatedEvent[] = [...encNoteRaw, ...openNoteRaw].map((e) => ({
    kind: "note_created",
    blockNumber: e.block_number,
    txHash: e.transaction_hash,
  }));

  return {
    fromBlock,
    toBlock: latestBlock,
    latestBlock,
    avgBlockTimeSeconds,
    usdcDeposits,
    usdcWithdrawals,
    noteCreations,
  };
}
