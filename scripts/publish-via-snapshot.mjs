import { createHash } from "node:crypto";
import { parseViaLicensees, VIA_QI_URL } from "../lib/live-data.ts";

function reportFailure(error) {
  const message = (error instanceof Error ? error.message : String(error)).replace(/[\r\n%]/g, " ").slice(0, 300);
  console.error(`::error title=Via snapshot publisher::${message}`);
  process.exitCode = 1;
}

process.on("uncaughtException", reportFailure);
process.on("unhandledRejection", reportFailure);

const oidcRequestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim();
const oidcRequestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim();
if (!oidcRequestUrl || !oidcRequestToken) throw new Error("GitHub Actions OIDC is required");

const oidcUrl = new URL(oidcRequestUrl);
oidcUrl.searchParams.set("audience", "poolsignal-via-ingest");
const oidcResponse = await fetch(oidcUrl, {
  headers: { Authorization: `Bearer ${oidcRequestToken}` },
  signal: AbortSignal.timeout(10_000),
});
if (!oidcResponse.ok) throw new Error(`GitHub OIDC returned HTTP ${oidcResponse.status}`);
const oidcToken = (await oidcResponse.json()).value;
if (typeof oidcToken !== "string" || oidcToken.length > 12_000) throw new Error("GitHub OIDC token is invalid");
console.log("Acquired short-lived GitHub workflow identity.");

const sourceResponse = await fetch(VIA_QI_URL, {
  headers: {
    Accept: "text/html",
    "User-Agent": "PoolSignal/0.2 (+https://github.com/AjayKasu1/PoolSignal)",
  },
  signal: AbortSignal.timeout(45_000),
});
if (!sourceResponse.ok) throw new Error(`Via source returned HTTP ${sourceResponse.status}`);
const declaredLength = Number(sourceResponse.headers.get("content-length") ?? "0");
if (declaredLength > 3_000_000) throw new Error("Via source exceeded the size contract");
const html = await sourceResponse.text();
if (new TextEncoder().encode(html).byteLength > 3_000_000) throw new Error("Via source exceeded the size contract");

const licensees = parseViaLicensees(html);
console.log(`Validated ${licensees.length} names from the official Via page.`);
const checksum = createHash("sha256").update(html).digest("hex");
const appOrigin = (process.env.POOLSIGNAL_ORIGIN ?? "https://poolsignal.ajaykasu7.workers.dev").replace(/\/$/, "");
const ingestResponse = await fetch(`${appOrigin}/api/live-data/via-snapshot`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${oidcToken}` },
  body: JSON.stringify({ sourceUrl: VIA_QI_URL, checksum, capturedAt: new Date().toISOString(), licensees }),
  signal: AbortSignal.timeout(30_000),
});
const result = await ingestResponse.json();
if (!ingestResponse.ok) throw new Error(`PoolSignal ingest returned HTTP ${ingestResponse.status}`);
console.log(`Published ${result.result.licenseeCount} Via public names to PoolSignal.`);
