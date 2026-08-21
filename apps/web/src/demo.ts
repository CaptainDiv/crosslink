import "./style.css";
import {
  createProvider,
  fetchPoolWindow,
  scorePendingSend,
  USDC_TOKEN_ADDRESS,
  type DepositEvent,
  type NoteCreatedEvent,
  type PoolWindow,
} from "@crosslink/meter";
import { parseUsdc, renderResult } from "./meterUi.ts";

// Swap these two for real mainnet tx hashes once run tomorrow — leave null until then.
const PUBLIC_TX_HASH: string | null = null;
const PRIVATE_TX_HASH: string | null = null;

// Illustrative addresses only — not real wallets.
const PUBLIC_SENDER = "0x04a7…e3f1 (placeholder)";
const PUBLIC_RECIPIENT = "0x0629…9ab4 (placeholder)";
const RELAYER_ADDRESS = "0x0157…c2d0 (placeholder, rotates per transaction)";

const DEPTH_SLIDER_FLOOR_MAX = 200;

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function renderHash(target: HTMLElement, hash: string | null): void {
  target.innerHTML =
    hash === null
      ? `<span class="hash-badge">PLACEHOLDER</span>`
      : `<a href="https://voyager.online/tx/${hash}" target="_blank" rel="noopener noreferrer">${hash.slice(0, 10)}…${hash.slice(-6)}</a>`;
}

/**
 * A hypothetical pool window with `depth` synthetic USDC deposits, each at
 * exactly the candidate amount so they honestly satisfy both the
 * plausible-set (>=) and amount-uniqueness (within 1%) checks, plus
 * note-creation events scaled by the real window's own note-per-deposit
 * ratio so channel freshness moves with it too — never just one signal
 * flipping while the others still read thin. Never rendered as real data.
 */
function buildSimulatedWindow(real: PoolWindow, depth: number, amount: bigint): PoolWindow {
  const syntheticDeposits: DepositEvent[] = Array.from({ length: depth }, (_, i) => ({
    kind: "deposit",
    userAddr: 0n,
    token: USDC_TOKEN_ADDRESS,
    amount,
    blockNumber:
      real.fromBlock + Math.floor((i / Math.max(depth, 1)) * (real.toBlock - real.fromBlock)),
    txHash: `0xsimulated${i}`,
  }));

  const noteRatio =
    real.usdcDeposits.length > 0 ? real.noteCreations.length / real.usdcDeposits.length : 20;
  const targetNoteCount = Math.round(depth * noteRatio);
  const syntheticNotes: NoteCreatedEvent[] = Array.from({ length: targetNoteCount }, (_, i) => ({
    kind: "note_created",
    blockNumber: real.toBlock,
    txHash: `0xsimulated-note${i}`,
  }));

  return { ...real, usdcDeposits: syntheticDeposits, noteCreations: syntheticNotes };
}

async function main(): Promise<void> {
  const amountInput = el<HTMLInputElement>("demo-amount");
  const livePoolStatsEl = el<HTMLElement>("live-pool-stats");
  const liveResultEl = el<HTMLElement>("live-result");
  const depthSlider = el<HTMLInputElement>("depth-slider");
  const depthReadoutEl = el<HTMLElement>("depth-readout");
  const depthMarkerEl = el<HTMLElement>("depth-marker");
  const depthResultEl = el<HTMLElement>("depth-result");
  const publicAmountEl = el<HTMLElement>("public-amount");

  el<HTMLElement>("public-sender").textContent = PUBLIC_SENDER;
  el<HTMLElement>("public-recipient").textContent = PUBLIC_RECIPIENT;
  el<HTMLElement>("private-sender").textContent = RELAYER_ADDRESS;
  renderHash(el<HTMLElement>("public-tx"), PUBLIC_TX_HASH);
  renderHash(el<HTMLElement>("private-tx"), PRIVATE_TX_HASH);

  let window: PoolWindow;
  try {
    window = await fetchPoolWindow(createProvider());
  } catch (error) {
    livePoolStatsEl.textContent = `Could not reach the pool via RPC: ${
      error instanceof Error ? error.message : String(error)
    }`;
    return;
  }
  livePoolStatsEl.textContent =
    `Live over blocks ${window.fromBlock.toLocaleString()}–${window.toBlock.toLocaleString()}: ` +
    `${window.usdcDeposits.length} USDC deposits, ${window.usdcWithdrawals.length} withdrawals.`;

  let sliderTouched = false;

  const rescoreLive = (): number => {
    const amount = parseUsdc(amountInput.value || "0");
    publicAmountEl.textContent = `${amountInput.value || "0"} USDC`;
    const result = scorePendingSend(window, { amount });
    renderResult(liveResultEl, result);
    const plausibleCount = result.signals.find((s) => s.id === "plausible_set")?.value ?? 0;
    depthSlider.max = String(Math.max(DEPTH_SLIDER_FLOOR_MAX, plausibleCount + 50));
    depthMarkerEl.textContent = `Today's real depth for this amount: ${plausibleCount} deposits.`;
    if (!sliderTouched) {
      depthSlider.value = String(plausibleCount);
    }
    return plausibleCount;
  };

  const rescoreDepth = (): void => {
    const amount = parseUsdc(amountInput.value || "0");
    const depth = Number(depthSlider.value);
    depthReadoutEl.textContent = String(depth);
    const simulated = buildSimulatedWindow(window, depth, amount);
    const result = scorePendingSend(simulated, { amount });
    renderResult(depthResultEl, result);
  };

  amountInput.addEventListener("input", () => {
    rescoreLive();
    rescoreDepth();
  });
  depthSlider.addEventListener("input", () => {
    sliderTouched = true;
    rescoreDepth();
  });

  rescoreLive();
  rescoreDepth();
}

main();
