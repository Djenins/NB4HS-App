-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Admin-configurable Workforce Development role access. Administrator
-- always has access (not stored here -- it's the role that manages this
-- setting), one row per other role that can be granted/revoked from the UI.

create table public.workforce_role_access (
  role text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.workforce_role_access (role, enabled) values
  ('staff', false),
  ('receptionist', false),
  ('case_manager', false),
  ('job_developer', true);

alter table public.workforce_role_access enable row level security;

create policy workforce_role_access_select on public.workforce_role_access for select to authenticated
  using (true);
create policy workforce_role_access_update on public.workforce_role_access for update to authenticated
  using (has_role(array['administrator'])) with check (has_role(array['administrator']));

alter publication supabase_realtime add table public.workforce_role_access;
