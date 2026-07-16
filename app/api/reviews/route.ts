import { desc, eq } from "drizzle-orm";
import { ensureReviewSchema, getDb } from "../../../db";
import { reviewCases, reviewEvents } from "../../../db/schema";
import { reviewCases as demoReviewCases } from "../../../lib/demo-data";
import { reviewerAuthorization } from "../../../lib/reviewer-auth";

const allowedDecisions = new Set(["approved", "returned", "monitor"]);
const jsonHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function GET(request: Request) {
  try {
    const authorization = reviewerAuthorization(request);
    if (!authorization.configured) {
      return Response.json({ error: "Reviewer reads are disabled" }, { status: 503, headers: jsonHeaders });
    }
    if (!authorization.authorized) {
      return Response.json({ error: "Reviewer authorization is required" }, {
        status: 401,
        headers: { ...jsonHeaders, "WWW-Authenticate": "Bearer realm=\"PoolSignal reviewer\"" },
      });
    }
    await ensureReviewSchema();
    const db = getDb();
    const events = await db.select().from(reviewEvents).orderBy(desc(reviewEvents.createdAt)).limit(50);
    return Response.json({ events, persistence: "available" }, { headers: jsonHeaders });
  } catch {
    return Response.json({ events: [], persistence: "unavailable" }, { status: 503, headers: jsonHeaders });
  }
}

export async function POST(request: Request) {
  try {
    const authorization = reviewerAuthorization(request);
    if (!authorization.configured) {
      return Response.json({ error: "Reviewer writes are disabled" }, { status: 503, headers: jsonHeaders });
    }
    if (!authorization.authorized) {
      return Response.json({ error: "Reviewer authorization is required" }, { status: 401, headers: { ...jsonHeaders, "WWW-Authenticate": "Bearer realm=\"PoolSignal reviewer\"" } });
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Content-Type must be application/json" }, { status: 415, headers: jsonHeaders });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 4_096) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_096) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }
    let payload: { caseId?: unknown; decision?: unknown; rationale?: unknown };
    try {
      payload = JSON.parse(rawBody) as { caseId?: unknown; decision?: unknown; rationale?: unknown };
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400, headers: jsonHeaders });
    }
    const sourceCase = demoReviewCases.find((item) => item.id === payload.caseId);
    const decision = typeof payload.decision === "string" ? payload.decision : "";
    const rationale = typeof payload.rationale === "string" ? payload.rationale.trim() : "";
    if (!sourceCase || !allowedDecisions.has(decision) || rationale.length > 500) {
      return Response.json({ error: "A valid caseId, decision, and rationale of at most 500 characters are required" }, { status: 400, headers: jsonHeaders });
    }

    await ensureReviewSchema();
    const db = getDb();
    const existing = await db.select({ id: reviewCases.id }).from(reviewCases).where(eq(reviewCases.id, sourceCase.id)).limit(1);
    if (existing.length === 0) {
      await db.insert(reviewCases).values({
        id: sourceCase.id,
        qiId: sourceCase.qiId,
        brand: sourceCase.brand,
        productName: sourceCase.product,
        priority: sourceCase.score,
        publicListMatch: sourceCase.matchState,
        evidenceJson: JSON.stringify(sourceCase.evidence),
        stage: decision,
      });
    } else {
      await db.update(reviewCases).set({ stage: decision, updatedAt: new Date().toISOString() }).where(eq(reviewCases.id, sourceCase.id));
    }

    const [event] = await db.insert(reviewEvents).values({
      caseId: sourceCase.id,
      decision,
      rationale,
      actor: "authenticated-reviewer",
    }).returning();

    return Response.json({ event, persistence: "available" }, { status: 201, headers: jsonHeaders });
  } catch {
    return Response.json({ error: "The review decision could not be recorded" }, { status: 500, headers: jsonHeaders });
  }
}
