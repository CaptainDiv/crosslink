import type { DepositEvent, NoteCreatedEvent, PoolWindow, WithdrawalEvent } from "../src/types.ts";

const TOKEN = 0x33068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fbn;

function deposit(amount: bigint, blockNumber: number): DepositEvent {
  return { kind: "deposit", userAddr: 0x1n, token: TOKEN, amount, blockNumber, txHash: "0xdep" };
}

function withdrawal(amount: bigint, blockNumber: number): WithdrawalEvent {
  return { kind: "withdrawal", toAddr: 0x2n, token: TOKEN, amount, blockNumber, txHash: "0xwd" };
}

function noteCreated(blockNumber: number): NoteCreatedEvent {
  return { kind: "note_created", blockNumber, txHash: "0xnote" };
}

/** A window with a healthy, non-thin pool: plenty of similar-sized deposits and recent note activity. */
export function healthyWindow(): PoolWindow {
  const toBlock = 100_000;
  const fromBlock = 0;
  return {
    fromBlock,
    toBlock,
    latestBlock: toBlock,
    avgBlockTimeSeconds: 2,
    usdcDeposits: Array.from({ length: 20 }, (_, i) => deposit(1_000_000n + BigInt(i), toBlock - i * 10)),
    usdcWithdrawals: Array.from({ length: 20 }, (_, i) => withdrawal(1_000_000n + BigInt(i), toBlock - i * 10)),
    noteCreations: Array.from({ length: 30 }, (_, i) => noteCreated(toBlock - i * 5)),
  };
}

/** A window with almost no activity — the honest "thin pool" scenario. */
export function thinWindow(): PoolWindow {
  const toBlock = 100_000;
  const fromBlock = 0;
  return {
    fromBlock,
    toBlock,
    latestBlock: toBlock,
    avgBlockTimeSeconds: 2,
    usdcDeposits: [deposit(5_000_000n, toBlock - 5)],
    usdcWithdrawals: [withdrawal(5_000_000n, toBlock - 3)],
    noteCreations: [noteCreated(toBlock - 2)],
  };
}
