-- Staff Reporting Stage R1 -- biweekly staff reports to the Executive
-- Director (plans/staff-reporting-architecture.md §5). ADDITIVE ONLY: new
-- tables, functions and triggers; one `programs` registry row (its module
-- CHECK widened); program_staff's role CHECK made per-program; one nullable
-- column on notifications. Reminders (R2), email (R3) and
-- attachments (R4) are separate migrations. APPLIED to vkbzarlkqzvhsfdmxyyq
-- 2026-10-26 (version 20261026075822) after a rolled-back dry run of
-- supabase/tests/staff_reports_r1_check.sql passed.
--
-- Decisions (2026-10-26):
-- * Organization-wide, not a SNAP program. Reviewer permission reuses
--   program_staff: program 'staff_reports', role 'reviewer' (reads and
--   reviews every report) or 'program_admin' (configures the schedule,
--   departments and reviewers). A system administrator configures but does
--   not read reports unless also granted 'reviewer' -- same rule as SNAP.
-- * One report per staff member x department x reporting period.
-- * Periods are every `period_days` days from `first_period_start` -- never
--   "twice a month". Deadlines are computed in the schedule's own time zone,
--   so DST is the tz database's job, not ours.
-- * Status only changes through the security-definer RPCs below; a staff
--   member can edit only their own draft or a report sent back for revision,
--   and never on someone else's behalf.

-- ============ programs / program_staff: register staff_reports ============
-- O1 made program_staff.program reference the `programs` registry, whose
-- `module` column anticipates programs outside Outreach. Staff Reports is
-- one: its own module, so the Outreach UI (module = 'outreach') never lists
-- it. case_number_prefix is required by the registry but unused here.
alter table public.programs drop constraint programs_module_check;
alter table public.programs add constraint programs_module_check check (module in ('outreach', 'staff_reporting'));
insert into public.programs (key, module, name_en, name_ht, name_fr, case_number_prefix, features)
values ('staff_reports', 'staff_reporting', 'Staff Reports', 'Rapò Anplwaye yo', 'Rapports du personnel', 'RPT', '{}');

alter table public.program_staff drop constraint program_staff_program_role_check;
alter table public.program_staff add constraint program_staff_program_role_check check (
  (program <> 'staff_reports' and program_role in ('worker', 'supervisor', 'program_admin'))
  or (program = 'staff_reports' and program_role in ('reviewer', 'program_admin'))
);

create or replace function public.is_report_reviewer()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_program_role('staff_reports', array['reviewer']) $$;
revoke all on function public.is_report_reviewer() from public, anon;
grant execute on function public.is_report_reviewer() to authenticated;

-- ============ notifications: a page to open ============
alter table public.notifications add column link text check (link is null or link ~ '^/[A-Za-z0-9/_-]*$');

-- ============ departments ============
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();
alter table public.departments enable row level security;
create policy departments_select on public.departments for select to authenticated using (is_staff());
create policy departments_insert on public.departments for insert to authenticated with check (can_manage_program('staff_reports'));
create policy departments_update on public.departments for update to authenticated
  using (can_manage_program('staff_reports')) with check (can_manage_program('staff_reports'));
-- No delete policy: retire a department with active = false.

insert into public.departments (key, name, sort_order) values
  ('adult_education', 'Adult Education / ESL', 10),
  ('case_management', 'Case Management', 20),
  ('workforce_development', 'Workforce Development', 30),
  ('snap_outreach', 'SNAP Outreach', 40),
  ('food_distribution', 'Food Distribution', 50),
  ('administration', 'Administration', 60);

-- ============ staff_departments ============
create table public.staff_departments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, department_id)
);
create index staff_departments_department_idx on public.staff_departments (department_id) where active;
create trigger staff_departments_set_updated_at before update on public.staff_departments
  for each row execute function public.set_updated_at();
alter table public.staff_departments enable row level security;
create policy staff_departments_select on public.staff_departments for select to authenticated
  using ((user_id = auth.uid() and is_staff()) or is_report_reviewer() or can_manage_program('staff_reports'));
create policy staff_departments_insert on public.staff_departments for insert to authenticated
  with check (can_manage_program('staff_reports'));
create policy staff_departments_update on public.staff_departments for update to authenticated
  using (can_manage_program('staff_reports')) with check (can_manage_program('staff_reports'));
-- No delete policy: unassign with active = false so history keeps its meaning.

