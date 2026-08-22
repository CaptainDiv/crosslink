# Crosslink — Agent Instructions

Unlinkable cross-chain payouts on STRK20. STRK20 Private Sprint. Deadline 31 Aug 2026, judged 4 Sep.

Full spec: `docs/PRD.md`. **Read once at session start. Do not re-read mid-session.**

---

## What we are building

Alice funds a shielded balance on Starknet from her existing chain. Later she pays Bob, who receives native USDC on his chain and needs nothing but an address. The in-pool leg is a real STRK20 private transfer, so nobody — including Bob — can link Alice's funding to Bob's payout.

A Linkability Meter scores each pending send and **blocks it when privacy would be fake**.

**Positioning:** privacy-bridge moves your own money across chains. Crosslink pays someone else.

---

## Hackathon mechanics — non-negotiable

The repository IS the submission. It is scraped every 30 minutes; pushes, stack, contracts and demo are read from it.

- **Commit small and often.** Steady visible progress is part of the score. Never batch a day's work into one push.
- **Three mainnet transactions minimum** against the live pool at
  `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`
- **`strk20.json` at repo root**, filled in as things come to exist:
  ```json
  { "transactions": [], "contracts": [], "demo_video": "", "demo_url": "" }
  ```
  Update it in the same commit as the event it records. Never reconstruct it later.
- `demo_url` is auto-detected from the repo Website field, GitHub Pages, or the last Vercel/Netlify deploy. Only set it manually if undetected.
- Scoring: integration depth 30%, mainnet product 30%, innovation 25%, docs 15%.

### Environment
```
STARKNET_RPC=https://starknet-mainnet.g.alchemy.com/v2/<KEY>   # CHAIN_ID SN_MAIN
```
Keep the Alchemy key in an env var. **Never commit it.** `.env` is gitignored.

### Skills
`npx skills add welttowelt/strk20-skills` — strk20-privacy (route selection), strk20-privacy-sdk (our route, we hold derived keys), strk20-anonymizer-contracts (Phase 3), strk20-wallet-api (fallback only, if derivation fails).

Each bundles upstream pages verbatim. **Open the reference rather than recalling it.**

### Context sources
- Docs: fetch `https://strk20-by-example.org/llms-full.txt` — do not parse individual pages
- Starter kit: `Akashneelesh/strk20-starter-kit`
- Examples and helper contracts: `Akashneelesh/awesome-strk20`

---

## Hard constraints — do not rediscover these

### Versions
- `starknet@^10.4.0` from the npm **`next`** tag. `latest` is 10.0.x and has none of the STRK20 API.
- Node **≥ 24** (`ohttp-ts` / WebCrypto).
- Privacy SDK may 404 on npmjs — fall back to GitHub Packages:
  ```
  gh auth refresh -h github.com -s read:packages
  npm config set @starkware-libs:registry https://npm.pkg.github.com
  npm config set '//npm.pkg.github.com/:_authToken' "$(gh auth token)"
  ```
- Scarb ≥ 2.14.0, snforge ≥ 0.54.1.

### Pool semantics
- **Notes mature 10 blocks after creation.** Cannot shield and send in one flow. Product constraint, not a bug.
- **Always prove at `currentBlock - 10`.** Re-fetch `provingBlockId` after every `waitForTransaction`.
- **At most one external invoke per pool transaction.** The outbound anonymizer gets the only slot.
- **`approve` and deposit cannot share a transaction** — `apply_actions` is reentrancy-guarded.
- **Viewing key must be `BigInt`.** A hex string compiles fine and silently derives wrong channel keys.
- **`tip: 0n` mandatory** on v3 transactions, else `Cannot mix BigInt and other types`.
- **Omit `proofDetails` entirely when `proofFacts` is empty** — `proofFacts: []` serializes an invalid transaction.
- After a failed submission, call `invalidateProofNonceCache()` before retrying.
- Proof generation ~29s. Build UI around it.

