import { runAgentCycle } from "../../../lib/agent-engine";
import { reviewCases } from "../../../lib/demo-data";
import { ensureLiveSchema, getD1 } from "../../../db";
import { runLiveAgentCycle } from "../../../lib/live-agent-engine";
import { getLiveProduct } from "../../../lib/live-store";

const jsonHeaders = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return Response.json({ error: "Content-Type must be application/json" }, { status: 415, headers: jsonHeaders });
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 1_024) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 1_024) {
      return Response.json({ error: "Request body is too large" }, { status: 413, headers: jsonHeaders });
    }
    let payload: { caseId?: unknown; qiId?: unknown };
    try {
      payload = JSON.parse(rawBody) as { caseId?: unknown; qiId?: unknown };
    } catch {
      return Response.json({ error: "Request body must be valid JSON" }, { status: 400, headers: jsonHeaders });
    }
    const item = reviewCases.find((candidate) => candidate.id === payload.caseId);
    if (item) return Response.json({ run: runAgentCycle(item) }, { headers: jsonHeaders });

    const qiId = typeof payload.qiId === "string" ? payload.qiId.trim().toUpperCase() : "";
    if (!/^QI-\d{1,8}$/.test(qiId)) {
      return Response.json({ error: "A valid caseId or live qiId is required" }, { status: 400, headers: jsonHeaders });
    }
    await ensureLiveSchema();
    const liveProduct = await getLiveProduct(getD1(), qiId);
    if (!liveProduct) return Response.json({ error: "The live Qi record is not in the monitored window" }, { status: 404, headers: jsonHeaders });

    return Response.json({ run: await runLiveAgentCycle(getD1(), liveProduct) }, { headers: jsonHeaders });
  } catch {
    return Response.json({ error: "The agent cycle could not be completed" }, { status: 500, headers: jsonHeaders });
  }
}