-- ============ reporting_schedules ============
create table public.reporting_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  first_period_start date not null,
  period_days int not null default 14 check (period_days between 7 and 62),
  deadline_days_after_end int not null default 1 check (deadline_days_after_end between 0 and 30),
  deadline_time time not null default '17:00',
  time_zone text not null default 'America/New_York',
  grace_hours int not null default 0 check (grace_hours between 0 and 168),
  reminder_offsets int[] not null default '{-3,-1,0,1}',
  applies_to_all boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reminder_offsets <@ array[-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7])
);
create trigger reporting_schedules_set_updated_at before update on public.reporting_schedules
  for each row execute function public.set_updated_at();

create or replace function public.reporting_schedule_rules()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.time_zone) then
    raise exception 'unknown time zone %', new.time_zone using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.reporting_schedule_rules() from public, anon, authenticated;
create trigger reporting_schedules_rules before insert or update on public.reporting_schedules
  for each row execute function public.reporting_schedule_rules();

alter table public.reporting_schedules enable row level security;
create policy reporting_schedules_select on public.reporting_schedules for select to authenticated using (is_staff());
create policy reporting_schedules_insert on public.reporting_schedules for insert to authenticated
  with check (can_manage_program('staff_reports'));
create policy reporting_schedules_update on public.reporting_schedules for update to authenticated
  using (can_manage_program('staff_reports')) with check (can_manage_program('staff_reports'));

create table public.reporting_schedule_departments (
  schedule_id uuid not null references public.reporting_schedules(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  primary key (schedule_id, department_id)
);
alter table public.reporting_schedule_departments enable row level security;
create policy reporting_schedule_departments_select on public.reporting_schedule_departments for select to authenticated using (is_staff());
create policy reporting_schedule_departments_insert on public.reporting_schedule_departments for insert to authenticated
  with check (can_manage_program('staff_reports'));
create policy reporting_schedule_departments_delete on public.reporting_schedule_departments for delete to authenticated
  using (can_manage_program('staff_reports'));

-- The approved default (2026-10-26): 14-day periods from Mon Nov 2 2026,
-- due the Monday after each period ends at 5:00 PM New York time.
insert into public.reporting_schedules (name, first_period_start, created_by)
values ('Biweekly staff report', date '2026-11-02', null);

-- ============ reporting_periods ============
-- Materialized from the schedule by ensure_reporting_periods(); never
-- written by clients.
create table public.reporting_periods (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.reporting_schedules(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, period_start),
  check (period_end >= period_start)
);
create index reporting_periods_due_idx on public.reporting_periods (due_at);
alter table public.reporting_periods enable row level security;
create policy reporting_periods_select on public.reporting_periods for select to authenticated using (is_staff());

-- A period's deadline: (period_end + N days) at the deadline's wall-clock
-- time in the schedule's zone.
create or replace function public.reporting_due_at(s public.reporting_schedules, p_period_end date)
returns timestamptz
language sql stable set search_path = public
as $$ select ((p_period_end + s.deadline_days_after_end) + s.deadline_time) at time zone s.time_zone $$;
revoke all on function public.reporting_due_at(public.reporting_schedules, date) from public, anon, authenticated;

-- Creates every period of every active schedule from its first period up to
-- the next one after "today" in that schedule's zone (so staff can see what
-- is coming). Idempotent; safe to call from any read path.
create or replace function public.ensure_reporting_periods()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.reporting_schedules;
  local_today date;
  last_index int;
  i int;
  start_day date;
begin
  for s in select * from public.reporting_schedules where active loop
    local_today := (now() at time zone s.time_zone)::date;
    last_index := greatest(0, floor((local_today - s.first_period_start)::numeric / s.period_days)::int + 1);
    for i in greatest(0, last_index - 60)..last_index loop
      start_day := s.first_period_start + i * s.period_days;
      insert into public.reporting_periods (schedule_id, period_start, period_end, due_at)
      values (s.id, start_day, start_day + s.period_days - 1, public.reporting_due_at(s, start_day + s.period_days - 1))
      on conflict (schedule_id, period_start) do nothing;
    end loop;
  end loop;
end;
$$;
revoke all on function public.ensure_reporting_periods() from public, anon;
grant execute on function public.ensure_reporting_periods() to authenticated;

