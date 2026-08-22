# Crosslink

Crosslink pays a third party in native USDC on their own chain from a shielded
Starknet balance, so the funding source and the payout can't be linked on-chain. A
Linkability Meter reads the live pool and blocks a send when the anonymity set is too
thin, the amount too distinctive, or the timing too tight for that unlinkability to
mean anything.

Built for the STRK20 Private Sprint. Not audited. Read [PRIVACY.md](./PRIVACY.md)
before trusting it with real funds.

## Live pages

All three read the live mainnet pool directly via RPC — no backend, no wallet
required except where noted.

- [Linkability Meter](https://crosslink-delta.vercel.app/) — scores a pending send
  against the pool's current public state.
- [Wallet API integration test](https://crosslink-delta.vercel.app/wallet.html) —
  connect, shield, and private-transfer through a Starknet privacy wallet.
- [Side-by-side demo](https://crosslink-delta.vercel.app/demo.html) — the same
  payment shown twice, privacy off vs privacy on.

## Mainnet transactions

Against the live pool at
[`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`](https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a):

| Tx | Voyager | What |
|---|---|---|
| Registration | [`0x216c69f3…d9cfd`](https://voyager.online/tx/0x216c69f39fdc5fb64db33ac5344cee138a693a34062c2075e3a943d6eed9cfd) | Viewing key set, bundled with a 1.0 USDC deposit |
| Shield | [`0x201a72f8…6e3e1`](https://voyager.online/tx/0x201a72f8ded88051c57e1e2dfee39811f392ba7a6e37e82d2252b95f5f6e3e1) | 1.37 USDC deposit |
| Private transfer | [`0x41211244…9de46`](https://voyager.online/tx/0x4121124483d1259124dc1f50b3a6e9771a07061dc80bfafd3e6a984fe19de46) | In-pool transfer, no public leg |

Same list, machine-readable, in [`strk20.json`](./strk20.json).

## Built vs roadmap

**Built:**
- Wallet-derived Starknet account, same wallet + message → same address across runs
  (`packages/core`)
- Linkability Meter — amount uniqueness, timing correlation, pool depth, channel
  freshness — live on mainnet (`packages/meter`, deployed pages above)
- Register → shield → private transfer exercised against the live pool, both through
  a privacy wallet's native UI and through the Wallet API (the three transactions
  above)
- Side-by-side demo contrasting a public transfer with a private one

**Roadmap:**
- `OutboundAnonymizer` Cairo contract for the outbound leg (`packages/anonymizer` is
  currently empty) — `scarb test` green and a Sepolia deploy are the gate before this
  moves to mainnet
- Full automated corridor: derive → CCTP burn/mint → shield → private transfer →
  withdraw → `OutboundAnonymizer` → CCTP burn → recipient gets native USDC on their
  own chain. Today the three mainnet transactions above were driven manually through
  a wallet, not chained by this corridor end to end.
- `sendIncognito()`, the single call a dapp would use to trigger the whole corridor

## Prior art

StarkWare's own `bridgeOutToWallet()` (`starkware-libs/privacy-bridge`) already
withdraws pool funds through an anonymizer contract and bridges them via CCTP to a
caller-chosen address — an unlinkable payout to someone else, not just the caller.
Crosslink does not invent that payout mechanism. What it adds is the Linkability
Meter: live measurement of whether a given payout's unlinkability is real or fake
given the pool's actual current state, and a refusal to send when it's fake.

## Integrate

When a protocol shows a user a privacy toggle, it is making a promise. This is how it
checks the promise is true before making it.

The same scoring the pages run is available as a hosted endpoint. No install, no key,
open CORS, call it from anywhere:

```bash
curl 'https://crosslink-delta.vercel.app/api/score?amount=247.50'
```

```jsonc
{
  "verdict": "thin_pool",
  "headline": "Privacy is weak right now.",
  "detail": "Only 3 deposit(s) in the window could explain this payout. The anonymity set is thin.",
  "signals": [ /* all five, each with status and the number behind it */ ],
  "poolWindow": { "fromBlock": 13593316, "toBlock": 13693316, "usdcDepositCount": 16, "…": "…" },
  "meta": { "fetchedAt": "2026-08-22T14:11:14.326Z", "ageSeconds": 0, "stale": false }
}
```

Five lines in front of your send button:

```js
const res = await fetch(`https://crosslink-delta.vercel.app/api/score?amount=${amount}`);
const { verdict, headline } = await res.json();
if (verdict !== "clear") {
  showWarning(headline); // don't promise privacy the pool can't currently deliver
}
```

| Query | |
|---|---|
| `amount` | required, USDC, e.g. `247.50` |
| `fundedAt` | optional, unix seconds — supply it and the timing-correlation signal is evaluated instead of skipped |

`verdict` is one of `clear`, `thin_pool`, `distinctive_amount`, `too_soon`. Bad input
is a `400`; if the pool can't be read at all it's a `503`. If the RPC fails but a
recent window is cached, you get that window with `meta.stale: true` — it is always
labelled, never passed off as current.

Prefer it in-process? The package is the same code:

```bash
npm install @crosslink/meter starknet
```

```js
import { createProvider, fetchPoolWindow, scorePendingSend, parseUsdc } from "@crosslink/meter";

const window = await fetchPoolWindow(createProvider());   // ~12s, cache it
const result = scorePendingSend(window, { amount: parseUsdc("247.50") });
```

`scorePendingSend` is pure and does no I/O, so fetch the window once and score as many
candidate amounts against it as you like. See
[`packages/meter/README.md`](./packages/meter/README.md).

Honest about what this endpoint is: one hackathon-scale function reading a public
Starknet RPC that is sometimes slow and sometimes fails. Responses are edge-cached for
a minute. If you need an availability guarantee, use the package directly or self-host
the function — it is forty lines of glue around the same public scoring code.

## Wallet API registration gap

`strk20InvokeTransaction` / `strk20PrepareInvoke` return `NOT_REGISTERED` for an
account with no on-chain viewing key, on both a plain deposit and a dry run — this
includes the starter kit's own reference implementation, so it isn't calldata we got
wrong. Registration is not exposed through the documented `STRK20_ACTION` surface.

Workaround: bootstrap registration through the wallet's own native Shield UI (Ready)
rather than the dapp. On-chain that resolves to a paymaster-relayed SNIP-9
`execute_from_outside_v2` call bundling `ViewingKeySet` and a `Deposit` atomically —
a mechanism third-party dapps can't reach directly. After that first native-UI
registration, `strk20InvokeTransaction` works normally for shield and transfer
against the now-registered account.

## Wallet detection: a real defect, not a load race

The Wallet API test page checked for a browser wallet extension exactly once,
synchronously, right after the page loaded. On both of our deployed origins this
came back with zero wallets even with Ready installed, unlocked, and permitted on
all sites — confirmed well past any plausible content-script injection delay, so it
wasn't a matter of losing a narrow race.

`@starknet-io/get-starknet-discovery`'s wallet-standard discovery is event-driven,
but nothing on the page ever listened for a wallet that registers after that first
check. Its fallback path for wallets that only ever expose the legacy
`window.starknet`-style object (rather than dispatching a wallet-standard
registration event) scans `window` exactly once at the same moment and is never
re-triggered either. Either path can miss a real, installed wallet depending on
exactly when its content script runs relative to ours — an order neither side
guarantees.

The page now retries both checks on a backoff (500ms, 1.5s, 3s, 6s) instead of
trusting a single synchronous read, only shows "no wallet detected" once every retry
has failed, and logs `window.starknet` plus any matching `window` keys directly so
wallet-standard registration and legacy injection can be told apart from the
console. We have not yet pinned down which mechanism Ready specifically uses — the
retry logic is a fix for the underlying defect (a synchronous check against an
inherently async announcement) regardless of that answer.

## License

Apache-2.0. Full text in [`LICENSE`](./LICENSE).
