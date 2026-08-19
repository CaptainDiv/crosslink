# Crosslink — Product Requirements Document

**Unlinkable cross-chain payouts on STRK20**

| | |
|---|---|
| Version | 0.1 |
| Date | 18 August 2026 |
| Event | Starknet STRK20 Hackathon (14–31 August 2026) |
| Days remaining | 13 |
| Status | Scope locked, pre-build |
| License | Apache-2.0 |

---

## 1. Summary

Crosslink lets someone pay another person across chains without the payment being traceable — by the public, or by the recipient.

Alice funds a shielded balance on Starknet from whatever chain she already uses. Later, she pays Bob, who receives native USDC on his chain and needs nothing but an address. The in-pool leg is a real STRK20 private transfer, so no observer can join Alice's funding to Bob's payout, and Bob never learns Alice's source wallet.

Every privacy product claims unlinkability. Crosslink measures it — and blocks the send when it would be a lie.

**Positioning line:** *Starknet's privacy bridge moves your own money across chains. Crosslink pays someone else.*

---

## 2. Problem

Cross-chain payments are permanently public. If a DAO pays a contractor, a fund pays a vendor, or a foundation pays a grantee, three things leak by default:

- **The relationship** — anyone can see A paid B.
- **The treasury** — the payee (and everyone else) sees the payer's full balance and history.
- **The pattern** — payroll cadence, headcount, vendor terms, all inferable.

Existing privacy tools solve one chain at a time, or move only your own funds, or require trusting an operator who sees both ends. None of them protect the payer *from the payee*.

---

## 3. Competitive landscape

| Product | What it does | Gap Crosslink fills |
|---|---|---|
| **starkware-libs/privacy-bridge** | First-party. Moves USDC between EVM wallets and the STRK20 pool over CCTP. Every leg terminates at the user's own wallet. | Self-custody funding rail, not a payments rail. Never performs a private transfer between two people. |
| **NEAR Confidential Intents** | Live, GA. TEE-based private shard, no client-side proving. ~$30M daily confidential TVL. | Hardware + permissioned validator trust. Explicitly *individual encryption, not pooled obfuscation* — so there is no anonymity set to measure. |
| **Union Private Bridging** | ZK cross-chain privacy whitepaper (Nov 2025). | A designated attestor signs a commitment linking tokens to a beneficiary — a trusted party sees both ends. EVM-only. Not shipped. |
| **SIP (Shielded Intents Protocol)** | Pitches a one-toggle shield for sender/amount/recipient. | Core components marked *Planned* / *Future*. README, not product. |
| **Houdini Swap** | $1.5B+ private cross-chain volume. | Custodial. Operator sees both ends and can be subpoenaed. |
| **Railgun / Aztec** | Mature shielded pools. | Single-ecosystem, EVM-only. No cross-chain settlement. |
| **RocketX Private Swaps** | Routes so no single partner sees both ends. | Partner trust, not cryptography. |

**What nobody does:** measure whether a *specific pending* payment is actually unlinkable given amount, timing, and current pool state — and refuse to send when it isn't.

NEAR's traction (42% of near.com volume chose confidential mode within weeks) validates the demand thesis. It does not occupy this position.

---

## 4. Users

**Primary — the payer.** DAO operators, small funds, grant programmes, agencies paying contractors. Technical enough to hold a wallet, not technical enough to reason about anonymity sets. Needs the tool to think for them.

**Secondary — the payee.** Contractors, grantees, bounty recipients. Must do nothing beyond providing an address on a chain they already use.

**Tertiary — integrators.** Other Starknet teams who want a private-send path without building the privacy stack. Served by the package, not courted during the hackathon.

### Use cases

1. Contractor payroll across chains without exposing treasury size or headcount.
2. Grant disbursement where recipients shouldn't see each other's amounts or the funder's balance.
3. Treasury vendor payments without leaking negotiated rates.
4. Any payout where the payer must not be traceable *by the payee*.

---

## 5. Scope

### In scope (MVP)