-- When an administrator changes a schedule's timing, periods nobody has
-- reported against are rebuilt from the new rule, and deadlines that are
-- still ahead follow the new deadline settings. Periods that already hold
-- reports keep their dates, so history never moves.
create or replace function public.reporting_schedule_retime()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.first_period_start, new.period_days) is distinct from (old.first_period_start, old.period_days) then
    delete from public.reporting_periods rp
    where rp.schedule_id = new.id
      and not exists (select 1 from public.staff_reports r where r.period_id = rp.id);
  end if;
  update public.reporting_periods rp set due_at = public.reporting_due_at(new, rp.period_end)
  where rp.schedule_id = new.id and rp.due_at > now();
  perform public.ensure_reporting_periods();
  return new;
end;
$$;
revoke all on function public.reporting_schedule_retime() from public, anon, authenticated;

-- ============ staff_reports ============
create table public.staff_reports (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.reporting_periods(id) on delete restrict,
  staff_id uuid not null references public.profiles(id) on delete restrict default auth.uid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'revision_requested', 'acknowledged')),
  activities text not null default '' check (char_length(activities) <= 8000),
  accomplishments text not null default '' check (char_length(accomplishments) <= 8000),
  outcomes jsonb not null default '[]' check (jsonb_typeof(outcomes) = 'array' and jsonb_array_length(outcomes) <= 30),
  challenges text not null default '' check (char_length(challenges) <= 8000),
  assistance_needed text not null default '' check (char_length(assistance_needed) <= 8000),
  no_assistance_needed boolean not null default false,
  next_goals text not null default '' check (char_length(next_goals) <= 8000),
  comments text not null default '' check (char_length(comments) <= 8000),
  version int not null default 0,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The duplicate guard: one report per person, department and period.
  unique (period_id, staff_id, department_id)
);
create index staff_reports_staff_idx on public.staff_reports (staff_id, created_at desc);
create index staff_reports_status_idx on public.staff_reports (status) where status in ('submitted', 'under_review');
create trigger staff_reports_set_updated_at before update on public.staff_reports
  for each row execute function public.set_updated_at();

create trigger reporting_schedules_retime after update of first_period_start, period_days, deadline_days_after_end, deadline_time, time_zone, active
  on public.reporting_schedules for each row execute function public.reporting_schedule_retime();

-- What a signed-in client may do directly. The RPCs below run as the table
-- owner (current_user <> 'authenticated') and do their own checks.
create or replace function public.staff_report_client_rules()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.staff_id is distinct from auth.uid() then
      raise exception 'reports can only be created for yourself' using errcode = '42501';
    end if;
    if new.status <> 'draft' or new.version <> 0 or new.submitted_at is not null or new.submitted_by is not null
       or new.reviewed_by is not null or new.reviewed_at is not null or new.acknowledged_at is not null then
      raise exception 'a new report starts as a draft' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.staff_departments sd
      join public.departments d on d.id = sd.department_id and d.active
      where sd.user_id = auth.uid() and sd.department_id = new.department_id and sd.active
    ) then
      raise exception 'you are not assigned to that department' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.reporting_periods rp
      join public.reporting_schedules s on s.id = rp.schedule_id and s.active
      where rp.id = new.period_id
        and (s.applies_to_all or exists (select 1 from public.reporting_schedule_departments sdp
                                         where sdp.schedule_id = s.id and sdp.department_id = new.department_id))
    ) then
      raise exception 'that department does not report in that period' using errcode = '23514';
    end if;
    return new;
  end if;

  -- UPDATE
  if old.staff_id is distinct from auth.uid() then
    raise exception 'only the author can edit a report' using errcode = '42501';
  end if;
  if old.status not in ('draft', 'revision_requested') then
    raise exception 'a submitted report cannot be edited' using errcode = '42501';
  end if;
  if (new.period_id, new.staff_id, new.department_id, new.status, new.version, new.submitted_at, new.submitted_by,
      new.reviewed_by, new.reviewed_at, new.acknowledged_at, new.created_at)
     is distinct from
     (old.period_id, old.staff_id, old.department_id, old.status, old.version, old.submitted_at, old.submitted_by,
      old.reviewed_by, old.reviewed_at, old.acknowledged_at, old.created_at) then
    raise exception 'only report content can be edited directly' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.staff_report_client_rules() from public, anon, authenticated;
create trigger staff_reports_client_rules before insert or update on public.staff_reports
  for each row execute function public.staff_report_client_rules();

