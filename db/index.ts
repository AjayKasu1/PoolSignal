import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export async function ensureReviewSchema() {
  if (!env.DB) {
    throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  }
  const d1 = env.DB;
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS review_cases (
        id TEXT PRIMARY KEY NOT NULL,
        qi_id TEXT NOT NULL,
        brand TEXT NOT NULL,
        product_name TEXT NOT NULL,
        stage TEXT DEFAULT 'review' NOT NULL,
        priority INTEGER NOT NULL,
        public_list_match TEXT NOT NULL,
        evidence_json TEXT DEFAULT '[]' NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS review_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        case_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        rationale TEXT DEFAULT '' NOT NULL,
        actor TEXT DEFAULT 'portfolio-reviewer' NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        case_id TEXT NOT NULL,
        status TEXT NOT NULL,
        trace_json TEXT DEFAULT '[]' NOT NULL,
        started_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TEXT
      )
    `),
  ]);
}
