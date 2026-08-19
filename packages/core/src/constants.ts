/**
 * OpenZeppelin Account v1.0.0 class hash. Sourced from Starknet Foundry's
 * `sncast`, which uses it as the default class hash for account creation
 * (crates/sncast/src/helpers/constants.rs, OZ_CLASS_HASH) — an actively
 * maintained tool that deploys real accounts against it today.
 *
 * This is an input to every derived Starknet address, not configuration.
 * Changing it moves every derived account. `scripts/verify-class-hash.mts`
 * checks it is actually declared on mainnet before Phase 0 can pass;
 * see docs/PHASE0-DERIVATION.md for the verified result.
 */
export const ACCOUNT_CLASS_HASH: bigint =
  0x05b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564n;