- USDC only.
- One mainnet corridor working end to end. Remaining CCTP V2 corridors present as verified configuration, not claimed as tested.
- Invisible Starknet account derivation from the payer's existing source-chain wallet signature.
- Shield (fund incognito balance) → private transfer → CCTP outbound to payee's chain.
- Linkability Meter, read-only, live on mainnet.
- `sendIncognito()` package function + reference dapp.
- Apache-2.0, README, PRIVACY.md.

### Explicitly out of scope

| Cut | Why |
|---|---|
| **PayoutEscrow / claim links** | Solved a problem the current design removes — Alice specifies Bob's destination address at send time, so Bob needs no Starknet presence. Escrow also caused the one-invoke collision and leaked matching amounts on both legs. Roadmap item for recipient-side shielding. |
| **Non-USDC assets** | CCTP constraint, not a STRK20 one. Post-MVP. |
| **Private swaps mid-route** | AVNU already ships this; wiring it is post-MVP polish. |
| **Private sub-accounts** | Wallet API route not exposed by `@starknet-io/types-js` 0.10.3 or starknet.js. SDK route only, requires holding keys. Not worth the custody surface for MVP. |
| **CCTP V1 chains (Sui, Aptos, Noble)** | V1 phase-out began 31 July 2026. V2-only. |
| **General-purpose integrator SDK** | Rubric pays for a working product, not API surface area. One package, one consumer. |

---

## 6. User flows

### 6.1 Payer onboarding (one-time, invisible)

1. Alice connects her existing wallet (Phantom, MetaMask, etc.).
2. She signs one versioned message: `Crosslink account derivation — v1`. No gas, no transaction.
3. The signature seeds a Starknet private key and a viewing key. Nothing is persisted except, optionally, the read-only viewing key.
4. Her Starknet address is computed counterfactually and shown. No contract deployed yet.

She never sees the word "Starknet," a seed phrase, or an STRK balance.

### 6.2 Funding (deliberate, ahead of time)

1. Alice picks an amount to move into her incognito balance.
2. USDC moves to Starknet via CCTP.
3. First real action deploys her account, registers her viewing key (`autoRegister: true`), and shields — one transaction, paymaster-sponsored.
4. Meter shows: *Ready in ~20 seconds. For best privacy, send at least a few minutes after funding.*

### 6.3 Sending (instant, repeatable)

1. Amount, destination chain, destination address.
2. Meter evaluates and either clears the send or blocks it with a reason.
3. On send: private transfer inside the pool → withdraw to outbound anonymizer → CCTP burn to destination.

### 6.4 Receiving

Bob receives native USDC on his chain. No wallet setup, no claim, no Starknet. He cannot determine who paid him.

---

## 7. Architecture

```
Source chain            Starknet                        Destination chain
─────────────           ────────────────────────        ─────────────────
Alice's wallet
  │ sign (no gas)
  ▼
derived SN account
  │
  │ CCTP burn ──────►  mint ──► shield (autoRegister)
                         │
                         │  ← 10-block maturity (decorrelation window)
                         ▼
                       private transfer  (no public leg)
                         │
                         ▼
                       withdraw → OutboundAnonymizer
                                      │ privacy_invoke
                                      ▼
                                  CCTP burn ─────────►  Bob receives
                                                        native USDC
```

**Components to build**

| Component | Language | Notes |
|---|---|---|
| `OutboundAnonymizer` | Cairo | `privacy_invoke` adapter: receives withdrawn USDC, calls CCTP `depositForBurn` toward destination domain, returns `Span<OpenNoteDeposit>`. Adapt from privacy-bridge's outbound contract rather than writing fresh. |
| Key derivation | TypeScript | Signature → Starknet key + viewing key. Versioned message. |
| Linkability Meter | TypeScript + indexer | Read-only scorer. See §8. |
| `sendIncognito()` | TypeScript | Orchestrates capability check → meter → transfer → outbound. |
| Reference dapp | Next.js | Two surfaces: Balance, Send. |

**Integration route:** Starknet Wallet API via `starknet.js` for wallet-held flows; Privacy SDK direct where the app controls keys (derived accounts). Anonymizer contract for the outbound leg.

---

## 8. The Linkability Meter

The differentiator. Read-only, ships to mainnet first, usable by any other STRK20 team.

### Inputs (all public pool artifacts)

