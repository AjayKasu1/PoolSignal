import assert from "node:assert/strict";
import test from "node:test";

import { verifyGitHubActionsOidc } from "../lib/github-oidc.ts";

function base64Url(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return Buffer.from(bytes).toString("base64url");
}

async function signedToken(overrides = {}) {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const now = Math.floor(Date.parse("2026-07-15T22:00:00Z") / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", kid: "test-key", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: "https://token.actions.githubusercontent.com",
    aud: "poolsignal-via-ingest",
    exp: now + 300,
    nbf: now - 30,
    iat: now,
    repository: "AjayKasu1/PoolSignal",
    ref: "refs/heads/main",
    workflow_ref: "AjayKasu1/PoolSignal/.github/workflows/via-snapshot.yml@refs/heads/main",
    event_name: "workflow_dispatch",
    runner_environment: "github-hosted",
    ...overrides,
  }));
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    pair.privateKey,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const fetcher = async () => Response.json({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] });
  return { fetcher, token: `${header}.${claims}.${base64Url(signature)}` };
}

test("GitHub OIDC verifier accepts only the scheduled PoolSignal workflow identity", async () => {
  const valid = await signedToken();
  assert.equal(await verifyGitHubActionsOidc(valid.token, valid.fetcher, new Date("2026-07-15T22:00:00Z")), true);

  const wrongBranch = await signedToken({ ref: "refs/heads/feature" });
  assert.equal(await verifyGitHubActionsOidc(wrongBranch.token, wrongBranch.fetcher, new Date("2026-07-15T22:00:00Z")), false);

  const wrongAudience = await signedToken({ aud: "another-service" });
  assert.equal(await verifyGitHubActionsOidc(wrongAudience.token, wrongAudience.fetcher, new Date("2026-07-15T22:00:00Z")), false);

  const wrongEvent = await signedToken({ event_name: "pull_request" });
  assert.equal(await verifyGitHubActionsOidc(wrongEvent.token, wrongEvent.fetcher, new Date("2026-07-15T22:00:00Z")), false);
});
