/**
 * GET /api/score?amount=247.50[&fundedAt=<unix-seconds>]
 *
 * Scores a pending send against the live STRK20 mainnet pool and returns the
 * verdict plus all five signals. Same scoring code as the pages — this imports
 * @crosslink/meter rather than reimplementing anything.
 *
 * Open CORS: the point is that any protocol can call this from its own frontend
 * before it promises a user that a payment is private.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  createProvider,
  fetchPoolWindow,
  parseUsdc,
  scorePendingSend,
  POOL_ADDRESS,
  type PoolWindow,
} from "@crosslink/meter";

/**
 * How long a fetched window is served before we refetch. A full fetch scans
 * ~100k blocks of pool events and measured ~12s against the public RPC, so this
 * is not a micro-optimisation — without it every request pays that cost and the
 * public RPC gets hammered. The pool's own window is ~48h wide, so a minute of
 * staleness changes nothing a caller would notice.
 */
const CACHE_TTL_MS = 60_000;

const MAX_AMOUNT_UNITS = 10n ** 18n; // 1 trillion USDC — anything beyond is a typo, not a payment.

interface CachedWindow {
  window: PoolWindow;
  fetchedAt: number;
}

// Module scope survives across invocations on a warm instance.
let cache: CachedWindow | null = null;
let inFlight: Promise<PoolWindow> | null = null;

async function refresh(): Promise<PoolWindow> {
  // De-duplicate concurrent misses: without this, N simultaneous cold requests
  // each start their own ~12s fetch against the same RPC.
  if (inFlight) return inFlight;
  const provider = createProvider(process.env.STARKNET_RPC || undefined);
  inFlight = fetchPoolWindow(provider)
    .then((window) => {
      cache = { window, fetchedAt: Date.now() };
      return window;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Returns a window and whether it is stale. If the RPC fails but we still hold a
 * previously fetched window, that one is served and flagged `stale` rather than
 * failing the request — but it is always flagged, never passed off as current.
 */
async function getWindow(): Promise<{ window: PoolWindow; fetchedAt: number; stale: boolean }> {
  const fresh = cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (cache !== null && fresh) {
    return { window: cache.window, fetchedAt: cache.fetchedAt, stale: false };
  }
  try {
    const window = await refresh();
    const fetchedAt = cache?.fetchedAt ?? Date.now();
    return { window, fetchedAt, stale: false };
  } catch (error) {
    if (cache !== null) {
      return { window: cache.window, fetchedAt: cache.fetchedAt, stale: true };
    }
    throw error;
  }
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(
  res: ServerResponse,
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries({
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
    ...extraHeaders,
  })) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(body, null, 2));
}

function fail(res: ServerResponse, status: number, error: string, hint?: string): void {
  json(res, { error, ...(hint === undefined ? {} : { hint }) }, status, {
    "Cache-Control": "no-store",
  });
}

const USAGE = "GET /api/score?amount=247.50 — amount is USDC, optionally &fundedAt=<unix-seconds>";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [key, value] of Object.entries(CORS_HEADERS)) res.setHeader(key, value);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    return fail(res, 405, `Method ${req.method} not allowed.`, USAGE);
  }

  // Vercel's Node runtime gives a relative req.url ("/api/score?amount=…"), so a
  // base is required — `new URL(req.url)` alone throws ERR_INVALID_URL here.
  const params = new URL(req.url ?? "/", "http://localhost").searchParams;

  const rawAmount = params.get("amount");
  if (rawAmount === null || rawAmount.trim() === "") {
    return fail(res, 400, "Missing required query parameter: amount.", USAGE);
  }

  let amount: bigint;
  try {
    amount = parseUsdc(rawAmount);
  } catch {
    return fail(res, 400, `Not a valid USDC amount: ${JSON.stringify(rawAmount)}.`, USAGE);
  }
  if (amount <= 0n) {
    return fail(res, 400, "amount must be greater than zero.", USAGE);
  }
  if (amount > MAX_AMOUNT_UNITS) {
    return fail(res, 400, "amount is implausibly large.", USAGE);
  }

  let fundedAt: number | undefined;
  const rawFundedAt = params.get("fundedAt");
  if (rawFundedAt !== null && rawFundedAt.trim() !== "") {
    fundedAt = Number(rawFundedAt);
    if (!Number.isFinite(fundedAt) || !Number.isInteger(fundedAt) || fundedAt <= 0) {
      return fail(res, 400, "fundedAt must be a positive integer (unix seconds).", USAGE);
    }
  }

  let window: PoolWindow;
  let fetchedAt: number;
  let stale: boolean;
  try {
    ({ window, fetchedAt, stale } = await getWindow());
  } catch (error) {
    // No cached window to fall back on — say so plainly rather than emit a stack trace.
    return fail(
      res,
      503,
      "Could not reach the Starknet RPC to read the pool, and no recent window is cached.",
      error instanceof Error ? error.message : String(error),
    );
  }

  const result = scorePendingSend(window, { amount, ...(fundedAt === undefined ? {} : { fundedAt }) });

  return json(
    res,
    {
      amount: { usdc: rawAmount.trim(), units: amount.toString() },
      verdict: result.verdict,
      headline: result.headline,
      detail: result.detail,
      signals: result.signals.map((signal) => ({
        id: signal.id,
        status: signal.status,
        headline: signal.headline,
        detail: signal.detail,
        ...(signal.value === undefined ? {} : { value: signal.value }),
      })),
      poolWindow: {
        pool: `0x${POOL_ADDRESS.toString(16).padStart(64, "0")}`,
        fromBlock: window.fromBlock,
        toBlock: window.toBlock,
        latestBlock: window.latestBlock,
        avgBlockTimeSeconds: Number(window.avgBlockTimeSeconds.toFixed(3)),
        usdcDepositCount: window.usdcDeposits.length,
        usdcWithdrawalCount: window.usdcWithdrawals.length,
        noteCreationCount: window.noteCreations.length,
      },
      meta: {
        fetchedAt: new Date(fetchedAt).toISOString(),
        ageSeconds: Math.max(0, Math.round((Date.now() - fetchedAt) / 1000)),
        stale,
        docs: "https://github.com/CaptainDiv/crosslink#integrate",
      },
    },
    200,
    {
      // Let Vercel's edge serve repeat calls without invoking this at all, and
      // serve a slightly stale copy instantly while revalidating behind it.
      "Cache-Control": stale
        ? "no-store"
        : "public, s-maxage=60, stale-while-revalidate=300",
    },
  );
}
