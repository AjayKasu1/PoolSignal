import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  actor: text("actor").notNull().default("portfolio-reviewer"),
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
