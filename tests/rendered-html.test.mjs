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
  assert.match(app, /Live sources connected/i);
  assert.match(app, /Sources checked\. No new evidence/i);
  assert.match(app, /No new source changes/i);
  assert.match(app, /Change inbox/i);
  assert.doesNotMatch(`${app}\n${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships production metadata, persistence declaration, and no starter surface", async () => {
  const [layout, packageJson, hosting, worker] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /\/og\.jpg/);
  assert.match(layout, /\/favicon\.png/);
  assert.match(layout, /summary_large_image/);
  assert.doesNotMatch(layout, /next\/font\/google|fonts\.googleapis/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /Strict-Transport-Security/);
  assert.match(worker, /url\.protocol === "http:"/);
  assert.match(worker, /caches as CacheStorage/);
  assert.match(worker, /s-maxage=300/);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, null);
  assert.match(hostingConfig.project_id, /^appgprj_[a-z0-9]+$/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/og.jpg", import.meta.url));
  await access(new URL("../public/favicon.png", import.meta.url));
  await access(new URL("../public/favicon.ico", import.meta.url));
});

test("user-facing copy preserves the analytical boundary", async () => {
  const source = await readFile(new URL("../app/PoolSignalApp.tsx", import.meta.url), "utf8");
  assert.match(source, /Certification changes do not imply licensing status/i);
  assert.match(source, /Certification counts are never treated as shipment volume/i);
  assert.match(source, /No external actions enabled/i);
  assert.doesNotMatch(source, /is unlicensed|is infringing|owes royalties/i);
});

test("interactive controls call real bounded APIs and label public previews honestly", async () => {
  const [app, agentRoute, reviewRoute] = await Promise.all([
    readFile(new URL("../app/PoolSignalApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent-runs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/reviews/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /fetch\("\/api\/agent-runs"/);
  assert.match(app, /Previewed locally — no database write/);
  assert.match(app, /persistedDecisions/);
  assert.match(app, /setQueueSort\("newest"\)/);
  assert.match(app, /Search synthetic brand, Qi ID, product, or part number/);
  assert.match(agentRoute, /runAgentCycle/);
  assert.match(reviewRoute, /reviewerAuthorization/);
  assert.match(reviewRoute, /authenticated-reviewer/);
  assert.doesNotMatch(reviewRoute, /detail:/);
});

test("live public-source monitoring is wired to change-driven, idempotent processing", async () => {
  const [app, liveRoute, changeRoute, viaRoute, liveStore, liveData, changeProcessor, agentRoute, worker, wrangler, viaWorkflow, sourceMigration, changeMigration] = await Promise.all([
    readFile(new URL("../app/PoolSignalApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/live-data/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/change-events/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/live-data/via-snapshot/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/live-store.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/live-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/change-processor.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent-runs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/via-snapshot.yml", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_live_public_sources.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_change_driven_processing.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /Latest WPC certifications/);
  assert.match(app, /Live public · synthetic operations/);
  assert.match(app, /IMMUTABLE AUDIT LEDGER/);
  assert.match(app, /No new source changes/);
  assert.doesNotMatch(app, /Run latest live cycle|Rerun latest live cycle|Run agents on/);
  assert.match(app, /SYNTHETIC REVIEW WORKFLOW/);
  assert.match(app, /ILLUSTRATIVE MARKET SIGNAL/);
  assert.doesNotMatch(app, /<strong>08<\/strong>/);
  assert.match(liveRoute, /reviewerAuthorization/);
  assert.match(changeRoute, /reviewerAuthorization/);
  assert.match(changeProcessor, /idempotencyKey/);
  assert.match(changeProcessor, /dead_letter/);
  assert.match(agentRoute, /Direct live reruns are disabled/);
  assert.match(viaRoute, /verifyGitHubActionsOidc/);
  assert.match(viaRoute, /MAX_BODY_BYTES/);
  assert.match(liveStore, /GLEIF_API_URL/);
  assert.match(liveData, /api\.gleif\.org/);
  assert.match(liveData, /ajax\/products\/qi/);
  assert.match(worker, /scheduled\(/);
  assert.match(worker, /processPendingSourceChanges/);
  assert.match(wrangler, /0 \*\/6 \* \* \*/);
  assert.match(viaWorkflow, /30 10 \* \* \*/);
  assert.match(viaWorkflow, /id-token: write/);
  assert.match(sourceMigration, /CREATE TABLE `live_products`/);
  assert.match(changeMigration, /CREATE TABLE `source_change_events`/);
  assert.match(changeMigration, /CREATE TABLE `live_agent_runs`/);
});
