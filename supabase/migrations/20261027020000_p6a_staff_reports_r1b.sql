-- Phase 6, part A -- staff reports reshape, "R1b" (plans/unified-access-
-- architecture.md §8.2). Builds on R1 (staff_reports_r1_core) and R2
-- (staff_reports_r2_reminders, applied live from PR #42).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261027020000), with 0
-- reports live, after a rolled-back dry run of
-- supabase/tests/p6a_reports_check.sql passed. Afterwards p6a_reports_check,
-- p5_admin_check and p1_access_check (parity) passed against the live
-- database.
--
-- What changes:
--   * One report per person per period, across programs, instead of one per
--     department. staff_reports gets `programs` (the programs worked on:
--     program keys, or 'organization' for organization-wide or
--     administration work), at least one required to submit and limited to
--     programs the author can open. department_id stays, nullable and unused,
--     until the clean-up migration (decision D7).
--   * Who reports: every active person holding staff_reports.submit, except
--     those who review reports (staff_reports.review) -- reviewers read
--     reports rather than write them. Department assignments no longer count.
--   * Who reviews: staff_reports.review (reviewers act), and
--     staff_reports.view_all (read-only). Today's program_staff reviewers keep
--     it through their mirrored legacy role; Executive Oversight has both.
--   * Who configures the schedule: staff_reports.schedule.manage (today:
--     administrators and reporting program admins, the same people as
--     can_manage_program('staff_reports')).
--   * Each submitted version records the programs and the author's positions
--     at that moment.
--   * Reminders and the overdue digest (R2's staff_reports_tick) follow the
--     new rules; reminder texts no longer name a department.
--
-- Rollback (supabase/rollback/p6a_staff_reports_r1b_down.sql) restores R1's
-- and R2's functions and policies and the per-department unique key; it
-- refuses to run once two reports share a person and period.

-- ======================================================================
-- 1. One report per person and period, with the programs worked on
-- ======================================================================
alter table public.staff_reports alter column department_id drop not null;
alter table public.staff_reports drop constraint staff_reports_period_id_staff_id_department_id_key;
alter table public.staff_reports add constraint staff_reports_one_per_period unique (period_id, staff_id);
alter table public.staff_reports add column programs text[] not null default '{}'
  check (cardinality(programs) <= 12);

-- The programs the signed-in person can report on: those they can open,
-- plus 'organization'.
create or replace function public.my_report_program_options()
returns text[]
language sql stable security definer set search_path = public
as $$
  select array['organization'] || coalesce(array_agg(upa.program_key order by m.sort_order), '{}')
  from public.user_program_access upa
  join public.app_modules m on m.key = upa.program_key and m.kind = 'program' and m.active and m.implemented
  where upa.user_id = auth.uid() and upa.revoked_at is null
$$;
revoke all on function public.my_report_program_options() from public, anon;
grant execute on function public.my_report_program_options() to authenticated;

-- ======================================================================
-- 2. Reviewers by permission
-- ======================================================================
create or replace function public.is_report_reviewer()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_permission('staff_reports.review') $$;

create or replace function public.can_read_staff_reports()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_permission('staff_reports.review') or public.has_permission('staff_reports.view_all') $$;
revoke all on function public.can_read_staff_reports() from public, anon;
grant execute on function public.can_read_staff_reports() to authenticated;

drop policy staff_reports_select on public.staff_reports;
create policy staff_reports_select on public.staff_reports for select to authenticated
  using ((staff_id = auth.uid() and is_staff()) or (can_read_staff_reports() and version > 0));

drop policy reporting_schedules_insert on public.reporting_schedules;
drop policy reporting_schedules_update on public.reporting_schedules;
create policy reporting_schedules_insert on public.reporting_schedules for insert to authenticated
  with check (has_permission('staff_reports.schedule.manage'));
create policy reporting_schedules_update on public.reporting_schedules for update to authenticated
  using (has_permission('staff_reports.schedule.manage')) with check (has_permission('staff_reports.schedule.manage'));

-- Active people who act on reports, for notices.
create or replace function public.staff_report_reviewer_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select distinct e.user_id from public.user_effective_permissions e
  join public.profiles p on p.id = e.user_id and p.active
  where e.permission_key = 'staff_reports.review'
$$;
revoke all on function public.staff_report_reviewer_ids() from public, anon, authenticated;

-- ======================================================================
-- 3. What a signed-in client may do directly
-- ======================================================================
create or replace function public.staff_report_client_rules()
returns trigger
language plpgsql set search_path = public
as $$
declare
  options text[];
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' or new.programs is distinct from old.programs then
    options := public.my_report_program_options();
    if not (new.programs <@ options) then
      raise exception 'you can only report on programs you can open' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.staff_id is distinct from auth.uid() then
      raise exception 'reports can only be created for yourself' using errcode = '42501';
    end if;
    if not public.has_permission('staff_reports.submit') then
      raise exception 'you do not report' using errcode = '42501';
    end if;
    if new.status <> 'draft' or new.version <> 0 or new.submitted_at is not null or new.submitted_by is not null
       or new.reviewed_by is not null or new.reviewed_at is not null or new.acknowledged_at is not null then
      raise exception 'a new report starts as a draft' using errcode = '42501';
    end if;
    if new.department_id is not null then
      raise exception 'reports no longer belong to a department' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.reporting_periods rp
      join public.reporting_schedules s on s.id = rp.schedule_id and s.active
      where rp.id = new.period_id
    ) then
      raise exception 'that period is not open for reports' using errcode = '23514';
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

-- ======================================================================
-- 4. Submitting: programs required; programs and positions recorded
-- ======================================================================
create or replace function public.submit_staff_report(p_report_id uuid)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports;
  author text;
  missing text[] := '{}';
  positions jsonb;
begin
  select * into r from public.staff_reports where id = p_report_id for update;
  if not found or r.staff_id is distinct from auth.uid() or not public.is_staff() then
    raise exception 'report not found' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'revision_requested') then
    raise exception 'this report has already been submitted' using errcode = '23514';
  end if;

  if cardinality(r.programs) = 0 then missing := array_append(missing, 'programs'); end if;
  if btrim(r.activities) = '' then missing := array_append(missing, 'activities'); end if;
  if btrim(r.accomplishments) = '' then missing := array_append(missing, 'accomplishments'); end if;
  if btrim(r.challenges) = '' then missing := array_append(missing, 'challenges'); end if;
  if btrim(r.assistance_needed) = '' and not r.no_assistance_needed then missing := array_append(missing, 'assistance_needed'); end if;
  if btrim(r.next_goals) = '' then missing := array_append(missing, 'next_goals'); end if;
  if cardinality(missing) > 0 then
    raise exception 'missing required fields: %', array_to_string(missing, ', ') using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(p.name_en order by up.is_primary desc, p.sort_order), '[]') into positions
  from public.user_positions up join public.positions p on p.id = up.position_id
  where up.user_id = r.staff_id and up.ended_on is null;

  update public.staff_reports
  set status = 'submitted', version = r.version + 1, submitted_at = now(), submitted_by = auth.uid(),
      reviewed_by = null, reviewed_at = null
  where id = r.id
  returning * into r;

  insert into public.staff_report_versions (report_id, version, content, submitted_at, submitted_by)
  values (r.id, r.version, jsonb_build_object(
    'activities', r.activities, 'accomplishments', r.accomplishments, 'outcomes', r.outcomes,
    'challenges', r.challenges, 'assistance_needed', r.assistance_needed,
    'no_assistance_needed', r.no_assistance_needed, 'next_goals', r.next_goals, 'comments', r.comments,
    'programs', to_jsonb(r.programs), 'positions', positions
  ), r.submitted_at, auth.uid());
  insert into public.staff_report_reviews (report_id, actor_id, action, version)
  values (r.id, auth.uid(), 'submitted', r.version);

  select coalesce(nullif(btrim(name), ''), email) into author from public.profiles where id = r.staff_id;
  insert into public.notifications (user_id, type, title, message, link)
  select reviewer, 'staff_report_submitted', 'New biweekly report',
         'New biweekly report submitted by ' || author || ' for ' || public.staff_report_period_label(r.period_id) || '.',
         '/staffreports/' || r.id
  from public.staff_report_reviewer_ids() reviewer
  where reviewer <> r.staff_id;

  return r;
