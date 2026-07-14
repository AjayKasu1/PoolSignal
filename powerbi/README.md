# Power BI handoff

The `data/` directory contains a compact star-schema extract suitable for Power BI Desktop, Tableau, or another BI tool. The production model is defined in `warehouse/schema.sql`.

## Recommended relationships

- `dim_product[product_key]` 1 → many `fact_review_case[product_key]`
- `dim_entity[entity_key]` 1 → many `fact_review_case[proposed_entity_key]`
- `dim_date[date_key]` 1 → many `fact_review_case[detected_date_key]`
- `fact_review_case[case_id]` 1 → many `fact_campaign_activity[case_id]`

Use single-direction filters from dimensions to facts. Keep the certification and campaign facts connected through conformed dimensions instead of direct many-to-many joins.

## Report pages

1. Executive overview
2. Market intelligence
3. Human review queue
4. Campaign operations
5. Scenario assumptions
6. Data quality

The included DAX file defines auditable measures for active cases, high-priority cases, match confidence, aging, and response rate.
