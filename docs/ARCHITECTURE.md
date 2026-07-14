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

- **Raw:** immutable, dated, checksummed source snapshots.
- **Conformed:** normalized products, entities, public-list records, and entity relationships.
- **Intelligence:** agent findings, evidence graph, feature contributions, review priority, and briefs.
- **Operations:** human decisions, synthetic campaign events, follow-up aging, and scenario assumptions.
- **Analytics:** dimensional marts for Power BI and Excel.

## Safety boundaries

- `No public-list match found` is a research result, not a licensing conclusion.
- Certification activity is not shipment volume.
- Scenario outputs require explicit human-entered volume assumptions.
- Generated briefs cannot contain unsupported assertions such as “unlicensed,” “infringing,” or “owes royalties.”
- Outreach and legal escalation are outside the demo’s action space.

## Deployment split

The portfolio interface is deployed as a Cloudflare-compatible Sites application with D1-backed review events. The Python package contains the reproducible analytical pipeline and agent-policy reference implementation. The public demo uses representative public records and clearly marked synthetic operational data.