end;
$$;

-- ======================================================================
-- 5. Who is expected to report
-- ======================================================================
drop function public.staff_reports_overview(uuid);
drop function public.my_staff_report_expectations();
drop function public.staff_report_expectations(uuid);

-- One row per (period, person who reports), joined to their report if there
-- is one, so a missing report still shows as pending or overdue. Someone
-- whose account was created mid-stream owes reports from their first period.
create or replace function public.staff_report_expectations(p_period_id uuid)
returns table (
  period_id uuid, staff_id uuid, due_at timestamptz, overdue boolean,
  report_id uuid, status text, submitted_at timestamptz, version int, programs text[]
)
language sql stable security definer set search_path = public
as $$
  with per as (
    select rp.*, s.grace_hours
    from public.reporting_periods rp join public.reporting_schedules s on s.id = rp.schedule_id
    where rp.id = p_period_id
  ),
  expected as (
    select per.id as period_id, p.id as staff_id
    from per
    join public.profiles p on p.active and per.period_end >= p.created_at::date
    where exists (select 1 from public.user_effective_permissions e where e.user_id = p.id and e.permission_key = 'staff_reports.submit')
      and not exists (select 1 from public.user_effective_permissions e where e.user_id = p.id and e.permission_key = 'staff_reports.review')
    union
    select r.period_id, r.staff_id from public.staff_reports r where r.period_id = p_period_id
  )
  select e.period_id, e.staff_id, per.due_at,
         (r.submitted_at is null and now() > per.due_at + make_interval(hours => per.grace_hours)) as overdue,
         r.id, coalesce(r.status, 'not_started'), r.submitted_at, coalesce(r.version, 0), coalesce(r.programs, '{}')
  from expected e
  join per on per.id = e.period_id
  left join public.staff_reports r on r.period_id = e.period_id and r.staff_id = e.staff_id
