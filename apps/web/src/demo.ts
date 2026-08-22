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

// Real mainnet transactions (2026-08-22), verified against the pool's own event log
// before wiring in: PUBLIC_TX_HASH never touches the pool contract (plain USDC
// transfer); PRIVATE_TX_HASH shows in-pool EncNoteCreated activity with no
// external-address withdrawal. See strk20.json for the full set including
// registration.
const PUBLIC_TX_HASH: string | null =
  "0x189599645a9f4b6b4e9faa9921e55c2a80070e1286ff11cf2e35d0282183882";
const PRIVATE_TX_HASH: string | null =
  "0x4121124483d1259124dc1f50b3a6e9771a07061dc80bfafd3e6a984fe19de46";

// Real addresses, read from the two transactions above via starknet_getTransactionReceipt /
// starknet_getTransactionByHash — not illustrative placeholders.
const PUBLIC_SENDER = "0x0276c6131e74e41e2f1d6dfd0e59792b4f7fa5de457bb99cbc66297ee7c709ee";
// USDC Transfer event `to`, PUBLIC_TX_HASH.
const PUBLIC_RECIPIENT = "0x019252b1deef483477c4d30cfcc3e5ed9c82fafea44669c182a45a01b4fdb97a";
// sender_address of PRIVATE_TX_HASH itself — the relayer that submitted it, not the payer.
const RELAYER_ADDRESS = "0x01703d22f8415395dfcfa3c810ab333e3198894009c521556c764590622f2a67";

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

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function renderDemoCard(isPrivate: boolean, amountLabel: string): void {
  const card = el<HTMLElement>("demo-card");
  const note = el<HTMLElement>("demo-card-note");
  const senderEl = el<HTMLElement>("demo-sender");
  const recipientEl = el<HTMLElement>("demo-recipient");
  const amountEl = el<HTMLElement>("demo-amount-value");
  const txEl = el<HTMLElement>("demo-tx");

  card.classList.toggle("demo-card--private", isPrivate);
  recipientEl.classList.toggle("demo-redacted", isPrivate);
  amountEl.classList.toggle("demo-redacted", isPrivate);

  if (isPrivate) {
    note.textContent =
      "Through Crosslink. The on-chain sender is a rotating relayer, not the payer — attribute " +
      "activity from the pool's Deposit event, never the tx sender. Recipient and amount live inside " +
      "an encrypted note.";
    senderEl.textContent = truncateAddr(RELAYER_ADDRESS);
    senderEl.title = RELAYER_ADDRESS;
    recipientEl.textContent = "🔒 encrypted note";
    recipientEl.removeAttribute("title");
    amountEl.textContent = "🔒 encrypted note";
    renderHash(txEl, PRIVATE_TX_HASH);
  } else {
    note.textContent = "A standard public transfer. Anyone watching the chain sees all four fields below.";
    senderEl.textContent = truncateAddr(PUBLIC_SENDER);
    senderEl.title = PUBLIC_SENDER;
    recipientEl.textContent = truncateAddr(PUBLIC_RECIPIENT);
    recipientEl.title = PUBLIC_RECIPIENT;
    amountEl.textContent = amountLabel;
    renderHash(txEl, PUBLIC_TX_HASH);
  }
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
  const privacyToggle = el<HTMLInputElement>("privacy-toggle");
  const privacySwitchLabelEl = el<HTMLElement>("privacy-switch-label");

  const updateDemoCard = (): void => {
    privacySwitchLabelEl.textContent = privacyToggle.checked ? "Sending privately" : "Send privately";
    renderDemoCard(privacyToggle.checked, `${amountInput.value || "0"} USDC`);
  };
  privacyToggle.addEventListener("change", updateDemoCard);
  // Populate the payment card up front — it's independent of the live pool RPC
  // fetch below and must still render if that fetch fails.
  updateDemoCard();

  let window: PoolWindow;
  try {
    window = await fetchPoolWindow(createProvider());
  } catch (error) {
    livePoolStatsEl.textContent = `Could not reach the pool via RPC: ${
      error instanceof Error ? error.message : String(error)
    }`;
    return;
  }
  livePoolStatsEl.innerHTML =
    `Live over blocks <span class="mono">${window.fromBlock.toLocaleString()}–${window.toBlock.toLocaleString()}</span>: ` +
    `<span class="mono">${window.usdcDeposits.length}</span> USDC deposits, ` +
    `<span class="mono">${window.usdcWithdrawals.length}</span> withdrawals.`;

  let sliderTouched = false;

  const rescoreLive = (): number => {
    const amount = parseUsdc(amountInput.value || "0");
    const result = scorePendingSend(window, { amount });
    renderResult(liveResultEl, result);
    const plausibleCount = result.signals.find((s) => s.id === "plausible_set")?.value ?? 0;
    depthSlider.max = String(Math.max(DEPTH_SLIDER_FLOOR_MAX, plausibleCount + 50));
    depthMarkerEl.innerHTML = `Today's real depth for this amount: <span class="mono">${plausibleCount}</span> deposits.`;
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
    updateDemoCard();
  });
  depthSlider.addEventListener("input", () => {
    sliderTouched = true;
    rescoreDepth();
  });

  rescoreLive();
  rescoreDepth();
}

main();
