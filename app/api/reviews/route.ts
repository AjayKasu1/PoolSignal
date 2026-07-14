import { desc, eq } from "drizzle-orm";
import { ensureReviewSchema, getDb } from "../../../db";
import { reviewCases, reviewEvents } from "../../../db/schema";

export async function GET() {
  try {
    await ensureReviewSchema();
    const db = getDb();
    const events = await db.select().from(reviewEvents).orderBy(desc(reviewEvents.createdAt)).limit(50);
    return Response.json({ events });
  } catch (error) {
    return Response.json({ events: [], persistence: "unavailable", detail: error instanceof Error ? error.message : "Unexpected error" });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      caseId?: string;
      qiId?: string;
      brand?: string;
      productName?: string;
      priority?: number;
      publicListMatch?: string;
      decision?: string;
      rationale?: string;
    };

    if (!payload.caseId || !payload.qiId || !payload.brand || !payload.productName || !payload.decision) {
      return Response.json({ error: "caseId, qiId, brand, productName, and decision are required" }, { status: 400 });
    }

    await ensureReviewSchema();
    const db = getDb();
    const existing = await db.select({ id: reviewCases.id }).from(reviewCases).where(eq(reviewCases.id, payload.caseId)).limit(1);
    if (existing.length === 0) {
      await db.insert(reviewCases).values({
        id: payload.caseId,
        qiId: payload.qiId,
        brand: payload.brand,
        productName: payload.productName,
        priority: payload.priority ?? 0,
        publicListMatch: payload.publicListMatch ?? "unknown",
        stage: payload.decision,
      });
    } else {
      await db.update(reviewCases).set({ stage: payload.decision, updatedAt: new Date().toISOString() }).where(eq(reviewCases.id, payload.caseId));
    }

    const [event] = await db.insert(reviewEvents).values({
      caseId: payload.caseId,
      decision: payload.decision,
      rationale: payload.rationale ?? "",
    }).returning();

    return Response.json({ event }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
