import { ec, hash } from "starknet";
import { ACCOUNT_CLASS_HASH } from "./constants.ts";

function toHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

export function starkPublicKeyFromSpendingKey(spendingKey: bigint): bigint {
  return BigInt(ec.starkCurve.getStarkKey(toHex(spendingKey)));
}

/**
 * Counterfactual address for a not-yet-deployed OZ account: salt is the
 * Stark public key, constructor calldata is `[starkPublicKey]`, and
 * `deployerAddress` is 0 because nothing has deployed it yet.
 */
export function addressFromStarkPublicKey(starkPublicKey: bigint): bigint {
  const address = hash.calculateContractAddressFromHash(
    starkPublicKey,
    ACCOUNT_CLASS_HASH,
    [starkPublicKey],
    0n,
  );
  return BigInt(address);
}
