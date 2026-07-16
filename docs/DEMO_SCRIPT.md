# PoolSignal interview demo

## Opening — 30 seconds

“PoolSignal is an evidence-first licensing-intelligence system. I built it around a realistic analyst problem: how to turn product, entity, public-program, and CRM signals into an actionable research queue without confusing a signal with a legal conclusion. Its agents can investigate and recommend, but identity-sensitive decisions stop at a human gate.”

## Mission control — 60 seconds

Point to “Sources checked. No new evidence,” the retained WPC catalog total, the 500 tracked fingerprints, the Via public-name count, and the disabled top control. Explain that these are last-known-good values: they remain visible until a newer source check succeeds. Open the Change Inbox and compare the exact timestamps, prior/current record counts, and SHA-256 digests on two successful check receipts. Show that a repeated snapshot creates no work. Explain that additions or material updates create deterministic events that are processed once and retained with agent and policy versions.

## Agent trace — 90 seconds

Walk through Scout, Resolver, Coverage, Prioritizer, and Policy Gate. Show the confidence on every handoff. Explain the idempotency key, processing lease, bounded retry, and dead-letter path. Emphasize that an ambiguous identity cannot clear the 0.85 threshold. The policy gate allows research or monitoring but no external action.

## Human review — 90 seconds

Open the queue, select GEYOTO or Luxshare-ICT, and inspect the evidence and caution box. Explain the distinction among certification, legal entity, public-list name, product coverage, and shipment volume. Record one demonstration decision and point out that the event is persisted with a timestamp.

## Campaign operations — 60 seconds

Show the synthetic funnel and aging view. Explain that this mirrors a Salesforce-style workflow: owner, stage, last touch, next due date, response state, and next-best action. All records are synthetic and the demo cannot send anything.

## Scenario lab — 60 seconds

Change annual units, product fee, and illustrative discount. Explain that the waiver is applied at the enterprise level and the model shows low/base/high amounts. Stress that units are explicit assumptions; certifications are not a volume proxy.

## Excel and Power BI — 60 seconds

Open the workbook dashboard and one operational sheet. Show formulas, dropdown validation, conditional formatting, source URLs, QA exceptions, and the scenario-input cells. Mention that the repository also includes conformed CSVs, relationship guidance, a PostgreSQL warehouse, and DAX measures.

## Close — 30 seconds

“The value is not just the dashboard. It is the governed path from a messy source signal to an evidence-backed, reviewable business action. I wanted to show that I can combine market intelligence, SQL, Python, BI, Excel, data quality, and practical AI in a legally sensitive workflow.”
