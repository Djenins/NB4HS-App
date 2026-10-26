-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Employer & Job Opportunity Management, Phase 4: Placements.
-- placements.job_opening_id/referral_id deliberately use ON DELETE SET NULL
-- (not CASCADE like the rest of this schema) -- a placement is a historical
-- outcome record and shouldn't disappear just because the posting or
-- referral it originated from is later deleted/archived.

create table public.placements (
  id uuid primary key default gen_random_uuid(),
  job_client_id uuid not null references public.job_clients(id) on delete cascade,
  employer_id uuid not null references public.employers(id) on delete cascade,
  job_opening_id uuid references public.job_openings(id) on delete set null,
  referral_id uuid references public.referrals(id) on delete set null,
  position_title text not null,
  start_date date not null default current_date,
  hourly_wage numeric,
  hours_per_week text,
  benefits text,
  supervisor_name text,
  supervisor_contact text,
  current_status text not null default 'active',
  end_date date,
  reason_for_leaving text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.placement_checkins (
  id uuid primary key default gen_random_uuid(),
  placement_id uuid not null references public.placements(id) on delete cascade,
  checkin_type text not null,
  due_date date not null,
  completed boolean not null default false,
  completed_date date,
  performance_rating text,
  attendance_notes text,
  promotion boolean not null default false,
  raise boolean not null default false,
  employer_feedback text,
  participant_feedback text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index placements_job_client_id_idx on public.placements(job_client_id);
create index placements_employer_id_idx on public.placements(employer_id);
create index placement_checkins_placement_id_idx on public.placement_checkins(placement_id);

alter table public.placements enable row level security;
alter table public.placement_checkins enable row level security;

create policy placements_select on public.placements for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy placements_insert on public.placements for insert to authenticated
  with check (has_role(array['administrator','job_developer']));
create policy placements_update on public.placements for update to authenticated
  using (has_role(array['administrator','job_developer'])) with check (has_role(array['administrator','job_developer']));
create policy placements_delete on public.placements for delete to authenticated
  using (has_role(array['administrator','job_developer']));

create policy placement_checkins_select on public.placement_checkins for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy placement_checkins_insert on public.placement_checkins for insert to authenticated
  with check (has_role(array['administrator','job_developer']));
create policy placement_checkins_update on public.placement_checkins for update to authenticated
  using (has_role(array['administrator','job_developer'])) with check (has_role(array['administrator','job_developer']));
create policy placement_checkins_delete on public.placement_checkins for delete to authenticated
  using (has_role(array['administrator','job_developer']));

alter publication supabase_realtime add table public.placements;
alter publication supabase_realtime add table public.placement_checkins;