- Deposit events — depositor, token, amount, timestamp
- Withdrawal events — recipient, token, amount
- Registration events
- Published nullifiers
- Open notes (token and filled amount are plaintext by design)

### Signals

| Signal | Question | Source of the risk |
|---|---|---|
| **Amount uniqueness** | Is this amount distinctive in the current window? | Docs: *recognizable amounts weaken the anonymity set* |
| **Timing correlation** | How close is this payout to the payer's funding leg? | Docs: *rapid in-and-out sequences between deposit and withdrawal* |
| **Channel freshness** | Was a channel opened in tight succession with this transfer? | Docs: *channel-open linkability* |
| **Plausible-set size** | How many deposits could explain this withdrawal in-window? | Anonymity-set size |
| **SDK warnings** | Does `ExecuteResult.warnings` flag `USER_LINKAGE`? | Surfaced by the SDK pre-submit |

### Verdicts

| State | UI |
|---|---|
| Clear | *Unlinkable. 340 deposits could explain this payout.* |
| Distinctive amount | *1,337.42 is unique in today's pool. Round to 1,300 or split.* |
| Too soon | *You funded 40 seconds ago. Wait 5 minutes.* |
| No shielded balance | Send disabled: *Fund first — shielding now would leak the link.* |
| Thin pool | *Only 4 deposits could explain this. Privacy is weak right now.* |

The last two rows are the product. Everything else in the market would send anyway and quietly deliver nothing.

---

## 9. Privacy model — stated honestly

Goes in `PRIVACY.md`. Overclaiming here is the fastest way to lose credibility with these judges.

### Hidden

- The link between Alice's funding and Bob's payout
- Sender, receiver, amount, token, and spent notes on the in-pool leg
- Alice's identity from Bob
- Alice's total shielded balance

### Visible

- That Alice funded a privacy pool, with amount and timestamp
- That the pool paid an anonymizer contract, with amount
- That Bob received USDC on his chain
- Timing of all public legs
- Open-note amounts (plaintext by design)

### Known weaknesses

- **Amount matching.** Distinctive amounts across the two public legs can be correlated. Mitigated, not eliminated, by the meter.
- **Timing correlation.** Same. The 10-block maturity helps; user discipline helps more.
- **Thin pool.** Privacy is a function of the anonymity set. Early on, it is weak — and the meter says so rather than hiding it.
- **Derived-key dependency.** Losing the source wallet loses the derived Starknet account. Export must be offered.
- **Paymaster visibility.** The paymaster sees the transaction it relays.

---

## 10. Compliance

Not a bolt-on. Three protocol-level mechanisms already exist and should be documented rather than rebuilt:

- **Deposit screening.** FPI screens every shielding address and signs each deposit; the pool verifies the signature on-chain. Enforced in-protocol since v0.14.3 — self-hosted proving is not a route around it.
- **Escrowed viewing key.** At registration, each user's private viewing key is encrypted to the auditor's public key. Threshold keys supported.
- **Selective disclosure.** The auditor decrypts only keys subject to lawful request. No bulk-surveillance mode. Auditors can view, never spend.

**Framing:** confidentiality from public surveillance, with a disclosure path — enforced by the protocol, not promised by us.

---

## 11. Technical constraints

Every one of these has bitten someone. Front-load them.

| Constraint | Consequence |
|---|---|
| `starknet@^10.4.0` from the npm `next` tag | `latest` is 10.0.x and has none of the STRK20 API |
| Privacy SDK may 404 on npm | Published to GitHub Packages; needs a token even for public packages |
| Node ≥ 24 | `ohttp-ts` dependency needs modern WebCrypto |
| Notes mature 10 blocks after creation | Cannot shield and send in one flow. Design around it. |
| Prove at `currentBlock - 10` | Maturity, reorg buffer, and consistent discovery state |
| Proof generation ~29s | Set UI expectations; show progress |
| At most one external invoke per pool transaction | Outbound anonymizer gets the only slot |
| Viewing key must be `BigInt` | A hex string silently derives wrong channel keys |
| `tip: 0n` mandatory on v3 transactions | Otherwise: `Cannot mix BigInt and other types` |
| Omit `proofDetails` when empty | `proofFacts: []` serializes an invalid transaction |
| `approve` and deposit cannot share a transaction | Pool's `apply_actions` is reentrancy-guarded |
| Withdrawal exposes recipient, token, amount | This is the leak the meter scores |

