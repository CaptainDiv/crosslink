# Crosslink — DESIGN.md

Structural reference: [Resvyn](https://resvyn.vercel.app) — proof-first architecture (live evidence
before claims, receipts tables, negative proofs, guided walkthrough with simulated/real labeling).
Palette, type, and component language below are **not** borrowed from Resvyn — they are the tokens
already shipping in `apps/web/src/style.css`, extended only where a new structural pattern needs a
component that didn't exist yet. If a token isn't listed as new, it already exists and is unchanged.

This document describes the system. It does not add features beyond what `CLAUDE.md` scopes in.

---

## 1. Base tokens (existing — unchanged)

```css
--bg: #0b0d12;
--surface: #151824;
--border: #2a2f3f;
--text: #e8eaf0;
--text-dim: #9aa1b5;
--accent: #6ea8fe;
--clear: #3ecf8e;         /* verdict: privacy holds */
--flagged: #f5a623;       /* verdict: privacy is weak */
--not-evaluated: #6b7180; /* signal not run / no data */
--btn-text: #0b0d12;
--font-mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;
--radius-sm: 4px;
--radius: 6px;
--label-tracking: 0.08em;
```

Light-mode overrides (already present, WCAG-adjusted) stay as-is. `color-scheme` respects system
preference; there is no manual theme toggle and this redesign doesn't add one.

**No new color tokens.** Every new component below reuses `--clear` / `--flagged` /
`--not-evaluated` / `--accent` on their existing meaning. A "negative proof" is not a new color —
see §4.

## 2. Typography (existing — unchanged)

- Body/UI: system-ui stack, no custom font load.
- Data — hashes, addresses, amounts, block numbers, event names, log lines — always
  `var(--font-mono)`. This is already the rule (`.mono`, `.tx-log`, the wallet status lines); the
  new receipts table and event log inherit it rather than introducing a second mono treatment.
- Labels/eyebrows: `text-transform: uppercase; letter-spacing: var(--label-tracking); font-weight:
  600;` at `0.7–0.85rem` — already the pattern for `.verdict-label`, `.signal-status`,
  `.hero-kicker`. Numbered walkthrough steps and the invariant badge reuse this, not a new label
  style.

## 3. Spacing & layout (existing, one extension)

- Base rhythm stays 4px/0.25rem increments, `.page { max-width: 720px }` for prose pages.
- **New:** the Proof page's receipts table needs room a 720px column can't give a 6-column table.
  Extend the existing "page has one wide exception" pattern (already used for `#live-result`'s
  larger verdict card) with `.page--wide { max-width: 960px }` applied to `proof.html`'s `<main>`
  only. Nothing else on that page changes width.
- Border radius, focus rings, reduced-motion handling: unchanged, apply everywhere including new
  pages.

## 4. New components (structural, tokens reused)

### 4.1 Invariant badge (homepage)
A neutral pill under the hero line stating a real hard rule — not a marketing claim, a fact that's
either true on-chain right now or it isn't. Visually: extend `.hypothetical-tag`'s existing
hairline-border-pill treatment (`border: 1px solid var(--border); color: var(--text-dim);` uppercase,
tracked) rather than inventing a new pill style — the honesty register (plain text, no color-coding)
is exactly what that class already expresses for "this number is hypothetical."

**Copy: "No screening, no deposit."** — pulled directly from `CLAUDE.md`'s Screening section
("Every deposit is screened by FPI and verified on-chain... A structurally valid deposit that
reverts is screening first, everything else second."). It's checkable, not aspirational — the
recommended invariant. Alternative considered and rejected for this slot: "No mainnet hash, no
privacy claim" (true, but it's a rule about *our* conduct, not the pool's — better suited to the
Proof page's negative-proofs framing, §4.3, than the hero).

### 4.2 Live meter result (homepage) — already exists
`index.html`'s `#pool-stats` → `#score-form` → `#result` sequence *is* "hero, then immediately the
live meter result, not a screenshot" — it already fetches `fetchPoolWindow` on load and renders a
real `.verdict` card. No new component; the redesign reorders what's already there so the hero
headline + invariant badge sit above it, and trims anything between the hero and the form to zero.

### 4.3 Receipts table (Proof page) — new
Extends `.tx-log`'s existing pattern (bordered rows, `font-mono`, `overflow-wrap: anywhere`, link
color `var(--accent)`) into a table:

```
Step | Value | Block | Gas | Status | Tx
```

- `<table>` with `border-collapse: collapse`, row divider `1px solid var(--border)` (same weight as
  `.tx-log li`), no zebra striping, no shadows — matches the flat hairline language already in use.
- **Status column** is not a verdict color. It's binary and factual: `confirmed` renders in
  `--text-dim` with a small `--clear` dot, nothing renders in `--flagged` in this column — a
  confirmed tx isn't a privacy judgment, it's a receipt. Keep the verdict palette reserved for
  verdicts (§4.4), or "confirmed" starts reading like "clear" and the honesty rules blur.
