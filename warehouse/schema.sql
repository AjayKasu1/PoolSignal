-- PoolSignal PostgreSQL analytical model
-- Raw snapshots remain immutable; these tables represent conformed and gold layers.

create schema if not exists poolsignal;

create table if not exists poolsignal.dim_date (
  date_key integer primary key,
  calendar_date date not null unique,
  month_label text not null,
  calendar_month integer not null,
  calendar_quarter integer not null,
  calendar_year integer not null
);

create table if not exists poolsignal.dim_entity (
  entity_key bigint generated always as identity primary key,
  canonical_name text not null,
  lei text,
  ultimate_parent_name text,
  country_code char(2),
  valid_from timestamptz not null,
  valid_to timestamptz,
  is_current boolean not null default true,
  unique (canonical_name, valid_from)
);

create table if not exists poolsignal.dim_product (
  product_key bigint generated always as identity primary key,
  qi_id text not null unique,
  brand text not null,
  product_name text not null,
  part_number text,
  product_type text not null check (product_type in ('PTx', 'PRx')),
  power_profile text,
  load_power_watts numeric(8,2),
  consumer_sale_indicator boolean,
  automotive_inline_indicator boolean,
  subsystem_indicator boolean
);

create table if not exists poolsignal.dim_program (
  program_key smallint generated always as identity primary key,
  program_name text not null unique,
  source_url text not null
);

create table if not exists poolsignal.fact_certification (
  certification_key bigint generated always as identity primary key,
  product_key bigint not null references poolsignal.dim_product(product_key),
  certification_date_key integer not null references poolsignal.dim_date(date_key),
  source_observed_at timestamptz not null,
  source_checksum char(64) not null,
  source_url text not null,
  unique (product_key, source_checksum)
);

create table if not exists poolsignal.fact_public_licensee_snapshot (
  snapshot_key bigint generated always as identity primary key,
  entity_key bigint references poolsignal.dim_entity(entity_key),
  program_key smallint not null references poolsignal.dim_program(program_key),
  snapshot_date_key integer not null references poolsignal.dim_date(date_key),
  public_name text not null,
  source_url text not null,
  source_checksum char(64) not null,
  unique (program_key, snapshot_date_key, public_name)
);

create table if not exists poolsignal.fact_review_case (
  case_key bigint generated always as identity primary key,
  case_id text not null unique,
  product_key bigint not null references poolsignal.dim_product(product_key),
  proposed_entity_key bigint references poolsignal.dim_entity(entity_key),
  detected_date_key integer not null references poolsignal.dim_date(date_key),
  public_list_match text not null check (public_list_match in ('public-list', 'possible', 'none', 'unknown')),
  entity_match_confidence numeric(5,4) not null check (entity_match_confidence between 0 and 1),
  review_priority smallint not null check (review_priority between 0 and 100),
  commercial_activity_score smallint not null check (commercial_activity_score between 0 and 100),
  stage text not null,
  requires_human boolean not null,
  analyst_brief text not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists poolsignal.fact_agent_finding (
  finding_key bigint generated always as identity primary key,
  case_key bigint not null references poolsignal.fact_review_case(case_key),
  agent_name text not null,
  status text not null,
  confidence numeric(5,4) not null,
  summary text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  feature_contributions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists poolsignal.fact_campaign_activity (
  activity_key bigint generated always as identity primary key,
  case_key bigint not null references poolsignal.fact_review_case(case_key),
  activity_date_key integer not null references poolsignal.dim_date(date_key),
  stage text not null,
  activity_type text not null,
  owner_name text not null,
  next_due_date date,
  synthetic_record boolean not null default true,
  note text
);

create table if not exists poolsignal.fact_review_event (
  event_key bigint generated always as identity primary key,
  case_key bigint not null references poolsignal.fact_review_case(case_key),
  decision text not null,
  rationale text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create table if not exists poolsignal.fact_data_quality_issue (
  issue_key bigint generated always as identity primary key,
  detected_date_key integer not null references poolsignal.dim_date(date_key),
  check_name text not null,
  severity text not null,
  status text not null,
  observed_value numeric,
  threshold_value numeric,
  record_locator text,
  note text
);

create index if not exists fact_review_case_priority_idx
  on poolsignal.fact_review_case (stage, review_priority desc);
create index if not exists fact_campaign_next_due_idx
  on poolsignal.fact_campaign_activity (next_due_date) where next_due_date is not null;
create index if not exists dim_entity_current_name_idx
  on poolsignal.dim_entity (canonical_name) where is_current;

create or replace view poolsignal.mart_review_queue as
select
  c.case_id,
  p.qi_id,
  p.brand,
  p.product_name,
  p.product_type,
  p.power_profile,
  p.load_power_watts,
  e.canonical_name as proposed_entity,
  c.entity_match_confidence,
  c.public_list_match,
  c.review_priority,
  c.commercial_activity_score,
  c.stage,
  c.requires_human,
  c.analyst_brief,
  c.updated_at
from poolsignal.fact_review_case c
join poolsignal.dim_product p on p.product_key = c.product_key
left join poolsignal.dim_entity e on e.entity_key = c.proposed_entity_key;
