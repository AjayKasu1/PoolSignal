import { ensureLiveSchema, getD1 } from "../../../db";
import { getLiveData, refreshLiveSources, type LiveSource } from "../../../lib/live-store";
import { reviewerAuthorization } from "../../../lib/reviewer-auth";
import { processPendingSourceChanges } from "../../../lib/change-processor";

const jsonHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const allowedSources = new Set<LiveSource>(["wpc"]);

export async function GET(request: Request) {
  try {
    await ensureLiveSchema();
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? "8");
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 8;
    return Response.json(await getLiveData(getD1(), limit), { headers: jsonHeaders });
  } catch {
    return Response.json({
      signals: [],
      status: {
        mode: "unavailable",
        generatedAt: new Date().toISOString(),
        wpc: { lastSuccessAt: null, totalRecords: 0, monitoredRecords: 0, new30d: 0, newestCertificationDate: null },
        via: { lastSuccessAt: null, licenseeCount: 0 },
        gleif: { mode: "on-demand", cachedQueries: 0 },
      },
      changeFeed: {
        baselineAt: null, trackedProducts: 0, pendingCount: 0, processingCount: 0,
        retryCount: 0, deadLetterCount: 0, completed30d: 0, lastDetectedAt: null,
        lastProcessedAt: null, agentVersion: "live-agent-v1", policyVersion: "licensing-policy-v1", recent: [],
      },
    }, { status: 503, headers: jsonHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const authorization = reviewerAuthorization(request);
    if (!authorization.configured) return Response.json({ error: "Live refresh is disabled" }, { status: 503, headers: jsonHeaders });
    if (!authorization.authorized) {
      return Response.json({ error: "Reviewer authorization is required" }, {
        status: 401,
        headers: { ...jsonHeaders, "WWW-Authenticate": "Bearer realm=\"PoolSignal reviewer\"" },
      });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Content-Type must be application/json" }, { status: 415, headers: jsonHeaders });
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 1_024) return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1_024) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }
    let payload: { sources?: unknown };
    try {
      payload = JSON.parse(rawBody) as { sources?: unknown };
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400, headers: jsonHeaders });
    }
    const requested = Array.isArray(payload.sources) ? payload.sources : ["wpc"];
    if (requested.length !== 1 || requested.some((source) => typeof source !== "string" || !allowedSources.has(source as LiveSource))) {
      return Response.json({ error: "Manual refresh currently supports wpc" }, { status: 400, headers: jsonHeaders });
    }
    await ensureLiveSchema();
    const results = await refreshLiveSources(getD1(), requested as LiveSource[]);
    const processing = await processPendingSourceChanges(getD1(), { limit: 3 });
    return Response.json({ results, processing, refreshedAt: new Date().toISOString() }, { headers: jsonHeaders });
  } catch (error) {
    console.error("PoolSignal live-source refresh failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "The live-source refresh could not be completed" }, { status: 502, headers: jsonHeaders });
  }
}
