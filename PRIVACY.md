# Privacy model

Short version: we hide who paid whom, not that a payment happened. Details below.

## Public, no matter what

Deposits and withdrawals are public transactions — address, token, amount, block, all
visible on-chain forever. Only what happens *between* a deposit and a withdrawal,
inside the pool, is hidden. That's identity privacy, not amount privacy: aggregate
volume is always visible; a payout amount matching a recent deposit is a correlatable
fact for any observer.

## The pool is thin right now

Privacy depends on the anonymity set — how many other deposits an observer can't rule
out. Scored against the live pool, a typical payment currently has a plausible set of
about **3** other deposits. That's not meaningful privacy. Our meter's `thin_pool`
verdict says so and blocks the send instead of showing a green check. Live counts:
[meter](https://captaindiv.github.io/crosslink/) /
[demo](https://captaindiv.github.io/crosslink/demo.html).

## What we actually add

StarkWare's `bridgeOutToWallet()` already does unlinkable payout to a caller-chosen
address — we didn't invent that. We add the Linkability Meter: it scores a pending send
against the pool's real current state and refuses it when the privacy would be fake.

## Mechanics, plainly

- **Screening can't be bypassed.** Every deposit is screened by FPI and verified
  on-chain by the pool contract itself, regardless of client.
- **USDC only, via CCTP V2.** No native SUI, ETH, or BNB anywhere in the flow.
- **Notes mature ~10 blocks.** Shield-and-send isn't instant — funding and sending are
  necessarily separated in time.
- **Flat ~0.2 USDC fee per privacy action** (shield, transfer, withdraw). Negligible on
  a large payment, punitive on a small one — this has a floor cost that doesn't scale
  down.
- **Registration needs the wallet's native path.** The wallet API returns
  `NOT_REGISTERED` for a first-time account and has no register action — bootstrapping
  only works through the wallet's own Shield UI (a paymaster-relayed SNIP-9 call). After
  that, the wallet API works normally.

## What the meter does not catch

- **Off-chain correlation** — if either side discloses the link outside the pool's own
  event stream, we have nothing to say about it.
- **Network-level observation** — mempool, RPC timing, or IP correlation is invisible
  to us.
- **Recipient-side disclosure** — nothing stops the recipient from naming their payer.
- **Channel freshness is a pool-wide proxy, not a per-channel read** — we can't decode
  who opened which channel, so a pool that looks active overall can still mean a stale,
  easily-isolated channel for one sender.
