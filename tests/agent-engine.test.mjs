import assert from "node:assert/strict";
import test from "node:test";

import { runAgentCycle } from "../lib/agent-engine.ts";
import { reviewCases } from "../lib/demo-data.ts";

test("bounded agent cycle abstains when entity confidence is insufficient", () => {
  const result = runAgentCycle(reviewCases[0], new Date("2026-07-14T12:00:00Z"));
  assert.equal(result.caseId, "case-hx-27167");
  assert.equal(result.status, "review_required");
  assert.equal(result.requiresHuman, true);
  assert.equal(result.trace.length, 5);
  assert.equal(result.trace.at(-1).status, "waiting");
  assert.equal(result.persisted, false);
});

test("bounded agent cycle permits monitoring for high-confidence public matches", () => {
  const result = runAgentCycle(reviewCases[4], new Date("2026-07-14T12:00:00Z"));
  assert.equal(result.status, "monitor");
  assert.equal(result.requiresHuman, false);
  assert.deepEqual(result.permittedActions, ["monitor"]);
});

test("agent output preserves the legal and coverage language boundary", () => {
  for (const item of reviewCases) {
    const output = runAgentCycle(item, new Date("2026-07-14T12:00:00Z")).trace.map((step) => step.output).join(" ").toLowerCase();
    assert.doesNotMatch(output, / is unlicensed| is infringing| owes royalties/);
  }
});
