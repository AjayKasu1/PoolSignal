import { ensureLiveSchema, getD1 } from "../../../db";
import { processPendingSourceChanges } from "../../../lib/change-processor";
import { reviewerAuthorization } from "../../../lib/reviewer-auth";

const jsonHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function POST(request: Request) {
  try {
    const authorization = reviewerAuthorization(request);
    if (!authorization.configured) return Response.json({ error: "Change-event controls are disabled" }, { status: 503, headers: jsonHeaders });
    if (!authorization.authorized) {
      return Response.json({ error: "Reviewer authorization is required" }, {
        status: 401,
        headers: { ...jsonHeaders, "WWW-Authenticate": "Bearer realm=\"PoolSignal reviewer\"" },
      });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Content-Type must be application/json" }, { status: 415, headers: jsonHeaders });
    }
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1_024) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }
    const payload = JSON.parse(rawBody) as { action?: unknown; eventKey?: unknown };
    if (payload.action !== "process" && payload.action !== "retry") {
      return Response.json({ error: "Action must be process or retry" }, { status: 400, headers: jsonHeaders });
    }
    await ensureLiveSchema();
    const db = getD1();
    if (payload.action === "retry") {
      const eventKey = typeof payload.eventKey === "string" ? payload.eventKey : "";
      if (!/^wpc_qi:QI-\d{1,8}:[a-f0-9]{64}$/.test(eventKey)) {
        return Response.json({ error: "A valid WPC change event key is required" }, { status: 400, headers: jsonHeaders });
      }
      await db.prepare(`
        UPDATE source_change_events
        SET status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL
        WHERE event_key = ? AND status IN ('retry_wait', 'dead_letter')
      `).bind(eventKey).run();
    }
    const processing = await processPendingSourceChanges(db, { limit: 3 });
    return Response.json({ processing }, { headers: jsonHeaders });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Request body must be valid JSON" }, { status: 400, headers: jsonHeaders });
    return Response.json({ error: "Change-event processing could not be completed" }, { status: 500, headers: jsonHeaders });
  }
}