---

## 12. Success criteria

Mapped to the published rubric.

| Weight | Criterion | Target |
|---|---|---|
| 30% | STRK20 integration depth | Shielded balances, private transfers, a deployed anonymizer contract, Privacy SDK, and paymaster — five of the five named surfaces |
| 30% | Working mainnet product | One corridor, real payer, real payee, real USDC, verifiable transaction hashes in the README. Meter live on mainnet by day 5. |
| 25% | Innovation | Payer-protected-from-payee cross-chain payouts, plus the first tool that measures unlinkability rather than asserting it |
| 15% | Docs & open source | Apache-2.0, runnable README, honest PRIVACY.md, upstream PR to `starkware-libs/privacy-bridge` |

**Minimum viable submission:** one mainnet payout, meter live, README with verifiable hashes. Everything else is upside.

---

## 13. Plan — 13 days

| Days | Milestone | Done when |
|---|---|---|
| 1 | Derivation spike | Phantom signature produces a stable Starknet address across sessions and wallets |
| 1–3 | SDK round-trip on Sepolia | register → shield → private transfer → withdraw, working |
| 4–5 | **Linkability Meter to mainnet** | Public URL, scoring live pool data. First shipped artifact. |
| 6–8 | `OutboundAnonymizer` | Adapted from privacy-bridge, `scarb test` green, deployed to Sepolia |
| 9–10 | Full corridor on Sepolia | End-to-end payout with meter in the loop |
| 11–12 | **Mainnet** | Small real amounts, every hash captured |
| 13 | Submission | README, PRIVACY.md, ≤3-min demo video, upstream PR |

**Day-1 spike is load-bearing.** If signature derivation is unstable, the invisible-onboarding story collapses and the flow needs an explicit Starknet wallet. Find out immediately.

**Ship the meter before the contract.** It de-risks the heaviest criterion with the least dangerous code.

---

## 14. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Signature derivation unstable across wallets | High | Day-1 spike; fall back to explicit Starknet wallet connect |
| CCTP outbound from Starknet not straightforward | High | Read privacy-bridge's `OutboundAnonymizer` before writing any Cairo; it is the reference |
| Proving latency makes UX feel broken | Medium | Progress UI; frame funding as deliberate and pre-planned |
| Thin mainnet pool means weak real privacy | Medium | The meter reports it honestly — turns a weakness into the differentiator |
| Deposit screening rejects a test address | Medium | Test screening early with the intended funding address |
| Judged as duplicating privacy-bridge | Medium | Lead every artifact with the distinction; contribute upstream |
| Mainnet costs real money | Low | Sub-$0.20 Starknet transactions; keep amounts small |

---

## 15. Post-hackathon roadmap

1. **Recipient-side shielding** — `PayoutEscrow` returns, letting the payee keep funds shielded rather than cashing out.
2. **More corridors** — configuration, not code.
3. **More assets** — beyond the CCTP/USDC constraint.
4. **Private swaps mid-route** — send any shielded asset, receive any asset, via AVNU's deployed executor.
5. **`sendIncognito()` as public infrastructure** — after the reference dapp proves it.
6. **Meter as a standalone public good** — usable by any STRK20 team.

Grant path: Starknet Foundation seed grants up to $25K for winners; Proof of Privacy incubator targets teams with a working concept.

---

## 16. Open questions

1. Does privacy-bridge's `OutboundAnonymizer` already support arbitrary destination recipients, or only the user's own address? **Determines whether the core contract is adaptation or new work.**
2. Is third-party cross-chain payout on the privacy-bridge roadmap? (Asked; awaiting reply.)
3. Do Phantom, Solflare and Backpack produce identical signatures for a fixed message?
4. What is the current mainnet pool depth? Sets the honest baseline for meter verdicts.
5. Can the paymaster sponsor a first transaction for a counterfactual, undeployed account?

---

*Questions 1 and 3 gate the build. Answer both on day one.*
