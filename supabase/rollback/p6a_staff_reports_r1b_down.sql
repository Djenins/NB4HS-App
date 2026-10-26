-- Undo p6a_staff_reports_r1b: back to R1's per-department reports and R2's
-- reminders, restoring their own definitions verbatim. R1 requires every
-- report to have a department, so this refuses to run once any report was
-- written without one.
begin;
do $$
begin
  if exists (select 1 from public.staff_reports where department_id is null) then
    raise exception 'reports without a department exist; move or remove them before rolling back';
  end if;
end;
$$;

drop function public.staff_reports_overview(uuid);
drop function public.my_staff_report_expectations();
drop function public.staff_report_expectations(uuid);

-- As live (the R1 file has two extra comments).
CREATE OR REPLACE FUNCTION public.staff_report_expectations(p_period_id uuid)
 RETURNS TABLE(period_id uuid, staff_id uuid, department_id uuid, due_at timestamp with time zone, overdue boolean, report_id uuid, status text, submitted_at timestamp with time zone, version integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;
revoke all on function public.staff_report_expectations(uuid) from public, anon, authenticated;

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

create or replace function public.is_report_reviewer()
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_program_role('staff_reports', array['reviewer']) $$;
revoke all on function public.is_report_reviewer() from public, anon;
grant execute on function public.is_report_reviewer() to authenticated;

-- As live (the R1 file has two extra comments).
CREATE OR REPLACE FUNCTION public.staff_report_client_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$;
revoke all on function public.staff_report_client_rules() from public, anon, authenticated;

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
  dept_name text;
  period_label text;
  due_label text;
begin
  perform public.ensure_reporting_periods();

  for rp in
    select p.id, p.period_start, p.period_end, p.due_at, s.time_zone, s.grace_hours, s.reminder_offsets
    from public.reporting_periods p
    join public.reporting_schedules s on s.id = p.schedule_id and s.active
    -- Only periods whose reminders could fall in the next or last week.
    where p.due_at between p_now - interval '9 days' and p_now + interval '8 days'
  loop
    period_label := public.staff_report_period_label(rp.id);
    due_label := public.staff_report_due_label(rp.due_at, rp.time_zone);

    -- Reminders to each author who still owes this period's report.
    for e in
      select x.staff_id, x.department_id
      from public.staff_report_expectations(rp.id) x
      join public.profiles pr on pr.id = x.staff_id and pr.active
      where x.submitted_at is null
    loop
      foreach off in array rp.reminder_offsets loop
        fire_at := rp.due_at + make_interval(days => off);
        -- After the deadline, never remind before the grace period is over.
        if off > 0 then
          fire_at := greatest(fire_at, rp.due_at + make_interval(hours => rp.grace_hours));
        end if;
        continue when p_now < fire_at or p_now >= fire_at + interval '1 day';

        key := 'due:' || rp.id || ':' || e.staff_id || ':' || e.department_id || ':' || off;
        insert into public.staff_report_notices_sent (notice_key) values (key) on conflict do nothing;
        continue when not found;

        select name into dept_name from public.departments where id = e.department_id;
        insert into public.notifications (user_id, type, title, message, link)
        values (
          e.staff_id,
          case when off > 0 then 'staff_report_overdue' else 'staff_report_due' end,
          case when off > 0 then 'Report overdue' else 'Report due' end,
          case when off > 0
            then 'Your ' || dept_name || ' report for ' || period_label || ' was due ' || due_label || '. Please submit it as soon as you can.'
            else 'Your ' || dept_name || ' report for ' || period_label || ' is due ' || due_label || '.'
          end,
          '/myreports'
        );
        sent := sent + 1;
      end loop;
    end loop;

    -- One overdue notice per reviewer, once the deadline and grace have passed.
    fire_at := rp.due_at + make_interval(hours => rp.grace_hours);
    if p_now >= fire_at and p_now < fire_at + interval '1 day' then
      select count(*) into overdue_count
      from public.staff_report_expectations(rp.id) x
      join public.profiles pr on pr.id = x.staff_id and pr.active
      where x.submitted_at is null;

      if overdue_count > 0 then
        for e in
          select ps.user_id
          from public.program_staff ps
          join public.profiles pr on pr.id = ps.user_id and pr.active
          where ps.program = 'staff_reports' and ps.program_role = 'reviewer' and ps.active
        loop
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

drop policy staff_reports_select on public.staff_reports;
create policy staff_reports_select on public.staff_reports for select to authenticated
  using ((staff_id = auth.uid() and is_staff()) or (is_report_reviewer() and version > 0));
drop policy reporting_schedules_insert on public.reporting_schedules;
drop policy reporting_schedules_update on public.reporting_schedules;
create policy reporting_schedules_insert on public.reporting_schedules for insert to authenticated
  with check (can_manage_program('staff_reports'));
create policy reporting_schedules_update on public.reporting_schedules for update to authenticated
  using (can_manage_program('staff_reports')) with check (can_manage_program('staff_reports'));

drop function public.staff_report_reviewer_ids();
drop function public.can_read_staff_reports();
drop function public.my_report_program_options();

alter table public.staff_reports drop constraint staff_reports_one_per_period;
alter table public.staff_reports drop column programs;
alter table public.staff_reports alter column department_id set not null;
alter table public.staff_reports add constraint staff_reports_period_id_staff_id_department_id_key unique (period_id, staff_id, department_id);
delete from supabase_migrations.schema_migrations where version = '20261027020000';
commit;