alter table public.staff_reports enable row level security;
-- Reviewers never see a draft that was never submitted; once submitted they
-- read the frozen versions (staff_report_versions), not work in progress.
create policy staff_reports_select on public.staff_reports for select to authenticated
  using ((staff_id = auth.uid() and is_staff()) or (is_report_reviewer() and version > 0));
create policy staff_reports_insert on public.staff_reports for insert to authenticated
  with check (staff_id = auth.uid() and is_staff());
create policy staff_reports_update on public.staff_reports for update to authenticated
  using (staff_id = auth.uid() and is_staff()) with check (staff_id = auth.uid() and is_staff());
-- A never-submitted draft can be discarded by its author; nothing else is deleted.
create policy staff_reports_delete on public.staff_reports for delete to authenticated
  using (staff_id = auth.uid() and status = 'draft' and version = 0);

-- Reviewers see report periods/departments/authors through these joins, so
-- they also need every staff member's department assignments (policy above).

-- ============ staff_report_versions ============
-- A frozen copy of each submission, so a revision never overwrites what the
-- reviewer originally read.
create table public.staff_report_versions (
  report_id uuid not null references public.staff_reports(id) on delete cascade,
  version int not null,
  content jsonb not null,
  submitted_at timestamptz not null default now(),
  submitted_by uuid references public.profiles(id) on delete set null,
  primary key (report_id, version)
);
alter table public.staff_report_versions enable row level security;
create policy staff_report_versions_select on public.staff_report_versions for select to authenticated
  using (exists (select 1 from public.staff_reports r where r.id = report_id));

-- ============ staff_report_reviews (review history) ============
create table public.staff_report_reviews (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.staff_reports(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('submitted', 'review_started', 'revision_requested', 'acknowledged')),
  version int not null,
  comment text check (char_length(comment) <= 4000),
  created_at timestamptz not null default now()
);
create index staff_report_reviews_report_idx on public.staff_report_reviews (report_id, created_at);
alter table public.staff_report_reviews enable row level security;
create policy staff_report_reviews_select on public.staff_report_reviews for select to authenticated
  using (exists (select 1 from public.staff_reports r where r.id = report_id));
-- Rows only arrive through the RPCs below.

-- ============ audit ============
create trigger departments_audit after insert or update or delete on public.departments
  for each row execute function public.audit_row_change();
create trigger staff_departments_audit after insert or update or delete on public.staff_departments
  for each row execute function public.audit_row_change();
create trigger reporting_schedules_audit after insert or update or delete on public.reporting_schedules
  for each row execute function public.audit_row_change();
create trigger staff_reports_audit after insert or update or delete on public.staff_reports
  for each row execute function public.audit_row_change();
create trigger staff_report_reviews_audit after insert on public.staff_report_reviews
  for each row execute function public.audit_row_change();

-- ============ notifications helper ============
-- In-app notifications carry names and dates only -- never report content.
create or replace function public.staff_report_period_label(p_period_id uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select to_char(period_start, 'Mon FMDD') || ' – ' || to_char(period_end, 'Mon FMDD, YYYY')
  from public.reporting_periods where id = p_period_id
$$;
revoke all on function public.staff_report_period_label(uuid) from public, anon, authenticated;

-- ============ status RPCs ============
create or replace function public.submit_staff_report(p_report_id uuid)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports;
  author text;
  missing text[] := '{}';
begin
  select * into r from public.staff_reports where id = p_report_id for update;
  if not found or r.staff_id is distinct from auth.uid() or not public.is_staff() then
    raise exception 'report not found' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'revision_requested') then
    raise exception 'this report has already been submitted' using errcode = '23514';
  end if;

  if btrim(r.activities) = '' then missing := array_append(missing, 'activities'); end if;
  if btrim(r.accomplishments) = '' then missing := array_append(missing, 'accomplishments'); end if;
  if btrim(r.challenges) = '' then missing := array_append(missing, 'challenges'); end if;
  if btrim(r.assistance_needed) = '' and not r.no_assistance_needed then missing := array_append(missing, 'assistance_needed'); end if;
  if btrim(r.next_goals) = '' then missing := array_append(missing, 'next_goals'); end if;
  if cardinality(missing) > 0 then
    raise exception 'missing required fields: %', array_to_string(missing, ', ') using errcode = '23514';
  end if;

  update public.staff_reports
  set status = 'submitted', version = r.version + 1, submitted_at = now(), submitted_by = auth.uid(),
      reviewed_by = null, reviewed_at = null
  where id = r.id
  returning * into r;

  insert into public.staff_report_versions (report_id, version, content, submitted_at, submitted_by)
  values (r.id, r.version, jsonb_build_object(
    'activities', r.activities, 'accomplishments', r.accomplishments, 'outcomes', r.outcomes,
    'challenges', r.challenges, 'assistance_needed', r.assistance_needed,
    'no_assistance_needed', r.no_assistance_needed, 'next_goals', r.next_goals, 'comments', r.comments
  ), r.submitted_at, auth.uid());
  insert into public.staff_report_reviews (report_id, actor_id, action, version)
  values (r.id, auth.uid(), 'submitted', r.version);

  select coalesce(nullif(btrim(name), ''), email) into author from public.profiles where id = r.staff_id;
  insert into public.notifications (user_id, type, title, message, link)
  select ps.user_id, 'staff_report_submitted', 'New biweekly report',
         'New biweekly report submitted by ' || author || ' for ' || public.staff_report_period_label(r.period_id) || '.',
         '/staffreports/' || r.id
  from public.program_staff ps
  join public.profiles p on p.id = ps.user_id and p.active
  where ps.program = 'staff_reports' and ps.program_role = 'reviewer' and ps.active and ps.user_id <> r.staff_id;

  return r;
