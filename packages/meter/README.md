# @crosslink/meter

Scores a pending STRK20 private transfer against the live Starknet privacy pool, and
tells you when the privacy would be fake.

A private transfer is only as private as its anonymity set. If three deposits in the
recent window could explain your payout, the cryptography worked and the privacy
didn't. This package reads the pool's public event stream and says so.

Read-only. No wallet, no keys, no proving, no transaction is ever submitted.

## Install

```bash
npm install @crosslink/meter starknet
```

`starknet` is a peer dependency because `createProvider()` and `fetchPoolWindow()`
expose its `RpcProvider` type — a duplicate copy in your tree would break type
compatibility. npm 7+ installs peers automatically.

## Usage

```ts
import {
  createProvider,
  fetchPoolWindow,
  scorePendingSend,
  parseUsdc,
} from "@crosslink/meter";

const window = await fetchPoolWindow(createProvider());
const result = scorePendingSend(window, { amount: parseUsdc("247.50") });

console.log(result.verdict); // "clear" | "thin_pool" | "distinctive_amount" | "too_soon"
console.log(result.headline);

for (const signal of result.signals) {
  console.log(signal.status, signal.id, signal.headline);
}
```

Pass `fundedAt` (unix seconds) to enable the timing signal. Omit it and that signal
reports `not_evaluated` rather than guessing:

```ts
scorePendingSend(window, { amount: parseUsdc("247.50"), fundedAt: 1756900000 });
```

`fetchPoolWindow()` scans ~100k blocks of pool events and takes roughly ten seconds
against a public RPC. Fetch the window once and score many candidate amounts against
it — `scorePendingSend` is a pure function and does no I/O.

## What it measures

Five signals, each `clear`, `flagged`, or `not_evaluated`:

| Signal | What it reads |
|---|---|
| `plausible_set` | How many in-window deposits are large enough to explain this payout |
| `amount_uniqueness` | How many public deposits/withdrawals sit within 1% of this amount |
| `timing_correlation` | Whether the gap since funding is long enough to break the link |
| `channel_freshness` | Pool-wide note-creation activity, as a proxy for channel-opening cover |
| `user_linkage_warning` | Whether enough of the above are flagged together to form a pattern |

The verdict is the first flagged signal in precedence order (timing, then plausible
set, then amount), or `clear` when none are flagged.

## What it does not do

- It does not make anything private. It measures the pool you are about to use.
- It scores **on-chain** linkability only. Off-chain correlation, network-level
  observation, and recipient-side disclosure are all invisible to it.
- `channel_freshness` is a pool-wide proxy, not a read of your specific channel —
  that would need a connected wallet.
- Amounts are public regardless. This is identity privacy, not amount privacy.

## Hosted API

If you don't want the dependency, the same scoring runs at a hosted endpoint:

```bash
curl 'https://crosslink-delta.vercel.app/api/score?amount=247.50'
```

## Types

`Candidate`, `MeterResult`, `SignalResult`, `SignalId`, `SignalStatus`, `Verdict`,
`PoolWindow`, `DepositEvent`, `WithdrawalEvent`, `NoteCreatedEvent`, `PoolEvent` are
all exported, along with the tuning constants (`PLAUSIBLE_SET_THIN_THRESHOLD`,
`MATURITY_BLOCKS`, `POOL_ADDRESS`, `USDC_TOKEN_ADDRESS`, and the rest).

Note that `starknet`'s own type declarations reference DOM globals (`Response`,
`WebSocket`), so your `tsconfig` needs `lib` including `DOM`, or `@types/node`.

## License

Apache-2.0. Built for the STRK20 Private Sprint. Not audited.
