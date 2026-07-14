# PoolSignal model card

## Intended use

PoolSignal ranks product signals for analyst research, proposes entity candidates, compares approved identities with a dated public list, and drafts evidence-grounded briefs. It is a decision-support system, not an autonomous licensing, legal, compliance, or outreach system.

## Non-intended use

- Determining whether a product or company is licensed
- Determining infringement, compliance, liability, or royalties owed
- Inferring shipment volume from certification counts
- Sending notices, messages, or legal escalations
- Automatically accepting low-confidence entity matches

## Evaluation

Entity resolution should be evaluated on a manually labeled brand-to-legal-entity set using precision, recall, F1, coverage, and abstention rate. The production acceptance criterion is precision-first: any automatic match threshold must demonstrate at least 0.95 precision on an appropriately representative holdout before it can be considered for automation. The current portfolio values are illustrative until a larger labeled set is created.

Briefing should be evaluated for:

- Evidence entailment
- Citation completeness
- Unsupported-claim rate
- Forbidden-language violations
- Correct abstention
- Human usefulness

## Failure modes

- Short or generic brands may map to unrelated legal entities.
- Public lists may use subsidiaries, historical names, or affiliates.
- Product registrants may not be the entity responsible for offering a finished product for sale.
- Source schemas and program terms may change.
- Missing public data is not negative evidence.

## Controls

- Deterministic source validation before agent execution
- Entity-confidence threshold and explicit abstention
- Separate entity confidence, commercial signal, and review priority
- Dated public-snapshot semantics
- Forbidden-assertion validator
- Human-gated stage transitions
- Append-only audit events
- Versioned scoring features and source checksums
