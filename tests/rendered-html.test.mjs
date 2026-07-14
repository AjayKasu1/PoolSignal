import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("production build contains the PoolSignal intelligence console", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const [app, layout] = await Promise.all([
    readFile(new URL("../app/PoolSignalApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /PoolSignal — Qi Licensing Intelligence/i);
  assert.match(app, /Evidence graph live/i);
  assert.match(app, /A review-worthy signal surfaced/i);
  assert.match(app, /Run intelligence cycle/i);
  assert.match(app, /HUMAN REVIEW GATE/i);
  assert.doesNotMatch(`${app}\n${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships production metadata, persistence declaration, and no starter surface", async () => {
  const [layout, packageJson, hosting] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /\/og\.png/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(hostingConfig.project_id, /^appgprj_[a-z0-9]+$/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/og.png", import.meta.url));
});

test("user-facing copy preserves the analytical boundary", async () => {
  const source = await readFile(new URL("../app/PoolSignalApp.tsx", import.meta.url), "utf8");
  assert.match(source, /before making a licensing conclusion/i);
  assert.match(source, /Certification counts are never treated as shipment volume/i);
  assert.match(source, /No external actions enabled/i);
  assert.doesNotMatch(source, /is unlicensed|is infringing|owes royalties/i);
});
