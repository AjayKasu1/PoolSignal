import {
  GLEIF_API_URL,
  type LiveDataResponse,
  type LiveDataStatus,
  type LiveEntityCandidate,
  type LiveProductSignal,
  normalizeEntityName,
  parseViaLicensees,
  parseWpcFeed,
  scoreEntityName,
  validateViaLicensees,
  VIA_QI_URL,
  WPC_PRODUCTS_URL,
} from "./live-data";

const REQUEST_HEADERS = {
  Accept: "application/json, text/html;q=0.9",
  "User-Agent": "PoolSignal/0.2 (+https://poolsignal.ajaykasu7.workers.dev)",
};

export type LiveSource = "wpc" | "via";

export type ViaMatch = {
  state: "public-list" | "possible" | "none" | "unknown";
  publicName: string | null;
  confidence: number;
  observedAt: string | null;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchBoundedText(url: string, maxBytes: number, timeoutMs = 20_000): Promise<string> {
  const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > maxBytes) throw new Error("Source response exceeded the size contract");
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) throw new Error("Source response exceeded the size contract");
  return body;
}

async function insertSnapshot(
  db: D1Database,
  snapshot: {
    sourceName: string;
    sourceUrl: string;
    checksum: string;
    capturedAt: string;
    recordCount: number;
    retainedCount: number;
    newestRecordAt: string | null;
    detail: Record<string, unknown>;
  },
): Promise<void> {
  await db.prepare(`
    INSERT INTO source_snapshots(
      source_name, source_url, checksum, captured_at, status,
      record_count, retained_count, newest_record_at, detail_json
    ) VALUES (?, ?, ?, ?, 'complete', ?, ?, ?, ?)
  `).bind(
    snapshot.sourceName,
    snapshot.sourceUrl,
    snapshot.checksum,
    snapshot.capturedAt,
    snapshot.recordCount,
    snapshot.retainedCount,
    snapshot.newestRecordAt,
    JSON.stringify(snapshot.detail),
  ).run();
}

async function runBatches(db: D1Database, statements: D1PreparedStatement[], size = 50): Promise<void> {
  for (let index = 0; index < statements.length; index += size) {
    await db.batch(statements.slice(index, index + size));
  }
}

export async function refreshWpcProducts(db: D1Database, now = new Date()): Promise<Record<string, unknown>> {
  const capturedAt = now.toISOString();
  const body = await fetchBoundedText(WPC_PRODUCTS_URL, 5_000_000);
  const checksum = await sha256(body);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("WPC response was not valid JSON");
  }
  const parsed = parseWpcFeed(payload, checksum, now);
  if (parsed.totalRecords < 1_000 || parsed.retainedRecords.length < 25) {
    throw new Error("WPC response failed its record-count contract");
  }

  const statements = parsed.retainedRecords.map((record) => db.prepare(`
    INSERT INTO live_products(
      qi_id, brand, product_name, part_number, product_type, power_profile,
      load_power, version, certification_date, source_url, source_checksum,
      first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(qi_id) DO UPDATE SET
      brand = excluded.brand,
      product_name = excluded.product_name,
      part_number = excluded.part_number,
      product_type = excluded.product_type,
      power_profile = excluded.power_profile,
      load_power = excluded.load_power,
      version = excluded.version,
      certification_date = excluded.certification_date,
      source_url = excluded.source_url,
      source_checksum = excluded.source_checksum,
      last_seen_at = excluded.last_seen_at
  `).bind(
    record.qiId,
    record.brand,
    record.productName,
    record.partNumber,
    record.productType,
    record.powerProfile,
    record.loadPower,
    record.version,
    record.certificationDate,
    record.sourceUrl,
    record.sourceChecksum,
    capturedAt,
    capturedAt,
  ));
  await runBatches(db, statements);
  await insertSnapshot(db, {
    sourceName: "wpc_qi",
    sourceUrl: WPC_PRODUCTS_URL,
    checksum,
    capturedAt,
    recordCount: parsed.totalRecords,
    retainedCount: parsed.retainedRecords.length,
    newestRecordAt: parsed.newestCertificationDate,
    detail: {
      parserVersion: "wpc-json-v1",
      monitoringWindowDays: 180,
      maximumStoredRecords: 500,
      rejectedRecords: parsed.rejectedRecords,
    },
  });
  return {
    source: "wpc",
    capturedAt,
    totalRecords: parsed.totalRecords,
    retainedRecords: parsed.retainedRecords.length,
    newestCertificationDate: parsed.newestCertificationDate,
  };
}

