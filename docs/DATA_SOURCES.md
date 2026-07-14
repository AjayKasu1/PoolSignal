# Data sources and use boundaries

| Source | Use | Boundary |
|---|---|---|
| WPC Qi Product Database | Product certification signals and evidence links | Certification is not shipment volume or patent-license status |
| Via Qi Wireless Power page | Dated public licensee snapshots, public rate mechanics, patent-list links | Public-list membership does not establish product coverage; the actual agreement controls |
| GLEIF API | Legal names and parent/child relationships when available | Missing LEI data is not negative evidence |
| Synthetic CRM records | Workflow, response, owner, and follow-up demonstrations | No real contacts, notices, responses, or outreach |

Sources:

- https://jpsapi.wirelesspowerconsortium.com/products/qi
- https://www.wirelesspowerconsortium.com/standards/qi-wireless-charging/
- https://www.via-la.com/licensing-programs/qi-wireless-power/
- https://www.gleif.org/en/lei-data/gleif-api/

Automated retrieval must respect source terms, robots policies, rate limits, and caching requirements. The repository ships a small representative extract so the demonstration can run without bulk collection.
