import { sha256 } from "@noble/hashes/sha2";
import { deriveSeeds } from "../src/derive.ts";
import { starkPublicKeyFromSpendingKey, addressFromStarkPublicKey } from "../src/address.ts";
import { DERIVATION_MESSAGE_BYTES } from "../src/message.ts";
import { base58Encode } from "./base58.ts";

interface SolanaPublicKeyLike {
  toBytes?(): Uint8Array;
  toBase58?(): string;
}

interface SignMessageResult {
  signature: Uint8Array;
  publicKey?: SolanaPublicKeyLike;
}

interface SolanaWalletProvider {
  publicKey?: SolanaPublicKeyLike;
  connect(): Promise<{ publicKey?: SolanaPublicKeyLike } | void>;
  signMessage(
    message: Uint8Array,
    display?: string,
  ): Promise<SignMessageResult | Uint8Array>;
}

declare global {
  interface Window {
    phantom?: { solana?: SolanaWalletProvider };
    solflare?: SolanaWalletProvider;
  }
}

interface WalletResult {
  walletName: string;
  solanaPublicKeyBase58: string;
  signatureFingerprintHex: string;
  starkPublicKeyHex: string;
  addressHex: string;
}

const results: Partial<Record<"phantom" | "solflare", WalletResult>> = {};

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function publicKeyBytes(pk: SolanaPublicKeyLike | undefined): Uint8Array | undefined {
  if (!pk?.toBytes) return undefined;
  return pk.toBytes();
}

function normalizeSignResult(
  result: SignMessageResult | Uint8Array,
): { signature: Uint8Array; publicKey?: SolanaPublicKeyLike } {
  if (result instanceof Uint8Array) {
    return { signature: result };
  }
  return result;
}

function setStatus(id: "phantom" | "solflare", text: string): void {
  const el = document.getElementById(`${id}-status`);
  if (el) el.textContent = text;
}

function renderResult(id: "phantom" | "solflare", result: WalletResult): void {
  const panel = document.getElementById(`${id}-result`);
  if (!panel) return;
  panel.innerHTML = `
    <dl>
      <dt>Solana public key</dt><dd>${result.solanaPublicKeyBase58}</dd>
      <dt>Signature fingerprint (SHA-256)</dt><dd>${result.signatureFingerprintHex}</dd>
      <dt>Stark public key</dt><dd>${result.starkPublicKeyHex}</dd>
      <dt>Derived Starknet address</dt><dd>${result.addressHex}</dd>
    </dl>
  `;
}

function renderComparison(): void {
  const panel = document.getElementById("comparison-result");
  if (!panel) return;

  const phantom = results.phantom;
  const solflare = results.solflare;
  if (!phantom || !solflare) {
    panel.textContent = "Connect and sign with both wallets to compare.";
    return;
  }

  if (phantom.solanaPublicKeyBase58 !== solflare.solanaPublicKeyBase58) {
    panel.textContent =
      "DIFFERENT SOLANA ACCOUNTS — expected, harmless. Phantom and Solflare " +
      "defaulted to different derivation paths, so they signed with different " +
      "Solana keys and produced different Starknet addresses. Reconnect both " +
      "wallets to the same Solana account for a real cross-wallet test.";
    panel.className = "neutral";
    return;
  }

  if (phantom.signatureFingerprintHex !== solflare.signatureFingerprintHex) {
    panel.textContent =
      "MISMATCH — same Solana public key, but the two wallets produced " +
      "different signatures over the identical message bytes. This is the " +
      "real problem: a genuine signing-format divergence, not a derivation-path " +
      "difference.";
    panel.className = "mismatch";
    return;
  }

  panel.textContent =
    phantom.addressHex === solflare.addressHex
      ? "MATCH — same Solana account, identical signature, identical derived Starknet address."
      : "MISMATCH — identical signature but different derived addresses. This " +
        "indicates a bug in derivation, not a wallet difference.";
  panel.className = phantom.addressHex === solflare.addressHex ? "match" : "mismatch";
}

async function connectAndSign(id: "phantom" | "solflare"): Promise<void> {
  const provider = id === "phantom" ? window.phantom?.solana : window.solflare;
  if (!provider) {
    setStatus(id, `${id} not detected — is the extension installed and unlocked?`);
    return;
  }

  try {
    setStatus(id, "connecting...");
    const connectResult = await provider.connect();
    const connectedKey =
      (connectResult && "publicKey" in connectResult ? connectResult.publicKey : undefined) ??
      provider.publicKey;

    setStatus(id, "waiting for signature...");
    const rawSignResult = await provider.signMessage(DERIVATION_MESSAGE_BYTES, "utf8");
    const { signature, publicKey: signedKey } = normalizeSignResult(rawSignResult);

    const pkBytes = publicKeyBytes(signedKey) ?? publicKeyBytes(connectedKey);
    if (!pkBytes) {
      throw new Error("wallet did not return a Solana public key");
    }

    const fingerprint = hex(sha256(signature));
    const { spendingKeySeed } = deriveSeeds(signature);
    const starkPublicKey = starkPublicKeyFromSpendingKey(spendingKeySeed);
    const address = addressFromStarkPublicKey(starkPublicKey);

    const result: WalletResult = {
      walletName: id,
      solanaPublicKeyBase58: base58Encode(pkBytes),
      signatureFingerprintHex: fingerprint,
      starkPublicKeyHex: `0x${starkPublicKey.toString(16)}`,
      addressHex: `0x${address.toString(16)}`,
    };

    results[id] = result;
    renderResult(id, result);
    setStatus(id, "done");
    renderComparison();
  } catch (error) {
    setStatus(id, `error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

document.getElementById("phantom-connect")?.addEventListener("click", () => {
  void connectAndSign("phantom");
});
document.getElementById("solflare-connect")?.addEventListener("click", () => {
  void connectAndSign("solflare");
});
