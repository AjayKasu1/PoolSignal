const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_OIDC_JWKS = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const EXPECTED_AUDIENCE = "poolsignal-via-ingest";
const EXPECTED_REPOSITORY = "AjayKasu1/PoolSignal";
const EXPECTED_REF = "refs/heads/main";
const EXPECTED_WORKFLOW_REF = `${EXPECTED_REPOSITORY}/.github/workflows/via-snapshot.yml@${EXPECTED_REF}`;

type JsonObject = Record<string, unknown>;
type GitHubClaims = JsonObject & {
  aud?: string | string[];
  event_name?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  nbf?: number;
  ref?: string;
  repository?: string;
  runner_environment?: string;
  workflow_ref?: string;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeJson(value: string): JsonObject | null {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : null;
  } catch {
    return null;
  }
}

function claimsAreAllowed(claims: GitHubClaims, nowSeconds: number): boolean {
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const timeIsValid = typeof claims.exp === "number" && claims.exp >= nowSeconds - 30
    && typeof claims.nbf === "number" && claims.nbf <= nowSeconds + 30
    && typeof claims.iat === "number" && claims.iat <= nowSeconds + 30 && claims.iat >= nowSeconds - 600;
  return claims.iss === GITHUB_OIDC_ISSUER
    && audiences.includes(EXPECTED_AUDIENCE)
    && claims.repository?.toLowerCase() === EXPECTED_REPOSITORY.toLowerCase()
    && claims.ref === EXPECTED_REF
    && claims.workflow_ref?.toLowerCase() === EXPECTED_WORKFLOW_REF.toLowerCase()
    && ["schedule", "workflow_dispatch"].includes(claims.event_name ?? "")
    && claims.runner_environment === "github-hosted"
    && timeIsValid;
}

export async function verifyGitHubActionsOidc(
  token: string,
  fetcher: Fetcher = fetch,
  now = new Date(),
): Promise<boolean> {
  if (!token || token.length > 12_000) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const header = decodeJson(parts[0]);
  const claims = decodeJson(parts[1]) as GitHubClaims | null;
  if (!header || !claims || header.alg !== "RS256" || header.typ !== "JWT" || typeof header.kid !== "string") return false;
  if (!claimsAreAllowed(claims, Math.floor(now.getTime() / 1_000))) return false;

  const response = await fetcher(GITHUB_OIDC_JWKS, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("GitHub OIDC keys are unavailable");
  const payload = await response.json() as { keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
  const key = payload.keys?.find((candidate) => candidate.kid === header.kid && candidate.alg === "RS256" && candidate.use === "sig");
  if (!key) return false;

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signature = decodeBase64Url(parts[2]);
  if (!signature) return false;
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
}
