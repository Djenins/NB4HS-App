-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Grant reporting support: funder/grant tagging + client demographics
create table public.grants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  funder text,
  period_start date,
  period_end date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.grants enable row level security;

create policy "authenticated read grants"
  on public.grants for select
  to authenticated
  using (true);

create policy "authenticated write grants"
  on public.grants for all
  to authenticated
  using (true)
  with check (true);

create table public.service_grant_tags (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.grants(id) on delete cascade,
  record_table text not null,
  record_id uuid not null,
  created_at timestamptz not null default now(),
  unique (grant_id, record_table, record_id)
);

alter table public.service_grant_tags enable row level security;

create policy "authenticated read service_grant_tags"
  on public.service_grant_tags for select
  to authenticated
  using (true);

create policy "authenticated write service_grant_tags"
  on public.service_grant_tags for all
  to authenticated
  using (true)
  with check (true);

create index service_grant_tags_record_idx
  on public.service_grant_tags (record_table, record_id);

alter table public.clients
  add column race_ethnicity text,
  add column gender text,
  add column household_income_bracket text,
  add column household_size integer;
