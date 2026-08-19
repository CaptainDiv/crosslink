import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreUserLinkageWarning } from "../src/signals/warnings.ts";
import type { SignalResult } from "../src/types.ts";

function signal(id: SignalResult["id"], status: SignalResult["status"]): SignalResult {
  return { id, status, headline: "", detail: "" };
}

test("no flagged signals means no warning", () => {
  const result = scoreUserLinkageWarning([
    signal("amount_uniqueness", "clear"),
    signal("timing_correlation", "clear"),
    signal("plausible_set", "clear"),
  ]);
  assert.equal(result.status, "clear");
});

test("one flagged signal alone does not trip the warning", () => {
  const result = scoreUserLinkageWarning([
    signal("amount_uniqueness", "flagged"),
    signal("timing_correlation", "clear"),
    signal("plausible_set", "clear"),
  ]);
  assert.equal(result.status, "clear");
});

test("two or more flagged signals trips a USER_LINKAGE-style warning", () => {
  const result = scoreUserLinkageWarning([
    signal("amount_uniqueness", "flagged"),
    signal("timing_correlation", "flagged"),
    signal("plausible_set", "clear"),
  ]);
  assert.equal(result.status, "flagged");
});
