import "./style.css";
import { createProvider, fetchPoolWindow, scorePendingSend, parseUsdc, type PoolWindow } from "@crosslink/meter";
import { renderResult } from "./meterUi.ts";

// Same default amount the homepage meter opens with, so the two pages'
// verdicts stay directly comparable — not cherry-picked to guarantee a
// refusal.
const NEGATIVE_PROOF_AMOUNT = parseUsdc("10");

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function renderNegativeProof(target: HTMLElement, window: PoolWindow): void {
  const result = scorePendingSend(window, { amount: NEGATIVE_PROOF_AMOUNT });
  target.innerHTML =
    result.verdict === "clear"
      ? ""
      : `<span class="guardrail-badge">Guardrail fired correctly</span>`;
  const resultContainer = document.createElement("div");
  target.appendChild(resultContainer);
  renderResult(resultContainer, result);
  if (result.verdict === "clear") {
    target.insertAdjacentHTML(
      "beforeend",
      `<p class="section-note">The live pool isn't thin enough to refuse a 10 USDC payout right
       now — no manufactured refusal here. That's the same honesty rule working the other
       direction.</p>`,
    );
  }
}

function renderLastVerified(fetchedAt: number): void {
  const time = new Date(fetchedAt).toLocaleTimeString();
  el<HTMLElement>("last-verified").textContent = `Last verified ${time}`;
}

async function main(): Promise<void> {
  const negativeProofEl = el<HTMLElement>("negative-proof");
  const reverifyBtn = el<HTMLButtonElement>("reverify-btn");
  const provider = createProvider();

  const load = async (): Promise<void> => {
    reverifyBtn.disabled = true;
    reverifyBtn.textContent = "Checking pool…";
    try {
      const window = await fetchPoolWindow(provider);
      renderNegativeProof(negativeProofEl, window);
      renderLastVerified(Date.now());
    } catch (error) {
      negativeProofEl.innerHTML = `<p class="error">Could not reach the pool via RPC: ${
        error instanceof Error ? error.message : String(error)
      }</p>`;
    } finally {
      reverifyBtn.disabled = false;
      reverifyBtn.textContent = "Re-verify live";
    }
  };

  reverifyBtn.addEventListener("click", load);
  await load();
}

main();
