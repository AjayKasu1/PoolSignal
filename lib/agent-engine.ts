import type { AgentStep, ReviewCase } from "./demo-data";

export type AgentRunResult = {
  runId: string;
  caseId: string;
  status: "review_required" | "monitor";
  requiresHuman: boolean;
  permittedActions: string[];
  reviewPriority: number;
  trace: AgentStep[];
  startedAt: string;
  completedAt: string;
  persisted: false;
};

function daysSince(date: string, now: Date): number {
  const elapsed = now.getTime() - new Date(`${date}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor(elapsed / 86_400_000));
}

function computePriority(item: ReviewCase, now: Date): number {
  const age = daysSince(item.certificationDate, now);
  const recency = age <= 60 ? 30 : age <= 180 ? 18 : 6;
  const transmitter = item.productType === "PTx" ? 20 : 8;
  const power = item.loadPower >= 25 ? 20 : item.loadPower > 5 ? 14 : 5;
  const identityUncertainty = item.matchConfidence < 85 ? 15 : 4;
  const publicSnapshot = item.matchState === "none" ? 8 : item.matchState === "possible" ? 5 : 0;
  return Math.min(100, recency + transmitter + power + identityUncertainty + publicSnapshot);
}

export function runAgentCycle(item: ReviewCase, now = new Date()): AgentRunResult {
  const startedAt = now.toISOString();
  const priority = computePriority(item, now);
  const resolverStatus: AgentStep["status"] = item.matchConfidence < 50 ? "blocked" : item.matchConfidence < 85 ? "waiting" : "complete";
  const requiresHuman = item.matchConfidence < 85 || item.matchState !== "public-list";

  const trace: AgentStep[] = [
    {
      agent: "Scout",
      task: "Validate certification signal",
      status: "complete",
      confidence: 0.99,
      output: `Validated ${item.qiId} as a ${item.productType} record with ${item.loadPower}W load power and an HTTPS evidence source.`,
    },
    {
      agent: "Resolver",
      task: "Resolve brand to legal entity",
      status: resolverStatus,
      confidence: item.matchConfidence / 100,
      output: resolverStatus === "complete"
        ? `Entity evidence cleared the 0.85 identity threshold at ${item.matchConfidence}% confidence.`
        : `Entity evidence is ${item.matchConfidence}% confident and therefore abstains from automatic approval.`,
    },
    {
      agent: "Coverage",
      task: "Compare dated public snapshot",
      status: resolverStatus === "blocked" ? "waiting" : "complete",
      confidence: resolverStatus === "blocked" ? 0.5 : 0.93,
      output: item.matchState === "public-list"
        ? "Found a high-confidence entity-name match in the dated public snapshot."
        : "The dated snapshot comparison remains a research signal, not a product-coverage conclusion.",
    },
    {
      agent: "Prioritizer",
      task: "Compute transparent review priority",
      status: "complete",
      confidence: 0.94,
      output: `Computed ${priority}/100 from recency, transmitter relevance, power, identity uncertainty, and snapshot state.`,
    },
    {
      agent: "Policy gate",
      task: "Authorize bounded next action",
      status: requiresHuman ? "waiting" : "complete",
      confidence: 1,
      output: requiresHuman
        ? "Human review is mandatory; research and monitoring are allowed, while autonomous outreach remains disabled."
        : "High-confidence identity and snapshot evidence permit monitoring only; autonomous outreach remains disabled.",
    },
  ];

  return {
    runId: crypto.randomUUID(),
    caseId: item.id,
    status: requiresHuman ? "review_required" : "monitor",
    requiresHuman,
    permittedActions: requiresHuman
      ? ["research", "return_for_research", "monitor", "approve_entity_link"]
      : ["monitor"],
    reviewPriority: priority,
    trace,
    startedAt,
    completedAt: new Date(now.getTime() + 12).toISOString(),
    persisted: false,
  };
}
