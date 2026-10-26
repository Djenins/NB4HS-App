-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Employer & Job Opportunity Management, Phase 2: Job Openings.
-- Mirrors the employers table's conventions (list-level table, has_role RLS,
-- realtime publication) from Phase 1.

create table public.job_openings (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  title text not null,
  department text,
  description text,
  responsibilities text,
  requirements text,
  education text,
  experience text,
  certifications text[] not null default '{}',
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  pay_type text,
  pay_min numeric,
  pay_max numeric,
  employment_type text,
  schedule text,
  hours_per_week text,
  benefits text,
  start_date date,
  openings_count integer not null default 1,
  application_deadline date,
  transportation_required boolean not null default false,
  english_level_required text,
  apply_method text,
  apply_website text,
  apply_email text,
  internal_notes text,
  status text not null default 'draft',
  source text not null default 'staff_added',
  posted_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_openings_employer_id_idx on public.job_openings(employer_id);

alter table public.job_openings enable row level security;

create policy job_openings_select on public.job_openings for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy job_openings_insert on public.job_openings for insert to authenticated
  with check (has_role(array['administrator','job_developer']));
create policy job_openings_update on public.job_openings for update to authenticated
  using (has_role(array['administrator','job_developer'])) with check (has_role(array['administrator','job_developer']));
create policy job_openings_delete on public.job_openings for delete to authenticated
  using (has_role(array['administrator','job_developer']));

alter publication supabase_realtime add table public.job_openings;
