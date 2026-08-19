# Phase 0 — Derivation findings

Goal: prove that a Solana wallet signature over a fixed message
deterministically yields the same Starknet account address across separate
processes. This is the gate for invisible onboarding (PRD §6.1). If it
failed, the product needs the explicit Starknet-wallet-connect fallback in
PRD §14.

**The gate passes.** Full pipeline verified end-to-end: message → ed25519
signature → HKDF → grindKey → Stark public key → counterfactual address,
against a class hash confirmed live on Starknet mainnet.

---

## Does it work? Is it stable?

Yes, and stability is structural rather than incidental. Ed25519 signing is
deterministic by construction — RFC 8032 derives the per-signature nonce
from the secret key and the message, with no external randomness — so a
given Solana account signing a fixed message byte string produces exactly
one signature, forever, in any spec-correct implementation. That signature
feeds a pinned HKDF + grindKey pipeline (`packages/core/src/derive.ts`) to a
Stark keypair and a counterfactual address (`address.ts`). None of those
steps consult external state, so determinism is a property of the scheme,
not of wallet goodwill or of anything we had to engineer.

**Verified, not assumed:**

- `packages/core/scripts/determinism.mts` — the literal gate — spawned two
  cold `node` processes, each independently deriving from the same
  synthetic ed25519 key over `DERIVATION_MESSAGE_BYTES`. Both produced
  `0x77cdc2084c15fdda6248030ed78f40a832d482d23c4afb1ad8472cdabf7f49a`. MATCH.
- 19 unit tests pass (`npm test -w @crosslink/core`), including a golden
  vector locking the whole pipeline to one fixed key and a check that the
  pre-Phase-0 PRD message string derives a different address.
- `ACCOUNT_CLASS_HASH` (OpenZeppelin Account v1.0.0,
  `0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564`) is
  confirmed **DECLARED on Starknet mainnet** via a live
  `provider.getClassByHash()` call (`scripts/verify-class-hash.mts`),
  reporting entry points `CONSTRUCTOR, EXTERNAL, L1_HANDLER`. Sourced from
  Starknet Foundry's `sncast`
  (`crates/sncast/src/helpers/constants.rs`, `OZ_CLASS_HASH`) — an actively
  maintained tool that deploys real accounts against this exact hash today,
  not a value we picked and hoped was right.
- The real-wallet harness (`packages/core/harness/`) bundles and serves
  correctly; it was not exercised against live Phantom/Solflare signatures
  in this session — no headless browser or wallet extension is available in
  this environment. **Open**, not claimed: an operator with those
  extensions installed should run `npm run harness -w @crosslink/core` and
  confirm MATCH before Phase 0 is fully closed out.

---

## What breaks it

**Derivation paths.** Phantom defaults to `m/44'/501'/0'/0'`, Solflare to
`m/44'/501'/0'`. The same seed phrase reaches a different Solana account by
default in each wallet, hence a different Starknet address and an
apparently vanished balance. This is not a bug — the harness's comparison
panel explicitly labels a same-signature-different-pubkey result as
"expected, harmless" and instructs the operator to point both wallets at
the same Solana account before treating a mismatch as real.

**Hardware wallets.** Ledger's Solana app signs Anza `OffchainMessage`-framed
payloads, not raw message bytes. Different bytes in means a different
signature and a different derived account. A Ledger user signing through
the standard flow cannot reach the same account a hot wallet would derive
for the identical logical message — this is a real gap, not a corner case,
given how common hardware wallets are for anyone holding meaningful funds.

**MPC / smart-contract wallets.** Threshold ed25519 signers are not
obliged to produce a deterministic signature for a given message (that
guarantee is a property of single-key RFC 8032 signing, not of every
protocol built on top of ed25519 verification). Wallets without a
`signMessage` method can't participate in this flow at all.

**The message string.** Any byte-level change relocates every derived
address, by design — this is the entire point of a KDF. Pinned by the
byte-length, SHA-256, and legacy-string tests in
`packages/core/test/message.test.ts` and `address.test.ts`.

**The account class hash.** It's a direct input to
`calculateContractAddressFromHash`. If OpenZeppelin ever ships a v1.0.0
patch that changes bytecode (unlikely for a patch, but not impossible) and
declares a new class under the same *logical* version, the pinned hash in
`constants.ts` would silently stop matching what a wallet or tooling
expects. It's documented in that file as protocol, not configuration, and
`verify-class-hash.mts` exists precisely to catch drift before it costs
anyone a stuck deposit.

---

## Why the message changed — signature phishing

The original PRD §6.1 string (`Crosslink account derivation — v1`) was fixed
and public. Any site could construct a prompt asking a user to sign that
exact string, and the resulting signature would seed the same spending key
Crosslink would derive — because the derivation has no notion of which site
requested the signature. Binding the origin
(`domain: crosslink.app`, see the amended string in PRD §6.1) does **not**
close this vector: no wallet enforces that a `signMessage` request's content
matches its origin, so a malicious site can still request these exact
bytes. What it does is narrow the failure mode from "any site can silently
reuse a generic derivation string" to "a phishing site has to display a
domain line that visibly contradicts its own URL" — legible to a user who
reads the prompt, not cryptographically enforced. The honest fix is
SIWS-style wallet-enforced origin binding, which does not exist in the
current signMessage contract for Solana wallets; that's a named Phase 1
follow-up, not something this phase claims to have solved.

---

## PRD §14 fallback — does the spike clear it?

PRD §14 lists explicit Starknet wallet connect as the fallback if signature
derivation proves unstable across wallets. **This spike clears the gate for
the core case**: same wallet, same account, fixed message, deterministic
address — proven by the cross-process spike and the golden-vector test.

The fallback stays relevant for the populations this spike does not cover
and cannot make deterministic by better engineering: Ledger users (different
signed bytes by construction) and MPC/smart-contract wallet users (no
determinism guarantee, or no `signMessage` at all). Those users need
explicit Starknet wallet connect regardless of anything Crosslink does on
the derivation side. This is a scope boundary to carry into Phase 1, not a
gap in Phase 0's result.
