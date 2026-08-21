# Privacy model

Crosslink moves USDC from a source chain into the STRK20 privacy pool, transfers it
privately inside the pool, and pays it out to a destination address on another chain.
This document states plainly what that does and does not hide, what is public
regardless of anything Crosslink does, and where the Linkability Meter's coverage
stops. If a claim isn't backed by something you can verify on-chain or in the SDK's own
behavior, it isn't in this document.

## What is public, no matter what

A deposit into the pool is a public transaction. The depositor's address, the token,
the amount, and the block it landed in are all visible on-chain, permanently, to
anyone. The same is true of a withdrawal: the recipient's address, the token, and the
amount are public. Open notes — the slot a helper contract's output gets credited
into — carry a plaintext amount by protocol design, not by any choice Crosslink makes.
Nothing about connecting to a privacy-enabled wallet or using this meter changes any of
that. If you fund your shielded balance, that funding event is on the public record for
as long as Starknet's history exists.

## What is private

Once a deposit has matured (about 10 blocks) and its owner is registered, a private
transfer between two registered pool users — the sender, the recipient, and the
amount — is not visible on-chain. That is the entire private leg: everything before it
(the deposit) and everything after it (the eventual withdrawal) is public, as described
above. What a private transfer actually buys you is that an observer watching the
public deposit and the public withdrawal cannot connect the two, because the movement
between them happened inside the pool where sender, recipient, and amount are hidden.

This is **identity privacy, not amount privacy**. Crosslink does not hide how much
money moves through the system — deposit and withdrawal amounts are public, so anyone
watching the pool's event stream can see the aggregate volume flowing in and out. What
it hides is which specific deposit funded which specific payout, and therefore who paid
whom. If that distinction matters for your use case, plan around it: a payout amount
that exactly matches a recent deposit amount is a public fact an observer can act on,
independent of anything happening inside the pool.

## The pool is thin right now, and that matters

Privacy from a private transfer is a function of the anonymity set: the number of other
deposits an observer can't rule out as the source of a given payout. A private transfer
inside a pool with three other deposits is not meaningfully private, no matter how the
cryptography works, because there are only three other explanations for where the money
came from.

As of 2026-08-21, the live mainnet pool has roughly a dozen USDC deposits over the
meter's ~48-hour recent-activity window — the exact count moves constantly and is
visible live on the [Linkability Meter](https://captaindiv.github.io/crosslink/) and the
[side-by-side demo](https://captaindiv.github.io/crosslink/demo.html), not restated
here as a fixed number that would go stale. A dozen deposits is a thin anonymity set.
The meter's `thin_pool`
verdict exists specifically to say so and refuse the send, rather than let a payout
happen against an anonymity set too small to mean anything. This is a property of how
new and small the pool currently is, not a limitation Crosslink is hiding — it is the
reason the meter exists.

## Deposit screening cannot be bypassed

Every deposit into the pool is screened by FPI and the screening signature is verified
on-chain by the pool contract itself, enforced in-protocol. Self-hosted proving does
not route around this: a structurally valid deposit transaction that fails screening
reverts, the same as it would for any other client. Crosslink does not add its own
screening and does not need to — the check happens at the protocol level regardless of
which client submitted the deposit.

## USDC via CCTP V2 only

The cross-chain leg moves USDC, and only USDC, over Circle's CCTP V2. No other asset
moves in native form through this system — there is no native SUI, ETH, or BNB transfer
anywhere in the flow, only USDC on chains CCTP V2 supports. CCTP V1 chains are out of
scope; V1's phase-out began 31 July 2026, and Crosslink was built against V2 from the
start rather than supporting a route being deprecated.

## Notes mature before they can move again

A note is spendable roughly 10 blocks after it is created, not immediately. Shielding
funds and sending them privately in the same flow is not possible — the funding step
and the send step are necessarily separated in time. This is a pool-level constraint,
not a Crosslink limitation, and the meter's own timing-correlation signal is built
around it: waiting only a few seconds past the minimum maturity window still leaves a
funding-to-send gap short enough to correlate, which is why the meter flags sends that
happen too soon after funding even once the note is technically mature.

## What Crosslink actually adds

The underlying payout primitive already exists upstream. StarkWare's
`bridgeOutToWallet()` (`starkware-libs/privacy-bridge`) already withdraws pool funds
through an anonymizer contract and burns them via CCTP to a caller-chosen destination
address — an unlinkable payout to an address the caller picks, not only the caller's
own address. Crosslink is not inventing that payout mechanism. What Crosslink adds is
the Linkability Meter: a live scorer that looks at a pending send against the pool's
actual current public state and refuses to let it go through when the privacy it would
provide is fake — when the pool is too thin, the amount is too distinctive, or the
funding-to-send timing is too tight to mean anything. The payout exists; the honesty
about when it's worth anything is the contribution.

## What the meter does not catch

The meter reads public on-chain pool state. It has no visibility into, and cannot
protect against, the following:

- **Off-chain correlation.** If Alice tells Bob out of band who she is, if Alice funds
  her shielded balance from an address that's KYC'd at an exchange and that link is
  public elsewhere, or if Alice and Bob's activity correlates through any channel
  outside the pool's own event stream, the meter has nothing to say about it. It scores
  on-chain linkability, not real-world identity.
- **Network-level observation.** Someone watching mempool traffic, RPC request timing,
  or IP addresses at the network layer can correlate a user's activity independent of
  anything visible on-chain. The meter has no access to that layer and cannot detect or
  warn about it.
- **Recipient-side disclosure.** Nothing prevents Bob from telling anyone who paid him,
  publishing his own receiving address publicly, or otherwise disclosing the payment
  himself. The privacy this system provides is that Bob cannot determine who paid him
  from the on-chain record alone — it is not a guarantee that the payment stays
  confidential once either party chooses to disclose it.

## Known weaknesses, restated plainly

- **Amount matching.** A payout amount that closely matches a recent deposit amount is
  a correlatable signal available to any public observer, independent of the pool's
  cryptography. The meter flags distinctive amounts; it cannot make an amount
  non-distinctive.
- **Timing correlation.** A send that happens shortly after funding narrows the set of
  plausible source deposits regardless of note maturity. The meter flags this; waiting
  longer is the only real mitigation.
- **Thin pool.** Described above. Privacy scales with the anonymity set, and today's
  set is small.
- **Derived-key dependency**, where applicable: losing the wallet that derived a
  Starknet account loses access to that account. There is no recovery path other than
  the original signing wallet.
- **Paymaster visibility.** A transaction relayed through a paymaster is visible to that
  paymaster, in addition to being visible on-chain.
