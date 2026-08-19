export const DERIVATION_MESSAGE =
  "Crosslink account derivation v1\ndomain: crosslink.app";

export const DERIVATION_MESSAGE_BYTES: Uint8Array = new TextEncoder().encode(
  DERIVATION_MESSAGE,
);

/**
 * Legacy PRD §6.1 string, pre-domain-binding. Kept only so tests can prove
 * the message change actually relocates every derived address — never sign
 * this.
 */
export const LEGACY_DERIVATION_MESSAGE = "Crosslink account derivation — v1";
