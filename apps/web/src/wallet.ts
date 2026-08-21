import "./style.css";
import {
  createProvider,
  fetchPoolWindow,
  scorePendingSend,
  USDC_TOKEN_ADDRESS,
  type MeterResult,
} from "@crosslink/meter";
import { parseUsdc, renderResult } from "./meterUi.ts";
import { createStore } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { WalletAccountV6, walletV6, compareVersions, type STRK20_ACTION } from "starknet";

const MIN_WALLET_API_VERSION = "0.10.3";
const USDC_DECIMALS_DIVISOR = 1_000_000n;

const toHex = (value: bigint): string => `0x${value.toString(16)}`;
const USDC_TOKEN_HEX = toHex(USDC_TOKEN_ADDRESS);

function formatUsdc(amount: bigint): string {
  const whole = amount / USDC_DECIMALS_DIVISOR;
  const frac = (amount % USDC_DECIMALS_DIVISOR).toString().padStart(6, "0").slice(0, 2);
  return `${whole}.${frac}`;
}

/**
 * Non-blocking nudge: whole-dollar amounts that are multiples of 5 are the
 * amount-uniqueness signal's own failure mode (PRD §8), so flag them here
 * before the wallet prompt, not just after the fact on the meter page.
 */
function roundAmountWarning(amount: bigint): string | null {
  const fiveUsdc = 5n * USDC_DECIMALS_DIVISOR;
  if (amount === 0n || amount % fiveUsdc !== 0n) return null;
  const jitterCents = 1n + BigInt(Math.floor(Math.random() * 400)); // 0.01–4.00
  const suggested = amount + jitterCents * (USDC_DECIMALS_DIVISOR / 100n);
  return `${formatUsdc(amount)} USDC is a round amount — round numbers are the easiest ` +
    `linkability signal. Consider ${formatUsdc(suggested)} instead.`;
}

// --- transaction log: on-page, persisted to localStorage, downloadable ---

interface LogEntry {
  step: string;
  detail: string;
  txHash?: string;
  timestamp: string;
}

const LOG_STORAGE_KEY = "crosslink-wallet-tx-log";

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

let log: LogEntry[] = loadLog();

function logListEl(): HTMLElement {
  return document.getElementById("tx-log") as HTMLElement;
}

function renderLog(): void {
  logListEl().innerHTML = log
    .map((entry) => {
      const link = entry.txHash
        ? ` — <a href="https://voyager.online/tx/${entry.txHash}" target="_blank" rel="noopener noreferrer">${entry.txHash}</a>`
        : "";
      return `<li><strong>${entry.step}</strong> (${entry.timestamp}): ${entry.detail}${link}</li>`;
    })
    .join("");
}

function appendLog(entry: Omit<LogEntry, "timestamp">): void {
  log.push({ ...entry, timestamp: new Date().toISOString() });
  localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  renderLog();
}

