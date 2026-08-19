# Crosslink

**Unlinkable cross-chain payouts on STRK20.**

`starkware-libs/privacy-bridge` moves your own funds across chains.
Crosslink pays *someone else* — Alice funds a shielded balance, Bob receives
native USDC on his chain, and neither the public nor Bob can trace it back to her.

Also shipping a **Linkability Meter**: a read-only tool that scores a pending
payout on amount uniqueness, timing correlation and pool depth — and blocks the
send when privacy would be fake.

**Live: [captaindiv.github.io/crosslink](https://captaindiv.github.io/crosslink/)**
— reads the live mainnet pool directly via RPC, no wallet or backend involved.

Built for the STRK20 Private Sprint. Apache-2.0.

## Status
Linkability Meter live on mainnet (`packages/meter`, `apps/web`). Everything
else — derivation, corridor, anonymizer contract — pre-build. See `docs/PRD.md`.
