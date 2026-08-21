import type { MeterResult, SignalResult } from "@crosslink/meter";

const USDC_DECIMALS = 6;

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
  target.innerHTML = `
    <div class="verdict verdict-${result.verdict}">
      <div class="verdict-label">${result.verdict.replace("_", " ")}</div>
      <div class="verdict-headline">${result.headline}</div>
      <div class="verdict-detail">${result.detail}</div>
    </div>
    <div class="signal-grid">
      ${result.signals.map(signalCard).join("")}
    </div>
  `;
}