function downloadLog(): void {
  const text = log
    .map((e) => `${e.timestamp}\t${e.step}\t${e.detail}${e.txHash ? `\t${e.txHash}` : ""}`)
    .join("\n");
  const blob = new Blob([text || "(empty)"], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crosslink-wallet-tx-log.txt";
  a.click();
  URL.revokeObjectURL(url);
}

// --- wallet connection ---

let connectedAccount: WalletAccountV6 | null = null;

async function connectWallet(wallet: WalletWithStarknetFeatures): Promise<void> {
  const statusEl = document.getElementById("connect-status") as HTMLElement;
  statusEl.textContent = `Checking ${wallet.name}'s STRK20 support…`;
  try {
    const versions = await walletV6.supportedWalletApi(wallet);
    const supported = versions.some((v) => compareVersions(v, MIN_WALLET_API_VERSION) >= 0);
    if (!supported) {
      statusEl.textContent = `${wallet.name} does not support wallet API >= ${MIN_WALLET_API_VERSION}.`;
      return;
    }
    statusEl.textContent = `Connecting to ${wallet.name}…`;
    connectedAccount = await WalletAccountV6.connect(createProvider(), wallet);
    statusEl.textContent = `Connected: ${connectedAccount.address}`;
    (document.getElementById("shield-section") as HTMLElement).hidden = false;
    (document.getElementById("transfer-section") as HTMLElement).hidden = false;
    (document.getElementById("transfer-recipient") as HTMLInputElement).value =
      connectedAccount.address;
  } catch (error) {
    statusEl.textContent = `Connect failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function renderWalletList(): Promise<void> {
  const listEl = document.getElementById("wallet-list") as HTMLElement;
  const store = createStore();
  const wallets = store.getWallets();
  if (wallets.length === 0) {
    listEl.innerHTML = "<p>No Starknet wallet extension detected.</p>";
    return;
  }
  listEl.innerHTML = "";
  for (const wallet of wallets) {
    const item = document.createElement("div");
    item.className = "wallet-list-item";
    item.textContent = wallet.name;
    item.addEventListener("click", () => void connectWallet(wallet));
    listEl.appendChild(item);
  }
}

// --- shield ---

function buildShieldActions(amountInput: HTMLInputElement): STRK20_ACTION[] {
  const amount = parseUsdc(amountInput.value || "0");
  return [{ type: "deposit", token: USDC_TOKEN_HEX, amount: toHex(amount) }];
}

function wireShieldForm(): void {
  const form = document.getElementById("shield-form") as HTMLFormElement;
  const amountInput = document.getElementById("shield-amount") as HTMLInputElement;
  const roundWarningEl = document.getElementById("shield-round-warning") as HTMLElement;
  const dryRunBtn = document.getElementById("shield-dry-run") as HTMLButtonElement;
  const submitBtn = document.getElementById("shield-submit") as HTMLButtonElement;
  const previewEl = document.getElementById("shield-preview") as HTMLElement;

  const updateRoundWarning = () => {
    const warning = roundAmountWarning(parseUsdc(amountInput.value || "0"));
    roundWarningEl.hidden = warning === null;
    roundWarningEl.textContent = warning ?? "";
  };
  amountInput.addEventListener("input", updateRoundWarning);
  updateRoundWarning();

  dryRunBtn.addEventListener("click", () => {
    void (async () => {
      if (!connectedAccount) return;
      previewEl.textContent = "Building dry-run proof…";
      try {
        const { call, proof } = await connectedAccount.strk20PrepareInvoke(
          buildShieldActions(amountInput),
          true,
        );
        previewEl.textContent =
          `Dry run OK. Call entrypoint: ${call.entrypoint}. Proof facts: ${proof.proof_facts.length}.`;
        submitBtn.disabled = false;
        appendLog({ step: "shield dry-run", detail: `${amountInput.value} USDC` });
      } catch (error) {
        previewEl.textContent = `Dry run failed: ${error instanceof Error ? error.message : String(error)}`;
        submitBtn.disabled = true;
      }
    })();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void (async () => {
      if (!connectedAccount) return;
      previewEl.textContent = "Submitting shield (may prompt more than once)…";
      try {
        const { transaction_hash } = await connectedAccount.strk20InvokeTransaction(
          buildShieldActions(amountInput),
        );
        previewEl.textContent = `Submitted: ${transaction_hash}`;
        appendLog({
          step: "shield",
          detail: `${amountInput.value} USDC`,
          txHash: transaction_hash,
        });
        submitBtn.disabled = true;
      } catch (error) {
        previewEl.textContent = `Shield failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    })();
  });
}

// --- private transfer, gated by the meter ---

function buildTransferActions(
  amountInput: HTMLInputElement,
  recipientInput: HTMLInputElement,
): STRK20_ACTION[] {
  const amount = parseUsdc(amountInput.value || "0");
  return [
    {
      type: "transfer",
      token: USDC_TOKEN_HEX,
      amount: toHex(amount),
      recipient: recipientInput.value.trim(),
    },
  ];
}

