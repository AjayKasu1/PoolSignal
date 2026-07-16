import assert from "node:assert/strict";
import test from "node:test";

import { canonicalProductRecord, changedProductFields, normalizeEntityName, parseViaLicensees, parseWpcFeed, scoreEntityName, validateViaLicensees } from "../lib/live-data.ts";

test("WPC parser retains recent typed products and rejects malformed rows", () => {
  const parsed = parseWpcFeed([
    [27607, "Niophie", "Niophie 4 in 1", "Nio01", "PTx product", "MPP + BPP", "15", "2.0.1", "2026-07-15"],
    [12691, "ConvenientPower", "CPS4038 EVB", "CPS4038", "PRx product", "BPP", "5", "1.3.2", "2022-06-10"],
    ["bad", "Broken", "Record", "", "invalid", "", "x", "", "not-a-date"],
  ], "abc123", new Date("2026-07-15T12:00:00Z"));

  assert.equal(parsed.totalRecords, 3);
  assert.equal(parsed.retainedRecords.length, 1);
  assert.equal(parsed.retainedRecords[0].qiId, "QI-27607");
  assert.equal(parsed.retainedRecords[0].productType, "PTx");
  assert.equal(parsed.retainedRecords[0].sourceChecksum, "abc123");
  assert.equal(parsed.rejectedRecords, 1);
});

test("Via parser extracts only the bounded public licensee list", () => {
  const names = Array.from({ length: 25 }, (_, index) => `<li>Example Entity ${index + 1} Ltd.</li>`).join("");
  const html = `<div id="licList"><ul>${names}<li>Bang &amp; Olufsen A/S</li></ul></div><div id="licensors"><li>Not a licensee</li></div>`;
  const parsed = parseViaLicensees(html);
  assert.equal(parsed.length, 26);
  assert.equal(parsed.at(-1), "Bang & Olufsen A/S");
  assert.doesNotMatch(parsed.join(" "), /Not a licensee/);
});

test("Via snapshot validation rejects duplicate or undersized publications", () => {
  const valid = Array.from({ length: 20 }, (_, index) => `Entity ${index + 1} Ltd.`);
  assert.equal(validateViaLicensees(valid).length, 20);
  assert.throws(() => validateViaLicensees([...valid, valid[0]]), /unique/);
  assert.throws(() => validateViaLicensees(valid.slice(0, 19)), /record-count/);
});

test("entity scoring normalizes corporate suffixes but preserves ambiguity", () => {
  assert.equal(normalizeEntityName("Tesla, Inc."), "tesla");
  assert.equal(scoreEntityName("Tesla", "Tesla, Inc."), 0.98);
  assert.ok(scoreEntityName("ConvenientPower", "ConvenientPower HK Limited") < 0.85);
  assert.ok(scoreEntityName("Apple", "APPLE DEVELOPERS") < 0.85);
  assert.ok(scoreEntityName("HX", "Unrelated Holdings LLC") < 0.5);
});

test("product change detection ignores transport metadata and identifies material fields", () => {
  const before = {
    qiId: "QI-27607", brand: "Niophie", productName: "Niophie 4 in 1", partNumber: "Nio01",
    productType: "PTx", powerProfile: "MPP + BPP", loadPower: 15, version: "2.0.1",
    certificationDate: "2026-07-15", sourceUrl: "https://example.com/27607", sourceChecksum: "snapshot-a",
  };
  const transportOnly = { ...before, sourceChecksum: "snapshot-b", lastSeenAt: "2026-07-16T00:00:00Z" };
  assert.deepEqual(changedProductFields(canonicalProductRecord(before), canonicalProductRecord(transportOnly)), []);
  const materialUpdate = { ...transportOnly, loadPower: 25, powerProfile: "MPP25 + BPP" };
  assert.deepEqual(changedProductFields(canonicalProductRecord(before), canonicalProductRecord(materialUpdate)), ["powerProfile", "loadPower"]);
  assert.equal(changedProductFields(null, canonicalProductRecord(before)).length, 9);
});
