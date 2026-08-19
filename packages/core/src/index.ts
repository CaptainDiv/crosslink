import { addressFromStarkPublicKey, starkPublicKeyFromSpendingKey } from "./address.ts";
import { deriveSeeds, type DerivedIdentity } from "./derive.ts";
import { createSecret } from "./secrets.ts";

export { DERIVATION_MESSAGE, DERIVATION_MESSAGE_BYTES } from "./message.ts";
export { ACCOUNT_CLASS_HASH } from "./constants.ts";
export type { DerivedIdentity, DerivedIdentityPublic, DerivedIdentitySecret } from "./derive.ts";

/**
 * Full pipeline: a raw 64-byte ed25519 signature over DERIVATION_MESSAGE_BYTES
 * in, a counterfactual Starknet identity out. The spending key seed is used
 * directly as the Stark private key — grindToRange already reduced it into
 * the curve's valid scalar range.
 */
export function deriveIdentity(signature: Uint8Array): DerivedIdentity {
  const { spendingKeySeed, viewingKeySeed } = deriveSeeds(signature);
  const starkPublicKey = starkPublicKeyFromSpendingKey(spendingKeySeed);
  const address = addressFromStarkPublicKey(starkPublicKey);

  return {
    public: { starkPublicKey, address, viewingKey: viewingKeySeed },
    secret: createSecret(spendingKeySeed),
  };
}