function wireTransferForm(): void {
  const amountInput = document.getElementById("transfer-amount") as HTMLInputElement;
  const recipientInput = document.getElementById("transfer-recipient") as HTMLInputElement;
  const scoreBtn = document.getElementById("transfer-score") as HTMLButtonElement;
  const verdictEl = document.getElementById("transfer-verdict") as HTMLElement;
  const dryRunBtn = document.getElementById("transfer-dry-run") as HTMLButtonElement;
  const submitBtn = document.getElementById("transfer-submit") as HTMLButtonElement;
  const sendAnywayBtn = document.getElementById("transfer-send-anyway") as HTMLButtonElement;
  const previewEl = document.getElementById("transfer-preview") as HTMLElement;

  let lastVerdict: MeterResult | null = null;

  scoreBtn.addEventListener("click", () => {
    void (async () => {
      scoreBtn.disabled = true;
      try {
        const window = await fetchPoolWindow(createProvider());
        const amount = parseUsdc(amountInput.value || "0");
        const result = scorePendingSend(window, { amount });
        lastVerdict = result;
        renderResult(verdictEl, result);
        const thin = result.verdict === "thin_pool";
        dryRunBtn.disabled = thin;
        submitBtn.hidden = thin;
        sendAnywayBtn.hidden = !thin;
      } finally {
        scoreBtn.disabled = false;
      }
    })();
  });

  async function runDryRun(): Promise<void> {
    if (!connectedAccount) return;
    previewEl.textContent = "Building dry-run proof…";
    try {
      const { call, proof } = await connectedAccount.strk20PrepareInvoke(
        buildTransferActions(amountInput, recipientInput),
        true,
      );
      previewEl.textContent =
        `Dry run OK. Call entrypoint: ${call.entrypoint}. Proof facts: ${proof.proof_facts.length}.`;
    } catch (error) {
      previewEl.textContent = `Dry run failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  dryRunBtn.addEventListener("click", () => void runDryRun());

  async function submitTransfer(overrideThinPool: boolean): Promise<void> {
    if (!connectedAccount) return;
    if (!lastVerdict) {
      previewEl.textContent = 'Score this send first.';
      return;
    }
    if (lastVerdict.verdict === "thin_pool" && !overrideThinPool) {
      previewEl.textContent = 'Blocked: thin pool. Use "Send anyway" to override.';
      return;
    }
    previewEl.textContent = "Submitting private transfer…";
    try {
      const { transaction_hash } = await connectedAccount.strk20InvokeTransaction(
        buildTransferActions(amountInput, recipientInput),
      );
      previewEl.textContent = `Submitted: ${transaction_hash}`;
      appendLog({
        step: overrideThinPool ? "transfer (sent anyway, thin pool)" : "transfer",
        detail: `${amountInput.value} USDC to ${recipientInput.value}`,
        txHash: transaction_hash,
      });
    } catch (error) {
      previewEl.textContent = `Transfer failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  submitBtn.addEventListener("click", () => void submitTransfer(false));
  sendAnywayBtn.addEventListener("click", () => void submitTransfer(true));
}

// --- init ---

renderLog();
(document.getElementById("log-download") as HTMLButtonElement).addEventListener(
  "click",
  downloadLog,
);
(document.getElementById("log-clear") as HTMLButtonElement).addEventListener("click", () => {
  log = [];
  localStorage.removeItem(LOG_STORAGE_KEY);
  renderLog();
});

wireShieldForm();
wireTransferForm();
renderWalletList().catch((error: unknown) => {
  const listEl = document.getElementById("wallet-list") as HTMLElement;
  listEl.innerHTML = `<p class="error">Could not detect wallets: ${
    error instanceof Error ? error.message : String(error)
  }</p>`;
});
