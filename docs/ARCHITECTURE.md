# PoolSignal architecture

PoolSignal is an evidence-first licensing-intelligence system. Its autonomy is deliberately bounded: agents may collect, normalize, compare, score, summarize, and recommend research. They may not assert legal status, contact a company, or advance an identity-sensitive case without an explicit human decision.

## Case lifecycle

`detected → evidence_gathered → match_proposed → review_required → approved | monitor | returned`

Every transition is appended to an audit log. A policy gate evaluates identity confidence, public-snapshot semantics, forbidden language, and the requested action before allowing a transition.

## Agent contracts

| Agent | Input | Output | Mandatory abstention |
|---|---|---|---|
| Data quality | Raw source record | Contract checks and quarantine state | Missing or invalid required fields |
| Scout | Validated product signal | Market-signal evidence packet | Source recency or provenance unavailable |
| Entity resolver | Brand, domain, legal-entity candidates | Ranked candidates with evidence and confidence | Best candidate below 0.85 |
| Coverage | Approved entity candidate, dated public snapshot | `public-list`, `possible`, `none`, or `unknown` | Entity identity unavailable |
| Prioritizer | Product, recency, identity, and quality features | Transparent 0–100 review priority | Required scoring feature unavailable |
| Briefing | Case evidence and findings | Source-grounded analyst brief | Unsupported claim or missing evidence link |
| Policy gate | Full case and proposed action | Allowed actions and next stage | Any identity-sensitive or external action |

## Data layers

- **Raw:** append-only, dated, checksummed WPC and Via source snapshots. Consecutive WPC snapshots are exposed as immutable check receipts with prior/current values and an exact successful-check time.
- **Conformed:** normalized products, per-product fingerprints, entities, public-list records, and entity relationships.
- **Change control:** immutable material-field events, processing leases, retry state, dead-letter state, and idempotency keys.
- **Intelligence:** version-bound agent findings, evidence graph, feature contributions, review priority, and briefs.
- **Operations:** human decisions, synthetic campaign events, follow-up aging, and scenario assumptions.
- **Analytics:** dimensional marts for Power BI and Excel.

## Safety boundaries

- `No public-list match found` is a research result, not a licensing conclusion.
- Certification activity is not shipment volume.
- Scenario outputs require explicit human-entered volume assumptions.
- Generated briefs cannot contain unsupported assertions such as “unlicensed,” “infringing,” or “owes royalties.”
- Outreach and legal escalation are outside the demo’s action space.

## Deployment split

The public interface is deployed directly to Cloudflare Workers with D1-backed live-source, change-event, agent-run, and review state. A Worker cron refreshes WPC every six hours, compares canonical material fields with the previous per-product SHA-256 fingerprint, emits deterministic events only for additions or updates, and processes a bounded batch automatically. A scheduled GitHub Actions portability workflow fetches Via daily and publishes its checksummed, validated snapshot through a dedicated GitHub OIDC-authenticated route, avoiding Via's TLS incompatibility with Cloudflare Worker egress without introducing a shared secret. GLEIF resolution runs only from a claimed change event, applies a 20-second upstream timeout, and writes a bounded cache. The Python package contains the reproducible analytical pipeline and agent-policy reference implementation. Operational campaign, response, and quality records remain explicitly synthetic.

Mission Control reads from the newest successful D1 snapshot rather than transient polling state. Its source counts remain stable across page visits, unchanged checks, and failed refresh attempts. A newer successful check atomically becomes the displayed last-known-good state; recent successful snapshots remain available in the Change Inbox for previous-to-current comparison.

## Live request path

`WPC public feed → Worker cron → bounded validation → canonical product fields → per-product SHA-256 → durable change event or no-op`

`Via public page → scheduled portability workflow → parse + checksum → authenticated ingestion → independent revalidation → atomic D1 snapshot`

`claimed change event → idempotency check → exact GLEIF query/cache → local name score → 0.85 identity gate → dated Via-name comparison → transparent priority → policy gate → persisted human-review or monitor result`

The idempotency key binds the source event, product fingerprint, agent version, and policy version. Atomic processing leases prevent concurrent duplication; failed events receive exponential retry delays and move to a dead-letter state after three attempts. A stale 15-minute lease returns safely to the retry queue. Manual WPC refresh and change-event retry are reviewer-authenticated. Via ingestion accepts only a valid short-lived identity for the exact scheduled workflow and has no review-decision authority. Direct public live-agent reruns are rejected.
