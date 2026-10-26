-- Staff Reporting Stage R2 -- automated reminders and overdue notices
-- (plans/staff-reporting-architecture.md §6). ADDITIVE ONLY: one table,
-- three functions, one pg_cron job (pg_cron is already enabled, 2026-10-26).
--
-- * staff_reports_tick() runs every hour. For each report still owed (not
--   yet submitted) it sends the author an in-app reminder at each of the
--   schedule's reminder_offsets (days relative to the deadline; default
--   3 days before, 1 day before, on the day, 1 day after). Hourly, so the
--   reminder follows the configured deadline time and zone across DST.
-- * Once a period is past its deadline plus grace, each reviewer gets one
--   notice listing how many reports are overdue.
-- * Reminders stop by themselves: the tick only looks at reports with no
--   submission. Every notice has a key in staff_report_notices_sent, so a
--   re-run or a retry never sends the same notice twice.
-- * A notice whose moment passed more than a day ago is skipped rather than
--   sent late (e.g. someone assigned mid-period, or the job was paused), so
--   nobody gets a burst of stale reminders.
-- * Notices name the department, period and deadline only -- never report
--   content. Email copies are Stage R3.
--
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026155659) after
-- a rolled-back dry run of supabase/tests/staff_reports_r2_check.sql passed.

-- ============ staff_report_notices_sent ============
create table public.staff_report_notices_sent (
  notice_key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.staff_report_notices_sent enable row level security;
-- No policies: only staff_reports_tick() (security definer) touches it.

-- "Mon, Nov 16 at 5:00 PM" in the schedule's own zone.
create or replace function public.staff_report_due_label(p_due_at timestamptz, p_time_zone text)
returns text
language sql stable set search_path = public
as $$ select to_char(p_due_at at time zone p_time_zone, 'Dy, Mon FMDD "at" FMHH12:MI AM') $$;
revoke all on function public.staff_report_due_label(timestamptz, text) from public, anon, authenticated;

-- `p_now` exists so the database checks can run the clock forward; the cron
-- job always calls it with the default. Returns how many notices were sent.
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

-- Every hour at :07 (off the top of the hour, away from other jobs). The tick
-- is idempotent; cron.schedule with an existing name replaces that job, so
-- this file is safe to re-apply.
select cron.schedule('staff-report-reminders', '7 * * * *', $$select public.staff_reports_tick()$$);