- Populated from `strk20.json`'s three real hashes. Block/gas are **not yet recorded** —
  `docs/TRANSACTIONS.md` is empty; block number and gas must be pulled live via
  `starknet_getTransactionReceipt` for each of the three hashes before this table can render real
  numbers. This is a data-gathering step, not a design decision — flagged in the sitemap below as a
  prerequisite for building this page, and the table must render only the columns it actually has
  populated rather than leaving `Gas` blank-but-present if that data turns out unavailable on
  Starknet receipts (unlike Resvyn's EVM gas column, Starknet receipts report `actual_fee`, not raw
  gas — the column may need to read `Fee` instead of `Gas`, resolved during implementation).
- Only three rows. Resvyn's five-row lifecycle is not something to pad toward — three real
  transactions is what's true today (Registration, Shield, Private transfer; no withdrawal leg has
  happened yet). The honesty rule ("never claim a corridor works without a mainnet hash to prove
  it") means the table shows exactly what's proven, nothing implied.

### 4.4 Negative proofs section (Proof page) — reuses `.verdict` + `.signal-card`, new framing only
This is **not** a new visual component — the thin-pool refusal already renders as a `.verdict
verdict-thin_pool` card with `--flagged` border today, every time the live pool is thin (which,
per `CLAUDE.md`, it currently is). The only new work is running the live scorer against the current
pool window a second time on this page under a "Negative proofs" heading, with copy that reframes
the *same* flagged verdict from "your send is weak right now" (index.html's framing) to "the meter
correctly refuses when asked, on real live data, right now" (proof-page framing). Two framings of
one honest fact, not two components.

One addition: a small `--clear`-green "guardrail fired correctly" meta-badge sits above the
`.verdict` card, using the same pill treatment as §4.1. It answers a different question than the
verdict color does — the verdict card says privacy is weak (amber, bad news about the pool); the
meta-badge says the meter's refusal logic is working as designed (green, good news about the tool).
Conflating those into one color would misrepresent one of them.

### 4.5 Re-verify live (Proof page) — new, reuses `.button-row button`
A button that re-runs `fetchPoolWindow` on click and replaces the receipts/negative-proof numbers
in place — no page reload. Visually the existing primary button style. State machine, three states,
each an existing pattern:
- idle → label "Re-verify live"
- pending → label "Checking pool…", button `disabled` (existing `:disabled { opacity: 0.4 }` rule)
- done → label reverts to "Re-verify live", a `Last verified <relative time>` line appears in
  `--text-dim`, `font-mono` for the timestamp.

No spinner graphic — the disabled-button label change *is* the loading state, consistent with "no
decorative motion."

### 4.6 Numbered walkthrough steps (Playground) — new, reuses label pattern
Each step is a `.signal-card`-style bordered block (not `--not-evaluated` left-border — a plain
`var(--border)` left edge until active, then `--accent`) with a `font-mono` two-digit number (`01`,
`02`…) in place of `.signal-status`'s uppercase word. Active step gets the accent left-border;
completed steps keep a static checkmark glyph, not an animation.

### 4.7 Event log (Playground) — new, reuses `.tx-log`
Directly reuses `.tx-log`'s existing list styling (bordered rows, mono, link-colored tx references).
Each entry appended on step-advance; the CSS is unchanged, only the JS driving it is new.

### 4.8 Simulated vs. real labeling (Playground) — reuses `.hypothetical-tag`
The depth-slider demo on `playground.html` (step 02) already tags synthetic data with exactly this
pill (`SIMULATED`-equivalent). Extend the same tag to every walkthrough step: `SIMULATED` in the
existing neutral hairline style, and a second variant `REAL` using `--clear` text instead of
`--text-dim` — the one place in the walkthrough allowed to look "good," because it's linking to an
actual mainnet hash, not asserting a privacy verdict.

### 4.9 Code blocks (Docs page) — new, no new tokens
No `<pre>`/`<code>` styling exists yet. Add:
```css
pre {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.85rem;
}
```
No syntax highlighting (no highlighter dependency, no chromatic accent per token — one more surface
where color would read as decoration the honesty register doesn't want). Matches the restraint
already established by `.tx-log` and the wallet status lines: data reads as mono text on a flat
surface, nothing more.

## 5. Animation — unchanged rule, now stated explicitly

The only animations in `style.css` are `verdict-enter` (180ms fade/slide-up on new verdict content)
and `skeleton-pulse` (loading placeholder), both already gated by
`prefers-reduced-motion`. Every new interaction — re-verify updating a number, a walkthrough step
advancing — uses `verdict-enter` on the changed element and nothing else. No page-load animation, no
hover transforms beyond the existing `:hover` border-color changes, no scroll-triggered motion. This
was already the site's rule; this redesign doesn't relax it anywhere new.

## 6. What this redesign does not touch

- Verdict colors and their meaning (§4 is explicit about not adding a fourth semantic color).
- The scoring logic, `@crosslink/meter` package, or `/api/score` contract.
- Wallet flow pages (`wallet.html` / `wallet.ts`) beyond the nav relabel to "Launch app" — that page
  is out of scope for this pass.