$$;
revoke all on function public.staff_report_expectations(uuid) from public, anon, authenticated;

create or replace function public.my_staff_report_expectations()
returns table (
  period_id uuid, period_start date, period_end date, staff_id uuid, due_at timestamptz,
  overdue boolean, report_id uuid, status text, submitted_at timestamptz, version int, programs text[]
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
    select e.period_id, rp.period_start, rp.period_end, e.staff_id, e.due_at, e.overdue,
           e.report_id, e.status, e.submitted_at, e.version, e.programs
    from public.reporting_periods rp
    join public.reporting_schedules s on s.id = rp.schedule_id and s.active
    cross join lateral public.staff_report_expectations(rp.id) e
    where e.staff_id = auth.uid()
    order by rp.period_start desc;
end;
$$;
revoke all on function public.my_staff_report_expectations() from public, anon;
grant execute on function public.my_staff_report_expectations() to authenticated;

create or replace function public.staff_reports_overview(p_period_id uuid)
returns table (
  period_id uuid, staff_id uuid, due_at timestamptz, overdue boolean,
  report_id uuid, status text, submitted_at timestamptz, version int, programs text[]
)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.can_read_staff_reports() then
    raise exception 'only a report reviewer can see the staff reports overview' using errcode = '42501';
  end if;
  perform public.ensure_reporting_periods();
  return query select * from public.staff_report_expectations(p_period_id);
end;
$$;
revoke all on function public.staff_reports_overview(uuid) from public, anon;
grant execute on function public.staff_reports_overview(uuid) to authenticated;

-- ======================================================================
-- 6. Reminders and the overdue digest (R2) on the new rules
-- ======================================================================
-- Same timing rules as R2. Notice keys drop the department; nothing has been
-- sent yet (the first deadline is Nov 16, 2026), so no notice repeats.
create or replace function public.staff_reports_tick(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  sent integer := 0;
  rp record;
  e record;
  off int;
  fire_at timestamptz;
  key text;
  overdue_count int;
  period_label text;
  due_label text;
begin
  perform public.ensure_reporting_periods();

  for rp in
    select p.id, p.period_start, p.period_end, p.due_at, s.time_zone, s.grace_hours, s.reminder_offsets
    from public.reporting_periods p
    join public.reporting_schedules s on s.id = p.schedule_id and s.active
    where p.due_at between p_now - interval '9 days' and p_now + interval '8 days'
  loop
    period_label := public.staff_report_period_label(rp.id);
    due_label := public.staff_report_due_label(rp.due_at, rp.time_zone);

    for e in
      select x.staff_id
      from public.staff_report_expectations(rp.id) x
      join public.profiles pr on pr.id = x.staff_id and pr.active
      where x.submitted_at is null
    loop
      foreach off in array rp.reminder_offsets loop
        fire_at := rp.due_at + make_interval(days => off);
        if off > 0 then
          fire_at := greatest(fire_at, rp.due_at + make_interval(hours => rp.grace_hours));
        end if;
        continue when p_now < fire_at or p_now >= fire_at + interval '1 day';

        key := 'due:' || rp.id || ':' || e.staff_id || ':' || off;
        insert into public.staff_report_notices_sent (notice_key) values (key) on conflict do nothing;
        continue when not found;

        insert into public.notifications (user_id, type, title, message, link)
        values (
          e.staff_id,
          case when off > 0 then 'staff_report_overdue' else 'staff_report_due' end,
          case when off > 0 then 'Report overdue' else 'Report due' end,
          case when off > 0
            then 'Your report for ' || period_label || ' was due ' || due_label || '. Please submit it as soon as you can.'
            else 'Your report for ' || period_label || ' is due ' || due_label || '.'
          end,
          '/myreports'
        );
        sent := sent + 1;
      end loop;
    end loop;

    fire_at := rp.due_at + make_interval(hours => rp.grace_hours);
    if p_now >= fire_at and p_now < fire_at + interval '1 day' then
      select count(*) into overdue_count
      from public.staff_report_expectations(rp.id) x
      join public.profiles pr on pr.id = x.staff_id and pr.active
      where x.submitted_at is null;

      if overdue_count > 0 then
        for e in select reviewer as user_id from public.staff_report_reviewer_ids() reviewer loop
          key := 'overdue_digest:' || rp.id || ':' || e.user_id;
          insert into public.staff_report_notices_sent (notice_key) values (key) on conflict do nothing;
          continue when not found;
          insert into public.notifications (user_id, type, title, message, link)
          values (
            e.user_id, 'staff_report_overdue_digest', 'Reports overdue',
            overdue_count || case when overdue_count = 1 then ' report is' else ' reports are' end
              || ' overdue for ' || period_label || '.',
            '/staffreports'
          );
          sent := sent + 1;
        end loop;
      end if;
    end if;
  end loop;

  return sent;
end;
$$;
revoke all on function public.staff_reports_tick(timestamptz) from public, anon, authenticated;
