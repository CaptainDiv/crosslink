const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Minimal Base58 (Bitcoin/Solana alphabet) encoder — display only. */
export function base58Encode(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }

  let out = "";
  while (value > 0n) {
    const remainder = value % 58n;
    value /= 58n;
    out = ALPHABET[Number(remainder)] + out;
  }

  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `${ALPHABET[0]}${out}`;
  }

  return out || ALPHABET[0]!;
}
