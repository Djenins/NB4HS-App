-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Employer & Job Opportunity Management, Phase 3: Candidate Matching + Referrals.
-- Mirrors employers/job_openings conventions (list-level table, has_role RLS,
-- realtime publication).

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  job_client_id uuid not null references public.job_clients(id) on delete cascade,
  job_opening_id uuid not null references public.job_openings(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  status text not null default 'ready',
  referral_date date not null default current_date,
  interview_date date,
  assigned_job_developer_email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index referrals_job_client_id_idx on public.referrals(job_client_id);
create index referrals_job_opening_id_idx on public.referrals(job_opening_id);
create index referrals_employer_id_idx on public.referrals(employer_id);

alter table public.referrals enable row level security;

create policy referrals_select on public.referrals for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy referrals_insert on public.referrals for insert to authenticated
  with check (has_role(array['administrator','job_developer']));
create policy referrals_update on public.referrals for update to authenticated
  using (has_role(array['administrator','job_developer'])) with check (has_role(array['administrator','job_developer']));
create policy referrals_delete on public.referrals for delete to authenticated
  using (has_role(array['administrator','job_developer']));

alter publication supabase_realtime add table public.referrals;
