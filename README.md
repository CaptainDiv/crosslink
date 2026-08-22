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

- [Linkability Meter](https://captaindiv.github.io/crosslink/) — scores a pending
  send against the pool's current public state.
- [Wallet API integration test](https://captaindiv.github.io/crosslink/wallet.html) —
  connect, shield, and private-transfer through a Starknet privacy wallet.
- [Side-by-side demo](https://captaindiv.github.io/crosslink/demo.html) — the same
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

## License

Apache-2.0.
