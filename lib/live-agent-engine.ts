import type { AgentRunResult } from "./agent-engine";
import type { AgentStep } from "./demo-data";
import type { LiveEntityCandidate, LiveProductSignal } from "./live-data";
import { compareViaSnapshot, resolveEntityWithGleif, type ViaMatch } from "./live-store";

function daysSince(date: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000));
}

function livePriority(product: LiveProductSignal, entityConfidence: number, publicState: ViaMatch["state"], now: Date): number {
  const age = daysSince(product.certificationDate, now);
  const recency = age <= 30 ? 30 : age <= 90 ? 24 : age <= 180 ? 16 : 6;
  const transmitter = product.productType === "PTx" ? 20 : 8;
  const power = product.loadPower >= 25 ? 20 : product.loadPower > 5 ? 14 : 5;
  const identityUncertainty = entityConfidence < 0.85 ? 15 : 4;
  const publicSnapshot = publicState === "none" ? 8 : publicState === "possible" ? 5 : publicState === "unknown" ? 6 : 0;
  return Math.min(100, recency + transmitter + power + identityUncertainty + publicSnapshot);
}

export async function runLiveAgentCycle(db: D1Database, product: LiveProductSignal, now = new Date()): Promise<AgentRunResult> {
  const startedAt = now.toISOString();
  let candidates: LiveEntityCandidate[] = [];
  let gleifAvailable = true;
  try {
    candidates = await resolveEntityWithGleif(db, product.brand, now);
  } catch {
    gleifAvailable = false;
  }

  const bestCandidate = candidates[0];
  const entityConfidence = bestCandidate?.confidence ?? 0;
  let publicSnapshot: ViaMatch;
  try {
    publicSnapshot = await compareViaSnapshot(db, bestCandidate && entityConfidence >= 0.85 ? [bestCandidate.legalName] : []);
  } catch {
    publicSnapshot = { state: "unknown", publicName: null, confidence: 0, observedAt: null };
  }
  const priority = livePriority(product, entityConfidence, publicSnapshot.state, now);
  const resolverStatus: AgentStep["status"] = entityConfidence >= 0.85 ? "complete" : entityConfidence >= 0.5 ? "waiting" : "blocked";
  const requiresHuman = entityConfidence < 0.85 || publicSnapshot.state !== "public-list";

  const trace: AgentStep[] = [
    {
      agent: "Scout",
      task: "Validate live WPC signal",
      status: "complete",
      confidence: 0.99,
      output: `Validated ${product.qiId} from the monitored WPC feed as ${product.productType}, ${product.loadPower}W, certified ${product.certificationDate}.`,
    },
    {
      agent: "Resolver",
      task: "Search GLEIF legal entities",
      status: resolverStatus,
      confidence: entityConfidence,
      output: !gleifAvailable
        ? "GLEIF enrichment was temporarily unavailable, so the resolver abstained."
        : bestCandidate && entityConfidence >= 0.85
          ? `GLEIF candidate ${bestCandidate.legalName} cleared the 0.85 identity threshold with independently calculated ${Math.round(entityConfidence * 100)}% name confidence.`
          : bestCandidate
            ? `Best GLEIF candidate ${bestCandidate.legalName} reached ${Math.round(entityConfidence * 100)}%; human identity research remains required.`
            : "No GLEIF legal-entity candidate was returned; missing registry data is not negative evidence.",
    },
    {
      agent: "Coverage",
      task: "Compare current Via public snapshot",
      status: entityConfidence >= 0.85 ? "complete" : "waiting",
      confidence: publicSnapshot.state === "unknown" ? 0.5 : Math.max(publicSnapshot.confidence, 0.9),
      output: publicSnapshot.state === "public-list"
        ? `The approved entity name aligns with ${publicSnapshot.publicName} in the dated Via public snapshot; this does not establish product coverage.`
        : entityConfidence < 0.85
          ? "Public-list comparison was deferred until a legal entity is approved."
          : "No approved entity-name alignment was found in the dated snapshot; no licensing conclusion was made.",
    },
    {
      agent: "Prioritizer",
      task: "Compute transparent live priority",
      status: "complete",
      confidence: 0.94,
      output: `Computed ${priority}/100 from certification recency, product type, power, identity uncertainty, and dated snapshot state.`,
    },
    {
      agent: "Policy gate",
      task: "Authorize bounded next action",
      status: requiresHuman ? "waiting" : "complete",
      confidence: 1,
      output: requiresHuman
        ? "Human review is mandatory; research and monitoring are allowed, while autonomous outreach remains disabled."
        : "High-confidence identity and public-snapshot evidence permit monitoring only; autonomous outreach remains disabled.",
    },
  ];

  return {
    runId: crypto.randomUUID(),
    caseId: `live-${product.qiId.toLowerCase()}`,
    status: requiresHuman ? "review_required" : "monitor",
    requiresHuman,
    permittedActions: requiresHuman ? ["research", "return_for_research", "monitor", "approve_entity_link"] : ["monitor"],
    reviewPriority: priority,
    trace,
    startedAt,
    completedAt: new Date().toISOString(),
    persisted: false,
    source: "live",
    product,
    entityCandidates: candidates,
    publicSnapshot,
  };
}
