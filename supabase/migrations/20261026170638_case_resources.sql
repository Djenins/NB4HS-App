-- Case Management > Resources: a staff-maintained directory of outside
-- agencies and referral partners (housing, legal aid, clinics, ...) that
-- case managers send clients to. Organizations, not people we serve, so it
-- is separate from clients/case_clients.
create table if not exists public.case_resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'other',
  contact_name text,
  phone text,
  email text,
  website text,
  address text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.case_resources enable row level security;

create policy case_resources_select on public.case_resources for select to authenticated using (is_staff());
create policy case_resources_insert on public.case_resources for insert to authenticated with check (is_staff());
create policy case_resources_update on public.case_resources for update to authenticated using (is_staff()) with check (is_staff());
create policy case_resources_delete on public.case_resources for delete to authenticated using (is_staff());

alter publication supabase_realtime add table public.case_resources;
