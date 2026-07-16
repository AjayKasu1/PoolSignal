import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure the binding in wrangler.jsonc before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getD1(): D1Database {
  if (!env.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return env.DB;
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
        actor TEXT DEFAULT 'authenticated-reviewer' NOT NULL,
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

export async function ensureLiveSchema(d1 = getD1()) {
  await d1.batch([
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS source_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        checksum TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        status TEXT NOT NULL,
        record_count INTEGER DEFAULT 0 NOT NULL,
        retained_count INTEGER DEFAULT 0 NOT NULL,
        newest_record_at TEXT,
        detail_json TEXT DEFAULT '{}' NOT NULL
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS source_snapshots_source_time_idx ON source_snapshots(source_name, captured_at DESC)"),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS live_products (
        qi_id TEXT PRIMARY KEY NOT NULL,
        brand TEXT NOT NULL,
        product_name TEXT NOT NULL,
        part_number TEXT NOT NULL,
        product_type TEXT NOT NULL,
        power_profile TEXT NOT NULL,
        load_power REAL NOT NULL,
        version TEXT NOT NULL,
        certification_date TEXT NOT NULL,
        source_url TEXT NOT NULL,
        source_checksum TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS live_products_certification_idx ON live_products(certification_date DESC)"),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS via_public_entities (
        normalized_name TEXT PRIMARY KEY NOT NULL,
        public_name TEXT NOT NULL,
        source_checksum TEXT NOT NULL,
        source_url TEXT NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS via_public_entities_active_idx ON via_public_entities(active, normalized_name)"),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS entity_resolution_cache (
        query_key TEXT PRIMARY KEY NOT NULL,
        query_text TEXT NOT NULL,
        result_json TEXT DEFAULT '[]' NOT NULL,
        result_count INTEGER DEFAULT 0 NOT NULL,
        retrieved_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS entity_resolution_cache_expiry_idx ON entity_resolution_cache(expires_at)"),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS source_product_versions (
        source_name TEXT NOT NULL,
        record_key TEXT NOT NULL,
        record_hash TEXT NOT NULL,
        canonical_json TEXT NOT NULL,
        first_observed_at TEXT NOT NULL,
        last_observed_at TEXT NOT NULL,
        PRIMARY KEY(source_name, record_key)
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS source_product_versions_observed_idx ON source_product_versions(source_name, last_observed_at DESC)"),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS source_change_events (
        event_key TEXT PRIMARY KEY NOT NULL,
        source_name TEXT NOT NULL,
        record_key TEXT NOT NULL,
        qi_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        before_hash TEXT,
        after_hash TEXT NOT NULL,
        changed_fields_json TEXT DEFAULT '[]' NOT NULL,
        before_json TEXT,
        after_json TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        processing_started_at TEXT,
        next_attempt_at TEXT,
        last_error TEXT,
        processed_at TEXT,
        agent_run_key TEXT
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS source_change_events_status_idx ON source_change_events(status, next_attempt_at, observed_at)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS source_change_events_qi_idx ON source_change_events(qi_id, observed_at DESC)"),
    d1.prepare(`
      CREATE TABLE IF NOT EXISTS live_agent_runs (
        run_key TEXT PRIMARY KEY NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        event_key TEXT NOT NULL,
        qi_id TEXT NOT NULL,
        status TEXT NOT NULL,
        review_priority INTEGER NOT NULL,
        requires_human INTEGER NOT NULL,
        result_json TEXT NOT NULL,
        agent_version TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL
      )
    `),
    d1.prepare("CREATE INDEX IF NOT EXISTS live_agent_runs_event_idx ON live_agent_runs(event_key, completed_at DESC)"),
  ]);
}
