# Data sources and use boundaries

| Source | Use | Boundary |
|---|---|---|
| WPC Qi Product Database | Six-hour product-certification signals and evidence links | The monitor retains at most 500 records from the latest 180 days; certification is not shipment volume or patent-license status |
| Via Qi Wireless Power page | Daily, dated public licensee-name snapshots | Public-list membership does not establish product coverage; the actual agreement controls |
| GLEIF API | Cached, on-demand legal-name and LEI candidates | Matching is name-based, only candidates at or above 0.85 can reach snapshot comparison, and missing LEI data is not negative evidence |
| Synthetic CRM records | Workflow, response, owner, and follow-up demonstrations | No real contacts, notices, responses, or outreach |

Sources:

- https://jpsapi.wirelesspowerconsortium.com/products/qi
- https://www.wirelesspowerconsortium.com/standards/qi-wireless-charging/
- https://www.via-la.com/licensing-programs/qi-wireless-power/
- https://www.gleif.org/en/lei-data/gleif-api/

Automated retrieval must respect source terms, robots policies, rate limits, and caching requirements. The repository ships a small representative extract so the demonstration can run without bulk collection.

## Live ingestion contract

- WPC: the Worker reads the JSON feed used by the public WPC product interface every six hours. It checks response size, JSON shape, record-count floor, field types, date shape, product type, and power range before writing. The complete response is checksummed, but only the bounded monitoring window is stored in conformed tables. Each retained product also receives a SHA-256 fingerprint over Qi ID, brand, product name, part number, product type, power profile, load power, version, and certification date. Transport metadata is excluded. Only a new or changed fingerprint emits a durable event.
- Via: a daily GitHub Actions portability workflow, also triggered when its parser changes on `main`, reads the official public Qi program page and extracts only the bounded `licList` section. It publishes a signed snapshot to a dedicated ingestion route because Via's origin returns TLS 525 to Cloudflare Worker egress. The route cryptographically verifies a short-lived GitHub OIDC identity for this repository, workflow, and `main` branch, then revalidates source URL, capture time, SHA-256 shape, uniqueness, field length, and record count. Replacing the active snapshot and recording its metadata is one D1 batch, so readers do not observe a partial list.
- GLEIF: an automatically claimed WPC change event performs an exact legal-name query for the observed brand. Results are rescored locally, cached for seven days, and treated as candidates rather than established identity. Empty results are cached for one day. Repeated events with the same fingerprint and engine versions return the persisted result rather than querying again.

All three sources are public and currently require no source account, API key, or email registration. A deployment-managed PoolSignal reviewer token protects manual WPC refresh. Via uses short-lived workload identity rather than a stored token. Scheduled source access needs no third-party credential.

## Failure behavior

The last successful WPC and Via snapshots remain queryable if a source is temporarily unavailable or changes shape. Agent-event failures retry with bounded exponential delays; three failed attempts move the event to a dead-letter state for an authenticated operator. Expired processing leases are recovered automatically. A GLEIF failure makes the Resolver abstain. Source absence, entity-resolution absence, and public-list absence are never converted into a licensing conclusion.
