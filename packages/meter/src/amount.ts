/** USDC has 6 decimals, so 1 USDC is 1_000_000 smallest units. */
export const USDC_DECIMALS = 6;

/** Optional whitespace, digits, optionally a single dot with digits on one side. */
const USDC_AMOUNT = /^\s*(?:\d+(?:\.\d*)?|\.\d+)\s*$/;

/**
 * Converts a human USDC string ("247.50") to the bigint smallest units the
 * meter scores against (247500000n). Fractional digits beyond six are
 * truncated, not rounded.
 *
 * Rejects anything that isn't an unsigned decimal number. That strictness is
 * deliberate: a lenient split on "." would read "1.2.3" as 1.2 and score an
 * amount the caller never asked about, which is exactly the kind of silent
 * wrongness this package exists to avoid. Callers taking untrusted input
 * should catch this and report it, not pass it through.
 */
export function parseUsdc(input: string): bigint {
  if (!USDC_AMOUNT.test(input)) {
    throw new RangeError(
      `Not a valid USDC amount: ${JSON.stringify(input)}. Expected an unsigned decimal like "247.50".`,
    );
  }
  const [whole = "", frac = ""] = input.trim().split(".");
  const fracPadded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const wholePart = whole === "" ? 0n : BigInt(whole);
  return wholePart * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded || "0");
}
