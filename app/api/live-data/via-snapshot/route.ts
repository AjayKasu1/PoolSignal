import { ensureLiveSchema, getD1 } from "../../../../db";
import { verifyGitHubActionsOidc } from "../../../../lib/github-oidc";
import { VIA_QI_URL, validateViaLicensees } from "../../../../lib/live-data";
import { ingestViaSnapshot } from "../../../../lib/live-store";

const jsonHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const MAX_BODY_BYTES = 64 * 1_024;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const oidcToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    let authorized = false;
    try {
      authorized = await verifyGitHubActionsOidc(oidcToken);
    } catch (error) {
      console.error("PoolSignal GitHub identity validation failed", error instanceof Error ? error.message : "Unknown error");
      return Response.json({ error: "Ingestion identity validation is unavailable" }, { status: 503, headers: jsonHeaders });
    }
    if (!authorized) {
      return Response.json({ error: "Ingestion authorization is required" }, {
        status: 401,
        headers: { ...jsonHeaders, "WWW-Authenticate": "Bearer realm=\"PoolSignal ingestion\"" },
      });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Content-Type must be application/json" }, { status: 415, headers: jsonHeaders });
    }
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }

    let payload: { sourceUrl?: unknown; checksum?: unknown; capturedAt?: unknown; licensees?: unknown };
    try {
      payload = JSON.parse(rawBody) as typeof payload;
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400, headers: jsonHeaders });
    }
    const checksum = typeof payload.checksum === "string" ? payload.checksum.toLowerCase() : "";
    const capturedAt = typeof payload.capturedAt === "string" ? payload.capturedAt : "";
    const capturedTime = Date.parse(capturedAt);
    if (payload.sourceUrl !== VIA_QI_URL || !/^[a-f0-9]{64}$/.test(checksum)
      || !Number.isFinite(capturedTime) || Math.abs(Date.now() - capturedTime) > 600_000) {
      return Response.json({ error: "Snapshot metadata is invalid" }, { status: 400, headers: jsonHeaders });
    }
    let licensees: string[];
    try {
      licensees = validateViaLicensees(payload.licensees);
    } catch {
      return Response.json({ error: "Snapshot records failed validation" }, { status: 400, headers: jsonHeaders });
    }

    await ensureLiveSchema();
    const result = await ingestViaSnapshot(getD1(), licensees, checksum, new Date(capturedTime).toISOString());
    return Response.json({ result }, { headers: jsonHeaders });
  } catch (error) {
    console.error("PoolSignal Via snapshot ingestion failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "The Via snapshot could not be ingested" }, { status: 502, headers: jsonHeaders });
  }
}
