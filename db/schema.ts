import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
