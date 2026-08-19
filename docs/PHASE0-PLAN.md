# Phase 0 — Derivation spike (APPROVED PLAN)

This plan was reviewed and approved. Execute it as written. Do not re-plan.

## Goal

Prove that a Solana wallet signature over a fixed message deterministically
yields the same Starknet account address across separate processes.

If this fails, invisible onboarding collapses and the product needs explicit
Starknet wallet connect (PRD §14 fallback). Nothing else in Phase 0 matters
more than this gate.

**Out of scope:** CCTP, the pool, SDK calls, mainnet transactions.

## Environment

All commands run **inside WSL on Node 24**. Do not run Claude Code, node, npm
or git from Windows against `\\wsl.localhost\` — git rejects it as dubious
ownership and Windows Node is v22.

```
source ~/.nvm/nvm.sh && nvm use 24 && cd ~/crosslink
```

- `starknet` dist-tags: install `starknet@next` (satisfies `^10.4.0`).
- `~/.npmrc` already has the `@starkware-libs` GitHub Packages scope + token.
  Not needed this phase — Phase 0 does not install the Privacy SDK.
- `.env` still has the literal `YOUR_KEY_HERE`. The class-hash script falls
  back to a public mainnet RPC and prints a clear message.
- Package manager: npm workspaces. No new tooling.

---

## 1. Minimal workspace scaffold

- `package.json` (root) — `private: true`, `workspaces: ["packages/*", "apps/*"]`,
  `engines.node: ">=24"`, devDependencies `typescript` and `esbuild`
  (esbuild only to bundle the browser harness).
- `.nvmrc` → `24`
- `tsconfig.base.json` — `strict: true`, target/lib ES2023, `module: nodenext`,
  `verbatimModuleSyntax`, `noUncheckedIndexedAccess`. No `any`.
- `.env.example` — mirrors `.env` with placeholders.
- `packages/core/package.json` — name `@crosslink/core`, `type: "module"`,
  dependency `starknet@next`. Scripts: `typecheck`, `test`, `harness`.
- `packages/core/tsconfig.json` extending the base.

Tests run on `node --test` with Node 24 native TypeScript type stripping — no
vitest, no ts-node. Requires `.ts` extensions on relative imports and no
TS-only runtime constructs (enums, decorators, namespaces). Fallback is vitest
only if stripping fights us.

---

## 2. `packages/core/src/message.ts` — domain-bound, ASCII-only

```ts
export const DERIVATION_MESSAGE =
  "Crosslink account derivation v1\ndomain: crosslink.app";
export const DERIVATION_MESSAGE_BYTES: Uint8Array =
  new TextEncoder().encode(DERIVATION_MESSAGE);
```

Two amendments to the PRD's original `Crosslink account derivation — v1`:

- **Domain binding.** The original string was fixed and public, so any site
  could prompt a user to sign it — and that signature seeds the spending key.
  Binding the origin makes a fraudulent request legible to a user reading the
  prompt.
- **Plain ASCII.** The em dash (U+2014) was three UTF-8 bytes carrying NFC/NFD
  normalization risk plus the hazard of being retyped as a hyphen.

Pinned by test: exact byte length, SHA-256 of `DERIVATION_MESSAGE_BYTES` as a
committed golden constant, every byte `< 0x80`, and separator is a bare `\n`
with no `\r` (this repo is edited from Windows).

**Honest framing for the findings doc:** domain binding does not prevent a
malicious site from requesting these exact bytes — no wallet enforces the
claim. It narrows the attack from "any site can silently reuse a generic
string" to "a site must display a domain that contradicts itself." Say so
rather than claiming the vector is closed.

---

## 3. `packages/core/src/derive.ts`

Input is the raw 64-byte ed25519 signature. Nothing else.

```
ikm    = signature bytes (64, ed25519)
salt   = sha256("crosslink/v1/solana-ed25519")
prk    = HKDF-Extract(SHA-256, salt, ikm)
skSeed = HKDF-Expand(prk, "crosslink/v1/starknet-spending-key", 32)
vkSeed = HKDF-Expand(prk, "crosslink/v1/viewing-key", 32)
```

HKDF from `@noble/hashes`, declared explicitly rather than relied on
transitively.

Both seeds reduced by a shared `grindToRange(seed, max)` mirroring StarkEx's
`grindKey`: hash `seed || counter`, reject draws above the largest multiple of
`max + 1` fitting in 256 bits, then reduce. Avoids modulo bias.

- Spending key → `[1, n − 1]` where `n = ec.starkCurve.CURVE.n` (read from
  starknet.js, not hardcoded).
- Viewing key → `[1, MAX_VIEWING_KEY]`. Defined locally as `n >> 1n` with a
  `TODO(phase-1)` to assert equality against the SDK export once installed.

Both returned as `bigint`, never hex strings. A hex string compiles fine and
silently derives wrong channel keys, so notes never decrypt.

**Secret handling.** The signature is the seed of the spending key, so it is
secret throughout.

```ts
interface DerivedIdentity {
  readonly public: { starkPublicKey: bigint; address: bigint; viewingKey: bigint };
  readonly secret: { spendingKey: bigint };   // never logged, never persisted
}
```

`secret` carries a `toJSON()` that throws and a `nodejs.util.inspect.custom`
handler returning `"[redacted]"`. A test asserts this. Only the viewing key may
persist, and even that is presented with a warning — it is read-only but
reveals the account's entire note history.

---

## 4. `packages/core/src/address.ts` + `constants.ts`

```ts
address = hash.calculateContractAddressFromHash(
  starkPublicKey,        // salt
  ACCOUNT_CLASS_HASH,
  [starkPublicKey],      // constructor calldata
  0n,                    // deployerAddress — counterfactual
);
```

`ACCOUNT_CLASS_HASH` is a single pinned value in `constants.ts` with a comment
recording network, date, and verification method. Treat it as protocol, not
configuration — changing it moves every derived address.

`scripts/verify-class-hash.mts` calls `provider.getClassByHash()` against
mainnet and fails loudly if undeclared. **If it fails, pick another OZ release
and re-verify — do not proceed.**

---

## 5. `packages/core/test/` — proving the gate

| Test | Establishes |
|---|---|
| Golden vector: fixed ed25519 secret key → exact expected address, committed | Regression lock on the whole pipeline |
| Sign same message twice with same key → byte-identical signatures | RFC 8032 determinism holds in practice |
| `scripts/determinism.mts` spawns two fresh node processes, diffs addresses | **The literal gate** |
| Single-bit flip in signature → different address | Entropy is not being discarded |
| Legacy PRD string (`… derivation — v1`) → different address | Message change is real and versioned; no silent drift back |
| Every byte `< 0x80`; contains `\n`, no `\r` | ASCII-only, CRLF-proof |
| `typeof viewingKey === "bigint"`, `1n ≤ vk ≤ MAX_VIEWING_KEY` | BigInt constraint and SDK range |
| `1n ≤ spendingKey ≤ n − 1n` | Valid Stark scalar |
| `JSON.stringify(result)` leaks no spending key; `util.inspect` shows `[redacted]` | Secret discipline enforced, not merely intended |

Synthetic keypairs from `@noble/curves/ed25519`. No real wallet key enters the
test suite.

---

## 6. `packages/core/harness/` — real-wallet test

Static page bundled by esbuild, served by `scripts/serve-harness.mjs` on
localhost. Entirely client-side: no network calls, no localStorage, no
persistence.

- Connect Phantom (`window.phantom?.solana`) and Solflare (`window.solflare`),
  each calling `signMessage(DERIVATION_MESSAGE_BYTES, "utf8")`.
- Per wallet display: Solana public key (base58), a SHA-256 **fingerprint** of
  the signature (never the signature itself), the Stark public key, and the
  derived Starknet address.
- Comparison panel reports MATCH / MISMATCH and distinguishes the two failure
  modes: **different Solana public keys** means different derivation paths
  (expected, harmless); **same public key but different fingerprints** would be
  a genuine signing-format divergence (the real problem).
- On-page note: Phantom defaults to `m/44'/501'/0'/0'`, Solflare to
  `m/44'/501'/0'`, so the same seed phrase lands on different accounts by
  default. A valid cross-wallet test requires the same Solana account.

