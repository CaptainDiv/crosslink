import { test } from "node:test";
import assert from "node:assert/strict";
import { parseUsdc, USDC_DECIMALS } from "../src/amount.ts";

test("USDC_DECIMALS is 6", () => {
  assert.equal(USDC_DECIMALS, 6);
});

test("whole amounts convert to smallest units", () => {
  assert.equal(parseUsdc("1"), 1_000_000n);
  assert.equal(parseUsdc("247"), 247_000_000n);
  assert.equal(parseUsdc("0"), 0n);
});

test("fractional amounts convert, padding to six decimals", () => {
  assert.equal(parseUsdc("247.50"), 247_500_000n);
  assert.equal(parseUsdc("1.37"), 1_370_000n);
  assert.equal(parseUsdc("0.000001"), 1n);
});

test("a leading-dot amount is treated as zero whole units", () => {
  assert.equal(parseUsdc(".5"), 500_000n);
});

test("surrounding whitespace is ignored", () => {
  assert.equal(parseUsdc("  247.50  "), 247_500_000n);
});

test("fractional digits beyond six are truncated, not rounded", () => {
  // 1.9999999 would round to 2.0 — it must not.
  assert.equal(parseUsdc("1.9999999"), 1_999_999n);
});

test("malformed input throws rather than silently scoring a wrong amount", () => {
  // "1.2.3" is the important one: a lenient split-on-"." reads it as 1.2 and
  // scores an amount the caller never asked about.
  for (const bad of ["abc", "1.2.3", "", "   ", "-1", "1e5", "0x10", "1,000"]) {
    assert.throws(() => parseUsdc(bad), RangeError, `expected ${JSON.stringify(bad)} to be rejected`);
  }
});
