import "./style.css";
import {
  createProvider,
  fetchPoolWindow,
  scorePendingSend,
  PLAUSIBLE_SET_THIN_THRESHOLD,
  type PoolWindow,
} from "@crosslink/meter";
import { parseUsdc, renderResult } from "./meterUi.ts";

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
    renderResult(resultEl(), result);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    scoreNow();
  });

  scoreNow();
}

main();
