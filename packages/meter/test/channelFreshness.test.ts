import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreChannelFreshness } from "../src/signals/channelFreshness.ts";
import { healthyWindow, thinWindow } from "./fixtures.ts";

test("plenty of recent note-creation activity is clear", () => {
  const result = scoreChannelFreshness(healthyWindow());
  assert.equal(result.status, "clear");
});

test("almost no recent note-creation activity is flagged", () => {
  const result = scoreChannelFreshness(thinWindow());
  assert.equal(result.status, "flagged");
});
