import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const reviewCases = sqliteTable("review_cases", {
  id: text("id").primaryKey(),
  qiId: text("qi_id").notNull(),
  brand: text("brand").notNull(),
  productName: text("product_name").notNull(),
  stage: text("stage").notNull().default("review"),
  priority: integer("priority").notNull(),
  publicListMatch: text("public_list_match").notNull(),
  evidenceJson: text("evidence_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const reviewEvents = sqliteTable("review_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale").notNull().default(""),
  actor: text("actor").notNull().default("authenticated-reviewer"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const agentRuns = sqliteTable("agent_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: text("case_id").notNull(),
  status: text("status").notNull(),
  traceJson: text("trace_json").notNull().default("[]"),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
});

export const sourceSnapshots = sqliteTable("source_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  checksum: text("checksum").notNull(),
  capturedAt: text("captured_at").notNull(),
  status: text("status").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  retainedCount: integer("retained_count").notNull().default(0),
  newestRecordAt: text("newest_record_at"),
  detailJson: text("detail_json").notNull().default("{}"),
});

export const liveProducts = sqliteTable("live_products", {
  qiId: text("qi_id").primaryKey(),
  brand: text("brand").notNull(),
  productName: text("product_name").notNull(),
  partNumber: text("part_number").notNull(),
  productType: text("product_type").notNull(),
  powerProfile: text("power_profile").notNull(),
  loadPower: real("load_power").notNull(),
  version: text("version").notNull(),
  certificationDate: text("certification_date").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceChecksum: text("source_checksum").notNull(),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const viaPublicEntities = sqliteTable("via_public_entities", {
  normalizedName: text("normalized_name").primaryKey(),
  publicName: text("public_name").notNull(),
  sourceChecksum: text("source_checksum").notNull(),
  sourceUrl: text("source_url").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const entityResolutionCache = sqliteTable("entity_resolution_cache", {
  queryKey: text("query_key").primaryKey(),
  queryText: text("query_text").notNull(),
  resultJson: text("result_json").notNull().default("[]"),
  resultCount: integer("result_count").notNull().default(0),
  retrievedAt: text("retrieved_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

export const sourceProductVersions = sqliteTable("source_product_versions", {
  sourceName: text("source_name").notNull(),
  recordKey: text("record_key").notNull(),
  recordHash: text("record_hash").notNull(),
  canonicalJson: text("canonical_json").notNull(),
  firstObservedAt: text("first_observed_at").notNull(),
  lastObservedAt: text("last_observed_at").notNull(),
}, (table) => [primaryKey({ columns: [table.sourceName, table.recordKey] })]);

export const sourceChangeEvents = sqliteTable("source_change_events", {
  eventKey: text("event_key").primaryKey(),
  sourceName: text("source_name").notNull(),
  recordKey: text("record_key").notNull(),
  qiId: text("qi_id").notNull(),
  changeType: text("change_type").notNull(),
  beforeHash: text("before_hash"),
  afterHash: text("after_hash").notNull(),
  changedFieldsJson: text("changed_fields_json").notNull().default("[]"),
  beforeJson: text("before_json"),
  afterJson: text("after_json").notNull(),
  observedAt: text("observed_at").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  processingStartedAt: text("processing_started_at"),
  nextAttemptAt: text("next_attempt_at"),
  lastError: text("last_error"),
  processedAt: text("processed_at"),
  agentRunKey: text("agent_run_key"),
});

export const liveAgentRuns = sqliteTable("live_agent_runs", {
  runKey: text("run_key").primaryKey(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  eventKey: text("event_key").notNull(),
  qiId: text("qi_id").notNull(),
  status: text("status").notNull(),
  reviewPriority: integer("review_priority").notNull(),
  requiresHuman: integer("requires_human", { mode: "boolean" }).notNull(),
  resultJson: text("result_json").notNull(),
  agentVersion: text("agent_version").notNull(),
  policyVersion: text("policy_version").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at").notNull(),
});
