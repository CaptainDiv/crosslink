import type { MeterResult, SignalId, SignalResult, Verdict } from "@crosslink/meter";

const USDC_DECIMALS = 6;

// The verdict banner already restates one signal's own headline/detail verbatim
// (see packages/meter/src/score.ts:pickVerdict) — render that signal's card only
// once, as the banner, not a second time in the grid below it.
const VERDICT_SIGNAL_ID: Partial<Record<Verdict, SignalId>> = {
  too_soon: "timing_correlation",
  thin_pool: "plausible_set",
  distinctive_amount: "amount_uniqueness",
};

export function parseUsdc(input: string): bigint {
  const [whole = "", frac = ""] = input.trim().split(".");
  const fracPadded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const wholePart = whole === "" ? 0n : BigInt(whole);
  return wholePart * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded || "0");
}

export function signalCard(signal: SignalResult): string {
  return `
    <div class="signal-card signal-${signal.status}">
      <div class="signal-status">${signal.status.replace("_", " ")}</div>
      <div class="signal-headline">${signal.headline}</div>
      <div class="signal-detail">${signal.detail}</div>
    </div>
  `;
}

export function renderResult(target: HTMLElement, result: MeterResult): void {
  const verdictSignalId = VERDICT_SIGNAL_ID[result.verdict];
  const gridSignals = result.signals.filter((s) => s.id !== verdictSignalId);
  target.innerHTML = `
    <div class="verdict verdict-${result.verdict}">
      <div class="verdict-label">${result.verdict.replace("_", " ")}</div>
      <div class="verdict-headline">${result.headline}</div>
      <div class="verdict-detail">${result.detail}</div>
    </div>
    <div class="signal-grid">
      ${gridSignals.map(signalCard).join("")}
    </div>
  `;
}
