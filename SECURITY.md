# Security and responsible disclosure

PoolSignal is a portfolio demonstration using representative public records and synthetic operational data. Do not add personal contacts, confidential licensing records, production CRM exports, or API credentials.

## Controls

- No external outreach capability
- Policy-gated identity decisions
- D1 prepared statements through Drizzle
- Reviewer-token authorization before any D1 write
- Server-derived case data, decision allowlists, body limits, and generic error responses
- Non-persistent public agent execution with no outreach capability
- HTTPS redirection, CSP, HSTS, clickjacking protection, and restrictive browser permissions
- Environment-managed secrets only
- Source-checksum and audit-event design

## Dependency audit

As of 2026-07-14, both `npm audit` and `npm audit --omit=dev` report zero known vulnerabilities. The lockfile pins patched PostCSS, Vite, Cloudflare Vite plugin, Wrangler, Undici, and WebSocket dependency paths.

Report security concerns privately to the repository owner. Do not include sensitive data in a public issue.