export async function ingestViaSnapshot(
  db: D1Database,
  rawLicensees: unknown,
  checksum: string,
  capturedAt: string,
): Promise<Record<string, unknown>> {
  if (!/^[a-f0-9]{64}$/.test(checksum)) throw new Error("Via snapshot checksum is invalid");
  const licensees = validateViaLicensees(rawLicensees);
  const statements = [
    db.prepare("UPDATE via_public_entities SET active = 0"),
    ...licensees.map((publicName) => db.prepare(`
    INSERT INTO via_public_entities(
      normalized_name, public_name, source_checksum, source_url,
      active, first_seen_at, last_seen_at
    ) VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(normalized_name) DO UPDATE SET
      public_name = excluded.public_name,
      source_checksum = excluded.source_checksum,
      source_url = excluded.source_url,
      active = 1,
      last_seen_at = excluded.last_seen_at
  `).bind(
    normalizeEntityName(publicName),
    publicName,
    checksum,
    VIA_QI_URL,
    capturedAt,
    capturedAt,
  )),
    db.prepare(`
      INSERT INTO source_snapshots(
        source_name, source_url, checksum, captured_at, status,
        record_count, retained_count, newest_record_at, detail_json
      ) VALUES ('via_qi_licensees', ?, ?, ?, 'complete', ?, ?, NULL, ?)
    `).bind(
      VIA_QI_URL,
      checksum,
      capturedAt,
      licensees.length,
      licensees.length,
      JSON.stringify({ parserVersion: "via-licensees-v1", semantics: "public-list snapshot; not product coverage" }),
    ),
  ];
  await db.batch(statements);
  return { source: "via", capturedAt, licenseeCount: licensees.length };
}

export async function refreshViaLicensees(db: D1Database, now = new Date()): Promise<Record<string, unknown>> {
  const capturedAt = now.toISOString();
  const body = await fetchBoundedText(VIA_QI_URL, 3_000_000, 45_000);
  const checksum = await sha256(body);
  return ingestViaSnapshot(db, parseViaLicensees(body), checksum, capturedAt);
}

export async function refreshLiveSources(
  db: D1Database,
  sources: LiveSource[] = ["wpc", "via"],
  now = new Date(),
): Promise<Record<string, unknown>[]> {
  const uniqueSources = [...new Set(sources)];
  const results: Record<string, unknown>[] = [];
  for (const source of uniqueSources) {
    results.push(source === "wpc" ? await refreshWpcProducts(db, now) : await refreshViaLicensees(db, now));
  }
  return results;
}

type SnapshotRow = {
  captured_at: string;
  record_count: number;
  retained_count: number;
  newest_record_at: string | null;
};

type ProductRow = {
  qi_id: string;
  brand: string;
  product_name: string;
  part_number: string;
  product_type: "PTx" | "PRx";
  power_profile: string;
  load_power: number;
  version: string;
  certification_date: string;
  source_url: string;
  source_checksum: string;
  first_seen_at: string;
  last_seen_at: string;
};

function mapProduct(row: ProductRow): LiveProductSignal {
  return {
    qiId: row.qi_id,
    brand: row.brand,
    productName: row.product_name,
    partNumber: row.part_number,
    productType: row.product_type,
    powerProfile: row.power_profile,
    loadPower: row.load_power,
    version: row.version,
    certificationDate: row.certification_date,
    sourceUrl: row.source_url,
    sourceChecksum: row.source_checksum,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function getLiveData(db: D1Database, limit = 8, now = new Date()): Promise<LiveDataResponse> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 25);
  const [wpcSnapshot, viaSnapshot, products, new30d, viaCount, cacheCount] = await Promise.all([
    db.prepare("SELECT captured_at, record_count, retained_count, newest_record_at FROM source_snapshots WHERE source_name = 'wpc_qi' AND status = 'complete' ORDER BY id DESC LIMIT 1").first<SnapshotRow>(),
    db.prepare("SELECT captured_at, record_count, retained_count, newest_record_at FROM source_snapshots WHERE source_name = 'via_qi_licensees' AND status = 'complete' ORDER BY id DESC LIMIT 1").first<SnapshotRow>(),
    db.prepare("SELECT * FROM live_products ORDER BY certification_date DESC, CAST(SUBSTR(qi_id, 4) AS INTEGER) DESC LIMIT ?").bind(safeLimit).all<ProductRow>(),
    db.prepare("SELECT COUNT(*) AS count FROM live_products WHERE certification_date >= date('now', '-30 days')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM via_public_entities WHERE active = 1").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM entity_resolution_cache WHERE expires_at > ?").bind(now.toISOString()).first<{ count: number }>(),
  ]);

  const status: LiveDataStatus = {
    mode: wpcSnapshot && viaSnapshot ? "live" : "warming",
    generatedAt: now.toISOString(),
    wpc: {
      lastSuccessAt: wpcSnapshot?.captured_at ?? null,
      totalRecords: wpcSnapshot?.record_count ?? 0,
      monitoredRecords: wpcSnapshot?.retained_count ?? 0,
      new30d: Number(new30d?.count ?? 0),
      newestCertificationDate: wpcSnapshot?.newest_record_at ?? null,
    },
    via: {
      lastSuccessAt: viaSnapshot?.captured_at ?? null,
      licenseeCount: Number(viaCount?.count ?? 0),
    },
    gleif: { mode: "on-demand", cachedQueries: Number(cacheCount?.count ?? 0) },
  };
  return { signals: products.results.map(mapProduct), status };
}

