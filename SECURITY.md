# Security and responsible disclosure

PoolSignal is a public demonstration environment using live public-source data and synthetic operational data only. Do not add personal contacts, confidential licensing records, production CRM exports, or API credentials.

## Controls

- No external outreach capability
- Policy-gated identity decisions
- Parameterized D1 access through Drizzle and prepared statements
- Reviewer-token authorization before review-event reads and human review writes
- Scheduled WPC ingestion through the Worker runtime and short-lived, repository/workflow-scoped GitHub OIDC for Via ingestion
- Constant-time reviewer-token comparison, a 32-byte minimum secret, and Cloudflare API rate limits
- Server-derived case data, decision allowlists, body limits, and generic error responses
- Upstream response-size limits, source-specific timeouts, parser contracts, and source checksums
- Public execution limited to bounded synthetic cases; live agents execute only from durable source-change events
- HTTPS redirection, framework-compatible CSP, HSTS, clickjacking protection, cross-origin resource controls, and restrictive browser permissions
- Environment-managed secrets only
- Source-checksum and audit-event design

## Deployment boundary

- The public demo uses one shared reviewer secret, not individual user identity, SSO, or role-based access control. Replace it with organization-managed identity and RBAC before connecting private or customer data.
- API rate limits are Cloudflare location-scoped abuse controls, not exact accounting controls.
- The CSP blocks third-party scripts and inline script attributes, but permits framework-generated inline scripts and application inline styles. A nonce-based CSP would require per-request dynamic rendering and removal of edge HTML caching.
- Review data must remain synthetic in this deployment. The authenticated review-event endpoint is not a substitute for an enterprise case-management system.

## Dependency audit

As of 2026-07-16, both `npm audit` and `npm audit --omit=dev` report zero known vulnerabilities. The lockfile pins patched PostCSS, Vite, Cloudflare Vite plugin, Wrangler, Undici, and WebSocket dependency paths.

Report security concerns privately to the repository owner. Do not include sensitive data in a public issue.