### Registration (Wallet API route)
- **Registration cannot be done through the wallet API.** `strk20InvokeTransaction`/`strk20PrepareInvoke` return `NOT_REGISTERED` for an account with no on-chain viewing key, on both a plain deposit and a dry run. The starter kit's own reference implementation (`Akashneelesh/strk20-starter-kit`) does the identical `[{type:"deposit",...}]` call and has the same gap — this isn't a calldata bug on our side.
- **Bootstrap via the wallet's own native Shield UI**, not our dapp. Verified on-chain: a real registration transaction is a relayer-submitted SNIP-9 `execute_from_outside_v2` call, paymaster-funded, that bundles `ViewingKeySet` and a `Deposit` atomically — a mechanism the documented `STRK20_ACTION` surface never exposes to third-party dapps.
- **After that first native-UI registration, the wallet API works normally** — `strk20InvokeTransaction` for shield/transfer against an already-registered account behaves exactly as documented.

### Screening
Every deposit is screened by FPI and verified on-chain. Self-hosted proving does not bypass it. A structurally valid deposit that reverts is screening first, everything else second.

### CCTP
V2 only — V1 phase-out began 31 July 2026. Verify the specific route, not per-chain flags.

---

## Architecture

```
Alice's wallet → sign (no gas) → derived Starknet account
  → CCTP burn → mint → shield (autoRegister: true)
  → [10-block maturity]
  → private transfer (no public leg)
  → withdraw → OutboundAnonymizer → CCTP burn → Bob receives native USDC
```

Route: Privacy SDK direct (we control derived keys) + anonymizer contract for the outbound leg.

---

## Scope discipline

**In:** USDC only. One mainnet corridor. Invisible account derivation. Linkability Meter. `sendIncognito()` + reference dapp.

**Out — do not build, do not suggest:**
- **PayoutEscrow / claim links.** Cut deliberately — Alice specifies Bob's destination at send time, so Bob needs no Starknet presence.
- Non-USDC assets, private swaps mid-route, private sub-accounts, CCTP V1 chains, general-purpose integrator SDK.

If a task seems to need something on this list, **stop and ask**.

---

## Build order

| Phase | Work | Gate |
|---|---|---|
| 0 | Derivation spike | Same wallet + message → same address, across runs |
| 1 | SDK round-trip, Sepolia | register → shield → private transfer → withdraw |
| 2 | Linkability Meter → **mainnet** | Public URL, live pool data |
| 3 | `OutboundAnonymizer` | `scarb test` green, Sepolia deploy |
| 4 | Full corridor, Sepolia | End-to-end payout, meter in the loop |
| 5 | Mainnet | ≥3 pool transactions, all in `strk20.json` |
| 6 | Submission | README, PRIVACY.md, 3-min video, upstream PR |

**Before writing any Cairo:** read `OutboundAnonymizer` in `starkware-libs/privacy-bridge`. It may already accept arbitrary recipients, collapsing Phase 3 to config. Read that one file — do not clone or index the repo.

---

## Session discipline

- **One phase per session.** `/clear` between phases.
- Never read `docs/PRD.md` more than once per session.
- Never load a full external repo into context. Fetch specific files by path.
- Use subagents for exploration, main thread for edits.
- Prefer `strk20PrepareInvoke` (dry run) over live transactions when debugging calldata.
- When a constraint above answers a question, cite it and move on.

---

## Commit discipline

After completing any working unit — a passing test, a deployed contract, a
fixed bug — commit AND push immediately. Never batch. The repository is scraped
every 30 minutes and visible progress is part of the score.

Update strk20.json in the same commit as any transaction or deployment.

---

## Code conventions

- TypeScript strict. No `any`.
- Amounts are `bigint` in smallest units. Never `number`.
- Token addresses as `bigint` when keying maps — string keys always miss.
- Secrets never logged, persisted, or written to disk. Only the read-only viewing key may persist.
- Cairo: `privacy_invoke` returns exactly `Span<OpenNoteDeposit>`. Measure output by balance delta, never trust an external protocol's return. Approve the pool, don't transfer to it.

---

## Honesty rules

Credibility rests on not overclaiming. Applies to code comments, README, and UI copy.

- Never "fully private" or "untraceable."
- Deposits, withdrawals, timing and open-note amounts are **public**. Say so.
- The meter reports weak privacy when privacy is weak — including our own thin pool.
- Never claim a corridor works without a mainnet hash to prove it.
