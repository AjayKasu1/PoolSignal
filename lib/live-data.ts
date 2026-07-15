export const WPC_PRODUCTS_URL = "https://jpsapi.wirelesspowerconsortium.com/ajax/products/qi";
export const WPC_PRODUCT_PAGE = "https://jpsapi.wirelesspowerconsortium.com/products/qi";
export const VIA_QI_URL = "https://www.via-la.com/licensing-programs/qi-wireless-power/";
export const GLEIF_API_URL = "https://api.gleif.org/api/v1/lei-records";

export type LiveProductSignal = {
  qiId: string;
  brand: string;
  productName: string;
  partNumber: string;
  productType: "PTx" | "PRx";
  powerProfile: string;
  loadPower: number;
  version: string;
  certificationDate: string;
  sourceUrl: string;
  sourceChecksum: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
};

export type WpcParseResult = {
  totalRecords: number;
  retainedRecords: LiveProductSignal[];
  newestCertificationDate: string | null;
  rejectedRecords: number;
};

export type LiveEntityCandidate = {
  legalName: string;
  lei: string;
  jurisdiction: string;
  registrationStatus: string;
  confidence: number;
  sourceUrl: string;
};

export type LiveDataStatus = {
  mode: "live" | "warming" | "unavailable";
  generatedAt: string;
  wpc: {
    lastSuccessAt: string | null;
    totalRecords: number;
    monitoredRecords: number;
    new30d: number;
    newestCertificationDate: string | null;
  };
  via: {
    lastSuccessAt: string | null;
    licenseeCount: number;
  };
  gleif: {
    mode: "on-demand";
    cachedQueries: number;
  };
};

export type LiveDataResponse = {
  signals: LiveProductSignal[];
  status: LiveDataStatus;
};

function cleanText(value: unknown, maxLength = 500): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseWpcFeed(
  payload: unknown,
  sourceChecksum: string,
  capturedAt = new Date(),
  options: { monitoringWindowDays?: number; maxRecords?: number } = {},
): WpcParseResult {
  if (!Array.isArray(payload)) throw new Error("WPC response is not an array");

  const monitoringWindowDays = Math.min(Math.max(options.monitoringWindowDays ?? 180, 30), 730);
  const maxRecords = Math.min(Math.max(options.maxRecords ?? 500, 25), 1_000);
  const cutoff = new Date(capturedAt.getTime() - monitoringWindowDays * 86_400_000);
  cutoff.setUTCHours(0, 0, 0, 0);
  let rejectedRecords = 0;

  const parsed = payload.flatMap((row): LiveProductSignal[] => {
    if (!Array.isArray(row) || row.length < 9) {
      rejectedRecords += 1;
      return [];
    }

    const id = Number(row[0]);
    const productType = cleanText(row[4], 30);
    const certificationDate = cleanText(row[8], 10);
    const loadPower = Number(row[6]);
    if (!Number.isInteger(id) || id <= 0 || !["PTx product", "PRx product"].includes(productType)
      || !Number.isFinite(loadPower) || loadPower < 0 || loadPower > 1_000 || !isIsoDate(certificationDate)) {
      rejectedRecords += 1;
      return [];
    }

    if (new Date(`${certificationDate}T00:00:00Z`) < cutoff) return [];
    const brand = cleanText(row[1], 160);
    const productName = cleanText(row[2], 240);
    if (!brand || !productName) {
      rejectedRecords += 1;
      return [];
    }

    return [{
      qiId: `QI-${id}`,
      brand,
      productName,
      partNumber: cleanText(row[3], 500),
      productType: productType === "PTx product" ? "PTx" : "PRx",
      powerProfile: cleanText(row[5], 80),
      loadPower,
      version: cleanText(row[7], 40),
      certificationDate,
      sourceUrl: `${WPC_PRODUCT_PAGE}/${id}`,
      sourceChecksum,
    }];
  });

  parsed.sort((left, right) => right.certificationDate.localeCompare(left.certificationDate)
    || Number(right.qiId.slice(3)) - Number(left.qiId.slice(3)));

  return {
    totalRecords: payload.length,
    retainedRecords: parsed.slice(0, maxRecords),
    newestCertificationDate: parsed[0]?.certificationDate ?? null,
    rejectedRecords,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseViaLicensees(html: string): string[] {
  if (html.length > 3_000_000) throw new Error("Via response is too large");
  const listBlock = html.match(/<div\s+id=["']licList["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!listBlock) throw new Error("Via licensee list was not found");

  const entries = [...listBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => decodeHtml(match[1]).slice(0, 240))
    .filter(Boolean);
  return validateViaLicensees(entries);
}

export function validateViaLicensees(payload: unknown): string[] {
  if (!Array.isArray(payload)) throw new Error("Via licensees must be an array");
  const entries = payload.map((value) => {
    if (typeof value !== "string" || value.length > 240) throw new Error("Via licensee entry is invalid");
    const cleaned = cleanText(value, 240);
    if (!cleaned || !normalizeEntityName(cleaned)) throw new Error("Via licensee entry is invalid");
    return cleaned;
  });
  const unique = [...new Map(entries.map((entry) => [normalizeEntityName(entry), entry])).values()];
  if (unique.length !== entries.length) throw new Error("Via licensee entries must be unique");
  if (unique.length < 20 || unique.length > 500) throw new Error("Via licensee list failed its record-count contract");
  return unique;
}

const ENTITY_SUFFIXES = new Set([
  "ag", "corp", "corporation", "co", "company", "gmbh", "holdings", "inc", "incorporated",
  "limited", "llc", "ltd", "nv", "plc", "pte", "sa", "sas", "spa",
]);

export function normalizeEntityName(value: string): string {
  const tokens = value.toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !ENTITY_SUFFIXES.has(token));
  return tokens.join(" ");
}

function bigrams(value: string): Set<string> {
  const compact = value.replace(/\s+/g, "");
  const result = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) result.add(compact.slice(index, index + 2));
  return result;
}

export function scoreEntityName(observedName: string, legalName: string): number {
  const observed = normalizeEntityName(observedName);
  const legal = normalizeEntityName(legalName);
  if (!observed || !legal) return 0;
  if (observed === legal) return 0.98;
  if (Math.min(observed.length, legal.length) >= 5 && (observed.includes(legal) || legal.includes(observed))) return 0.82;

  const observedTokens = new Set(observed.split(" "));
  const legalTokens = new Set(legal.split(" "));
  const tokenIntersection = [...observedTokens].filter((token) => legalTokens.has(token)).length;
  const tokenUnion = new Set([...observedTokens, ...legalTokens]).size;
  const tokenScore = tokenUnion ? tokenIntersection / tokenUnion : 0;

  const observedBigrams = bigrams(observed);
  const legalBigrams = bigrams(legal);
  const overlap = [...observedBigrams].filter((item) => legalBigrams.has(item)).length;
  const dice = observedBigrams.size + legalBigrams.size ? (2 * overlap) / (observedBigrams.size + legalBigrams.size) : 0;
  return Math.round(Math.min(0.89, tokenScore * 0.55 + dice * 0.45) * 100) / 100;
}
