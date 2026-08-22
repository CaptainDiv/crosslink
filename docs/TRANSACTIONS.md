# Transactions

Receipt data for the three real mainnet transactions in `strk20.json`, against the STRK20 pool at
`0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`. Pulled via
`starknet_getTransactionReceipt` against the public Starknet RPC (`https://rpc.starknet.lava.build`)
on 2026-08-22. Starknet receipts report `actual_fee` (paid in FRI, STRK's smallest unit), not raw
gas — there is no gas column to show, only a fee one.

| Step | Tx hash | Block | Fee (STRK) | Status |
|---|---|---|---|---|
| Registration (viewing key, via Ready's native Shield UI) | [`0x216c…9cfd`](https://voyager.online/tx/0x216c69f39fdc5fb64db33ac5344cee138a693a34062c2075e3a943d6eed9cfd) | 13,664,033 | 3.308599 | Confirmed (L1) |
| Shield — 1.37 USDC deposit | [`0x201a…e3e1`](https://voyager.online/tx/0x201a72f8ded88051c57e1e2dfee39811f392ba7a6e37e82d2252b95f5f6e3e1) | 13,664,304 | 2.851916 | Confirmed (L1) |
| Private transfer — no public leg | [`0x4121…de46`](https://voyager.online/tx/0x4121124483d1259124dc1f50b3a6e9771a07061dc80bfafd3e6a984fe19de46) | 13,664,327 | 2.851916 | Confirmed (L1) |

All three: `finality_status: ACCEPTED_ON_L1`, `execution_status: SUCCEEDED`.

No withdrawal leg has happened yet — the corridor's outbound anonymizer step (Phase 3/4 in
`CLAUDE.md`'s build order) hasn't run against mainnet. The Proof page shows exactly these three
rows, not a padded five-step lifecycle.
