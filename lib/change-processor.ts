import { LICENSING_POLICY_VERSION, LIVE_AGENT_VERSION } from "./agent-versions";
import type { AgentRunResult } from "./agent-engine";
import { runLiveAgentCycle } from "./live-agent-engine";
import type { LiveProductSignal } from "./live-data";

type PendingChangeRow = {
  event_key: string;
  qi_id: string;
  after_json: string;
  attempts: number;
};

export type ChangeProcessingResult = {
  considered: number;
  completed: number;
  deferred: number;
  deadLettered: number;
};

function parseProduct(value: string): LiveProductSignal {
  const product = JSON.parse(value) as LiveProductSignal;
  if (!/^QI-\d{1,8}$/.test(product.qiId) || !product.brand || !product.productName) {
    throw new Error("Change event product payload is invalid");
  }
  return product;
}

async function completeFromExistingRun(db: D1Database, eventKey: string, idempotencyKey: string, processedAt: string): Promise<boolean> {
  const existing = await db.prepare("SELECT run_key FROM live_agent_runs WHERE idempotency_key = ? LIMIT 1")
    .bind(idempotencyKey).first<{ run_key: string }>();
  if (!existing) return false;
  await db.prepare(`
    UPDATE source_change_events
    SET status = 'completed', processed_at = ?, processing_started_at = NULL,
        next_attempt_at = NULL, last_error = NULL, agent_run_key = ?
    WHERE event_key = ?
  `).bind(processedAt, existing.run_key, eventKey).run();
  return true;
}

async function processClaimedChange(
  db: D1Database,
  row: PendingChangeRow,
  now: Date,
): Promise<"completed" | "deferred" | "dead_letter"> {
  const attempt = row.attempts + 1;
  const processedAt = now.toISOString();
  const idempotencyKey = `${row.event_key}:${LIVE_AGENT_VERSION}:${LICENSING_POLICY_VERSION}`;
  try {
    if (await completeFromExistingRun(db, row.event_key, idempotencyKey, processedAt)) return "completed";
    const product = parseProduct(row.after_json);
    const generated = await runLiveAgentCycle(db, product, now);
    const run: AgentRunResult = { ...generated, persisted: true };
    const runKey = `live-run:${run.runId}`;
    await db.prepare(`
      INSERT INTO live_agent_runs(
        run_key, idempotency_key, event_key, qi_id, status,
        review_priority, requires_human, result_json, agent_version,
        policy_version, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      runKey,
      idempotencyKey,
      row.event_key,
      row.qi_id,
      run.status,
      run.reviewPriority,
      run.requiresHuman ? 1 : 0,
      JSON.stringify(run),
      LIVE_AGENT_VERSION,
      LICENSING_POLICY_VERSION,
      run.startedAt,
      run.completedAt,
    ).run();
    await db.prepare(`
      UPDATE source_change_events
      SET status = 'completed', processed_at = ?, processing_started_at = NULL,
          next_attempt_at = NULL, last_error = NULL, agent_run_key = ?
      WHERE event_key = ?
    `).bind(processedAt, runKey, row.event_key).run();
    return "completed";
  } catch (error) {
    if (await completeFromExistingRun(db, row.event_key, idempotencyKey, processedAt)) return "completed";
    const deadLettered = attempt >= 3;
    const retryMinutes = Math.min(60, 5 * (2 ** Math.max(0, attempt - 1)));
    const nextAttemptAt = deadLettered ? null : new Date(now.getTime() + retryMinutes * 60_000).toISOString();
    await db.prepare(`
      UPDATE source_change_events
      SET status = ?, processing_started_at = NULL, next_attempt_at = ?, last_error = ?
      WHERE event_key = ?
    `).bind(
      deadLettered ? "dead_letter" : "retry_wait",
      nextAttemptAt,
      error instanceof SyntaxError ? "Stored change payload failed validation" : "Agent processing failed and was safely deferred",
      row.event_key,
    ).run();
    return deadLettered ? "dead_letter" : "deferred";
  }
}

export async function processPendingSourceChanges(
  db: D1Database,
  options: { limit?: number; now?: Date } = {},
): Promise<ChangeProcessingResult> {
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(Math.floor(options.limit ?? 3), 1), 10);
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - 15 * 60_000).toISOString();
  await db.prepare(`
    UPDATE source_change_events
    SET status = 'retry_wait', processing_started_at = NULL, next_attempt_at = ?,
        last_error = 'Processing lease expired; event was returned to the retry queue'
    WHERE status = 'processing' AND processing_started_at < ?
  `).bind(nowIso, staleBefore).run();

  const candidates = await db.prepare(`
    SELECT event_key, qi_id, after_json, attempts
    FROM source_change_events
    WHERE status = 'pending'
       OR (status = 'retry_wait' AND next_attempt_at <= ? AND attempts < 3)
    ORDER BY observed_at ASC
    LIMIT ?
  `).bind(nowIso, limit).all<PendingChangeRow>();

  const claimed: PendingChangeRow[] = [];
  for (const row of candidates.results) {
    const result = await db.prepare(`
      UPDATE source_change_events
      SET status = 'processing', attempts = attempts + 1, processing_started_at = ?, last_error = NULL
      WHERE event_key = ?
        AND (status = 'pending' OR (status = 'retry_wait' AND next_attempt_at <= ? AND attempts < 3))
    `).bind(nowIso, row.event_key, nowIso).run();
    if (Number(result.meta.changes ?? 0) === 1) claimed.push(row);
  }

  const outcomes = await Promise.all(claimed.map((row) => processClaimedChange(db, row, now)));
  return {
    considered: claimed.length,
    completed: outcomes.filter((outcome) => outcome === "completed").length,
    deferred: outcomes.filter((outcome) => outcome === "deferred").length,
    deadLettered: outcomes.filter((outcome) => outcome === "dead_letter").length,
  };
}