end;
$$;
revoke all on function public.submit_staff_report(uuid) from public, anon;
grant execute on function public.submit_staff_report(uuid) to authenticated;

-- Shared guard for the reviewer actions: the caller reviews, never their own report.
create or replace function public.staff_report_for_review(p_report_id uuid)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports;
begin
  if not public.is_report_reviewer() then
    raise exception 'only a report reviewer can do that' using errcode = '42501';
  end if;
  select * into r from public.staff_reports where id = p_report_id for update;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  if r.staff_id = auth.uid() then
    raise exception 'you cannot review your own report' using errcode = '42501';
  end if;
  return r;
end;
$$;
revoke all on function public.staff_report_for_review(uuid) from public, anon, authenticated;

create or replace function public.start_staff_report_review(p_report_id uuid)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports := public.staff_report_for_review(p_report_id);
begin
  if r.status <> 'submitted' then
    return r;
  end if;
  update public.staff_reports set status = 'under_review', reviewed_by = auth.uid(), reviewed_at = now()
  where id = r.id returning * into r;
  insert into public.staff_report_reviews (report_id, actor_id, action, version)
  values (r.id, auth.uid(), 'review_started', r.version);
  return r;
end;
$$;
revoke all on function public.start_staff_report_review(uuid) from public, anon;
grant execute on function public.start_staff_report_review(uuid) to authenticated;

create or replace function public.acknowledge_staff_report(p_report_id uuid, p_comment text default null)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports := public.staff_report_for_review(p_report_id);
begin
  if r.status not in ('submitted', 'under_review') then
    raise exception 'only a submitted report can be acknowledged' using errcode = '23514';
  end if;
  update public.staff_reports
  set status = 'acknowledged', reviewed_by = auth.uid(), reviewed_at = now(), acknowledged_at = now()
  where id = r.id returning * into r;
  insert into public.staff_report_reviews (report_id, actor_id, action, version, comment)
  values (r.id, auth.uid(), 'acknowledged', r.version, nullif(btrim(coalesce(p_comment, '')), ''));
  insert into public.notifications (user_id, type, title, message, link)
  values (r.staff_id, 'staff_report_acknowledged', 'Report acknowledged',
          'Your report for ' || public.staff_report_period_label(r.period_id) || ' was acknowledged.',
          '/myreports/' || r.id);
  return r;
end;
$$;
revoke all on function public.acknowledge_staff_report(uuid, text) from public, anon;
grant execute on function public.acknowledge_staff_report(uuid, text) to authenticated;

create or replace function public.request_staff_report_revision(p_report_id uuid, p_comment text)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports := public.staff_report_for_review(p_report_id);
begin
  if btrim(coalesce(p_comment, '')) = '' then
    raise exception 'a comment is required to request a revision' using errcode = '23514';
  end if;
  if r.status not in ('submitted', 'under_review') then
    raise exception 'only a submitted report can be sent back' using errcode = '23514';
  end if;
  update public.staff_reports set status = 'revision_requested', reviewed_by = auth.uid(), reviewed_at = now()
  where id = r.id returning * into r;
  insert into public.staff_report_reviews (report_id, actor_id, action, version, comment)
  values (r.id, auth.uid(), 'revision_requested', r.version, btrim(p_comment));
  insert into public.notifications (user_id, type, title, message, link)
  values (r.staff_id, 'staff_report_revision_requested', 'Revision requested',
          'Your report for ' || public.staff_report_period_label(r.period_id) || ' needs a revision.',
          '/myreports/' || r.id);
  return r;
