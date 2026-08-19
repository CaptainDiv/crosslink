import "./style.css";
import {
  createProvider,
  fetchPoolWindow,
  scorePendingSend,
  PLAUSIBLE_SET_THIN_THRESHOLD,
  type MeterResult,
  type PoolWindow,
  type SignalResult,
} from "@crosslink/meter";

const USDC_DECIMALS = 6;

function parseUsdc(input: string): bigint {
  const [whole = "", frac = ""] = input.trim().split(".");
  const fracPadded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  const wholePart = whole === "" ? 0n : BigInt(whole);
  return wholePart * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded || "0");
}

function poolStatsEl(): HTMLElement {
  return document.getElementById("pool-stats") as HTMLElement;
}

function resultEl(): HTMLElement {
  return document.getElementById("result") as HTMLElement;
}

function renderPoolStats(window: PoolWindow): void {
  const usdcDeposits = window.usdcDeposits.length;
  const thin = usdcDeposits < PLAUSIBLE_SET_THIN_THRESHOLD;
  poolStatsEl().innerHTML = `
    <p>
      Live over blocks ${window.fromBlock.toLocaleString()}–${window.toBlock.toLocaleString()}
      (~${Math.round((window.toBlock - window.fromBlock) * window.avgBlockTimeSeconds / 3600)}h):
      <strong>${usdcDeposits}</strong> USDC deposits,
      <strong>${window.usdcWithdrawals.length}</strong> USDC withdrawals.
    </p>
    ${
      thin
        ? `<p class="thin-pool-banner">This pool is thin right now — real privacy is limited by
           how many other deposits could explain a given payout, not by this tool. The verdicts
           below reflect that honestly.</p>`
        : ""
    }
  `;
}

function signalCard(signal: SignalResult): string {
  return `
    <div class="signal-card signal-${signal.status}">
      <div class="signal-status">${signal.status.replace("_", " ")}</div>
      <div class="signal-headline">${signal.headline}</div>
      <div class="signal-detail">${signal.detail}</div>
    </div>
  `;
}

function renderResult(result: MeterResult): void {
  resultEl().innerHTML = `
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

async function main(): Promise<void> {
  const provider = createProvider();
  let window: PoolWindow;
  try {
    window = await fetchPoolWindow(provider);
  } catch (error) {
    poolStatsEl().innerHTML = `<p class="error">Could not reach the pool via RPC: ${
      error instanceof Error ? error.message : String(error)
    }</p>`;
    return;
  }
  renderPoolStats(window);

  const form = document.getElementById("score-form") as HTMLFormElement;
  const amountInput = document.getElementById("amount-input") as HTMLInputElement;
  const fundedAtInput = document.getElementById("funded-at-input") as HTMLInputElement;

  const scoreNow = () => {
    const amount = parseUsdc(amountInput.value || "0");
    const fundedAt = fundedAtInput.value
      ? Math.floor(new Date(fundedAtInput.value).getTime() / 1000)
      : undefined;
    const result = scorePendingSend(window, { amount, fundedAt });
    renderResult(result);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    scoreNow();
  });

  scoreNow();
}

main();
