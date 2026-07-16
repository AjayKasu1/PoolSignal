# PoolSignal product walkthrough

This walkthrough presents the system from source ingestion to governed human review. It focuses on operational behavior, evidence boundaries, and the distinction between live public facts and synthetic workflow examples.

## 1. Source monitoring

Start in Mission Control and review the retained WPC catalog total, tracked product fingerprints, Via public-name count, and latest successful source-check time. These are last-known-good values and remain visible until a newer check succeeds.

Open the Change Inbox and compare two source-check receipts. Each receipt records its timestamp, previous and current counts, rejected rows, raw-source digest, and material-change outcome. An unchanged snapshot creates no downstream work.

## 2. Durable change processing

Inspect a material product change and its field-level diff. Each accepted change creates a deterministic event bound to the source fingerprint, agent version, and policy version. Repeated delivery is idempotent, processing is leased, retries are bounded, and terminal failures move to a dead-letter state for investigation.

## 3. Agent trace

Follow the Scout, Resolver, Coverage, Prioritizer, and Policy Gate handoffs. Every step exposes its evidence, confidence, status, and abstention path.

The Resolver proposes legal-entity candidates but cannot approve an ambiguous identity. The Coverage agent compares only an approved identity with a dated public snapshot. The Policy Gate permits research or monitoring while preventing external action.

## 4. Human review

Open a representative queue case and inspect its product evidence, entity confidence, public-list comparison, and caution statement. Certification, legal identity, public-list presence, product coverage, and shipment volume remain separate concepts.

An authenticated approve, monitor, or return decision creates an append-only review event with its actor and timestamp. Without reviewer authorization, the interface clearly labels the action as a local preview and does not write to the database.

## 5. Synthetic campaign operations

Review the synthetic campaign funnel, aging distribution, and next-best-action examples. The workflow models operational concepts such as owner, stage, last touch, next due date, and response state without containing real contacts or sending messages.

## 6. Scenario analysis

Adjust annual enterprise units, illustrative per-product fees, and the modeled discount. Every input is explicit, the waiver is applied at the enterprise level, and the output includes low, base, and high scenarios. Certification counts are never used as a shipment-volume proxy.

## 7. Analytical artifacts

The Excel review pack includes formulas, validation, conditional formatting, source references, scenario controls, and QA checks. The repository also includes Power BI-ready dimensional extracts, DAX measures, and a PostgreSQL warehouse model.

## 8. Data quality and governance

Finish in Data Quality to review source freshness, schema stability, referential integrity, evidence coverage, entity abstention, and rule validation. Displayed operational examples are labeled synthetic or illustrative, while live public-source facts retain source links and timestamps.

PoolSignal is a decision-support system. It converts messy public signals into evidence-backed, reviewable research actions without making licensing-status, legal, shipment-volume, or outreach decisions.