end;
$$;
revoke all on function public.request_staff_report_revision(uuid, text) from public, anon;
grant execute on function public.request_staff_report_revision(uuid, text) to authenticated;

-- ============ who is expected to report ============
-- One row per (period, active staff member, assigned department covered by
-- the period's schedule), joined to the report if there is one. This is how
-- a missing report shows up as pending or overdue even though no row exists.
create or replace function public.staff_report_expectations(p_period_id uuid)
returns table (
  period_id uuid, staff_id uuid, department_id uuid, due_at timestamptz, overdue boolean,
  report_id uuid, status text, submitted_at timestamptz, version int
)
language sql stable security definer set search_path = public
as $$
  with per as (
    select rp.*, s.applies_to_all, s.grace_hours
    from public.reporting_periods rp join public.reporting_schedules s on s.id = rp.schedule_id
    where rp.id = p_period_id
  ),
  expected as (
    select per.id as period_id, sd.user_id as staff_id, sd.department_id
    from per
    join public.staff_departments sd on sd.active
    join public.departments d on d.id = sd.department_id and d.active
    join public.profiles p on p.id = sd.user_id and p.active
    -- Someone assigned mid-stream owes reports from their first period on, not the backlog.
    where per.period_end >= sd.created_at::date
      and (per.applies_to_all or exists (select 1 from public.reporting_schedule_departments x
                                        where x.schedule_id = per.schedule_id and x.department_id = sd.department_id))
    union
    select r.period_id, r.staff_id, r.department_id from public.staff_reports r where r.period_id = p_period_id
  )
  select e.period_id, e.staff_id, e.department_id, per.due_at,
         (r.submitted_at is null and now() > per.due_at + make_interval(hours => per.grace_hours)) as overdue,
         r.id, coalesce(r.status, 'not_started'), r.submitted_at, coalesce(r.version, 0)
  from expected e
  join per on per.id = e.period_id
  left join public.staff_reports r on r.period_id = e.period_id and r.staff_id = e.staff_id and r.department_id = e.department_id
$$;
revoke all on function public.staff_report_expectations(uuid) from public, anon, authenticated;

-- Every period the caller owes (or owed) a report for, newest first, across
-- all their departments.
create or replace function public.my_staff_report_expectations()
returns table (
  period_id uuid, period_start date, period_end date, staff_id uuid, department_id uuid, due_at timestamptz,
  overdue boolean, report_id uuid, status text, submitted_at timestamptz, version int
)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_staff() then
    return;
  end if;
  perform public.ensure_reporting_periods();
  return query
    select e.period_id, rp.period_start, rp.period_end, e.staff_id, e.department_id, e.due_at, e.overdue,
           e.report_id, e.status, e.submitted_at, e.version
    from public.reporting_periods rp
    join public.reporting_schedules s on s.id = rp.schedule_id and s.active
    cross join lateral public.staff_report_expectations(rp.id) e
    where e.staff_id = auth.uid()
    order by rp.period_start desc;
end;
$$;
revoke all on function public.my_staff_report_expectations() from public, anon;
grant execute on function public.my_staff_report_expectations() to authenticated;

-- The reviewer dashboard for one period. Refuses anyone who is not a reviewer.
create or replace function public.staff_reports_overview(p_period_id uuid)
returns table (
  period_id uuid, staff_id uuid, department_id uuid, due_at timestamptz, overdue boolean,
  report_id uuid, status text, submitted_at timestamptz, version int
)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_report_reviewer() then
    raise exception 'only a report reviewer can see the staff reports overview' using errcode = '42501';
  end if;
  perform public.ensure_reporting_periods();
  return query select * from public.staff_report_expectations(p_period_id);
end;
$$;
revoke all on function public.staff_reports_overview(uuid) from public, anon;
grant execute on function public.staff_reports_overview(uuid) to authenticated;

-- Materialize the periods for the seeded schedule now.
select public.ensure_reporting_periods();