export async function getLiveProduct(db: D1Database, qiId: string): Promise<LiveProductSignal | null> {
  const row = await db.prepare("SELECT * FROM live_products WHERE qi_id = ? LIMIT 1").bind(qiId).first<ProductRow>();
  return row ? mapProduct(row) : null;
}

type GleifRecord = {
  attributes?: {
    lei?: string;
    entity?: { legalName?: { name?: string }; legalAddress?: { country?: string } };
    registration?: { status?: string };
  };
};

function parseGleifCandidates(payload: unknown, observedName: string): LiveEntityCandidate[] {
  const data = (payload as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((record): LiveEntityCandidate[] => {
    const attributes = (record as GleifRecord).attributes;
    const legalName = attributes?.entity?.legalName?.name?.trim() ?? "";
    const lei = attributes?.lei?.trim() ?? "";
    if (!legalName || !lei) return [];
    return [{
      legalName: legalName.slice(0, 240),
      lei: lei.slice(0, 20),
      jurisdiction: attributes?.entity?.legalAddress?.country?.slice(0, 2) ?? "",
      registrationStatus: attributes?.registration?.status?.slice(0, 40) ?? "unknown",
      confidence: scoreEntityName(observedName, legalName),
      sourceUrl: `${GLEIF_API_URL}/${encodeURIComponent(lei)}`,
    }];
  }).filter((candidate) => candidate.confidence >= 0.35).sort((left, right) => right.confidence - left.confidence).slice(0, 3);
}

export async function resolveEntityWithGleif(
  db: D1Database,
  observedName: string,
  now = new Date(),
): Promise<LiveEntityCandidate[]> {
  const queryKey = normalizeEntityName(observedName).slice(0, 180);
  if (!queryKey) return [];
  const cached = await db.prepare("SELECT result_json FROM entity_resolution_cache WHERE query_key = ? AND expires_at > ? LIMIT 1")
    .bind(queryKey, now.toISOString()).first<{ result_json: string }>();
  if (cached) {
    try {
      return JSON.parse(cached.result_json) as LiveEntityCandidate[];
    } catch {
      // Refresh a malformed cache entry from the source.
    }
  }

  const url = new URL(GLEIF_API_URL);
  url.searchParams.set("filter[entity.legalName]", observedName.slice(0, 160));
  url.searchParams.set("page[number]", "1");
  url.searchParams.set("page[size]", "5");
  const body = await fetchBoundedText(url.toString(), 750_000);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("GLEIF response was not valid JSON");
  }
  const candidates = parseGleifCandidates(payload, observedName);
  const retrievedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + (candidates.length ? 7 : 1) * 86_400_000).toISOString();
  await db.prepare(`
    INSERT INTO entity_resolution_cache(query_key, query_text, result_json, result_count, retrieved_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(query_key) DO UPDATE SET
      query_text = excluded.query_text,
      result_json = excluded.result_json,
      result_count = excluded.result_count,
      retrieved_at = excluded.retrieved_at,
      expires_at = excluded.expires_at
  `).bind(queryKey, observedName.slice(0, 160), JSON.stringify(candidates), candidates.length, retrievedAt, expiresAt).run();
  return candidates;
}

export async function compareViaSnapshot(db: D1Database, entityNames: string[]): Promise<ViaMatch> {
  const snapshot = await db.prepare("SELECT captured_at FROM source_snapshots WHERE source_name = 'via_qi_licensees' AND status = 'complete' ORDER BY id DESC LIMIT 1")
    .first<{ captured_at: string }>();
  if (!snapshot || entityNames.length === 0) return { state: "unknown", publicName: null, confidence: 0, observedAt: snapshot?.captured_at ?? null };
  const entries = await db.prepare("SELECT public_name FROM via_public_entities WHERE active = 1").all<{ public_name: string }>();
  let best = { publicName: null as string | null, confidence: 0 };
  for (const entityName of entityNames) {
    for (const entry of entries.results) {
      const confidence = scoreEntityName(entityName, entry.public_name);
      if (confidence > best.confidence) best = { publicName: entry.public_name, confidence };
    }
  }
  return {
    state: best.confidence >= 0.92 ? "public-list" : best.confidence >= 0.72 ? "possible" : "none",
    publicName: best.confidence >= 0.72 ? best.publicName : null,
    confidence: best.confidence,
    observedAt: snapshot.captured_at,
  };
}
