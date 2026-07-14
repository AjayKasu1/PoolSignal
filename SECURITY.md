# Security and responsible disclosure

PoolSignal is a portfolio demonstration using representative public records and synthetic operational data. Do not add personal contacts, confidential licensing records, production CRM exports, or API credentials.

## Controls

- No external outreach capability
- Policy-gated identity decisions
- D1 prepared statements through Drizzle
- Input validation on review events
- Environment-managed secrets only
- Source-checksum and audit-event design

## Dependency audit

As of 2026-07-14, `npm audit --omit=dev` reports two moderate transitive PostCSS findings through the starter-pinned Next.js dependency. The automated force fix proposes a breaking downgrade and has not been applied. Re-evaluate the pinned Sites/vinext stack before production use and adopt the upstream patched dependency when it is compatible.

Report security concerns privately to the repository owner. Do not include sensitive data in a public issue.