---

## 7. `docs/PHASE0-DERIVATION.md` — findings

Honest register per CLAUDE.md. Confirm or correct against actual runs.

- **Does it work / is it stable.** Ed25519 signing is deterministic by
  construction (RFC 8032 derives the nonce from key and message), so a given
  account and fixed message yield one signature forever in any correct
  implementation. Determinism is a property of the scheme, not wallet goodwill.
- **Breaks it — derivation paths.** Phantom vs Solflare defaults differ; same
  seed lands on different accounts, hence a different Starknet address and an
  apparently vanished balance.
- **Breaks it — hardware wallets.** Ledger's Solana app signs Anza
  OffchainMessage-framed payloads, not raw bytes. Different bytes → different
  account. Ledger users cannot reach a hot-wallet-derived account.
- **Breaks it — MPC / smart-contract wallets.** Threshold ed25519 signers are
  not obliged to be deterministic; wallets without `signMessage` can't
  participate.
- **Breaks it — the message string.** Any byte-level change relocates every
  account. Pinned by test.
- **Breaks it — the account class hash.** It is an input to the address.
- **Why the message changed — signature phishing.** With limits stated per §2.
  Name SIWS / wallet-enforced origin binding as the Phase-1 follow-up.
- Record the PRD §14 fallback (explicit Starknet wallet connect) and state
  plainly whether the spike clears it.

---

## Files

| Path | Change |
|---|---|
| `package.json`, `.nvmrc`, `tsconfig.base.json`, `.env.example` | New — scaffold |
| `packages/core/package.json`, `packages/core/tsconfig.json` | New |
| `packages/core/src/{message,derive,address,constants,index}.ts` | New |
| `packages/core/test/{message,derive,secrets}.test.ts` | New |
| `packages/core/scripts/{determinism,verify-class-hash,serve-harness}.mts` | New |
| `packages/core/harness/index.html` + browser entry | New |
| `docs/PRD.md` §6.1 | Edit — message becomes domain-bound ASCII, with reasoning |
| `docs/PHASE0-DERIVATION.md` | New — findings |

`strk20.json` is untouched: Phase 0 produces no transactions and deploys no
contracts.

## Commits

Commit **and push** each immediately, not batched:

1. Workspace scaffold
2. `message.ts` + byte-pinning tests + the `docs/PRD.md` §6.1 amendment
   (same commit — spec and constant must never disagree, even briefly)
3. `derive.ts` + derivation and secret-redaction tests
4. `address.ts` + `constants.ts` + verified class hash
5. Cross-process determinism script
6. Harness
7. `docs/PHASE0-DERIVATION.md`

## Verification

1. `npm install` — resolves `starknet@next`
2. `npm run typecheck -w @crosslink/core` — strict, zero errors, no `any`
3. `npm test -w @crosslink/core` — table in §5 green
4. `npm run verify:class-hash -w @crosslink/core` — read-only, costs nothing
5. `npm run spike:determinism -w @crosslink/core` — **two cold node processes,
   identical address. This is the Phase 0 gate.**
6. `npm run harness -w @crosslink/core` — user signs with Phantom, then
   Solflare on the same account, reads off MATCH
7. Report: does it work, is it stable, what breaks it — plus the concrete
   derived address for the tested account, and the security note from §2.
