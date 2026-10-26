-- Staff Reporting R2 -- reminder and overdue-notice checks. Run AFTER the R1
-- and R2 migrations, inside a transaction that is always rolled back. The
-- clock is run forward by passing timestamps to staff_reports_tick(p_now).
-- Success ends with the deliberate error ALL_TESTS_PASSED (which also forces
-- the rollback); any other error names the failed check.
--
-- Seeded schedule: 14-day periods from Mon Nov 2 2026, due the Monday after
-- at 5:00 PM New York time, reminders at -3, -1, 0 and +1 days. The first
-- period (Nov 2 - Nov 15) is due Mon Nov 16 22:00 UTC (EST).
--
--   begin;
--   \i supabase/migrations/<r2 migration>.sql   -- only on a database without it
--   \i supabase/tests/staff_reports_r2_check.sql
--   rollback;

do $$
declare
  a uuid; b uuid; r uuid; p1 uuid; s public.reporting_schedules;
begin
  select id into a from public.profiles where active order by created_at limit 1;
  select id into b from public.profiles where active and id <> a order by created_at limit 1;
  select id into r from public.profiles where active and id not in (a, b) order by created_at limit 1;
  if r is null then raise exception 'SETUP needs three active profiles'; end if;
  perform set_config('test.a', a::text, true);
  perform set_config('test.b', b::text, true);
  perform set_config('test.r', r::text, true);

  -- A reports for Case Management, B for Administration, both assigned in October.
  insert into public.staff_departments (user_id, department_id, created_at)
  select a, id, timestamptz '2026-10-01 12:00+00' from public.departments where key = 'case_management';
  insert into public.staff_departments (user_id, department_id, created_at)
  select b, id, timestamptz '2026-10-01 12:00+00' from public.departments where key = 'administration';
  insert into public.program_staff (user_id, program, program_role) values (r, 'staff_reports', 'reviewer')
  on conflict (user_id, program) do update set program_role = 'reviewer', active = true;

  perform public.ensure_reporting_periods();
  select * into s from public.reporting_schedules limit 1;
  select id into p1 from public.reporting_periods where schedule_id = s.id and period_start = date '2026-11-02';
  if p1 is null then raise exception 'SETUP first period missing'; end if;
  perform set_config('test.p1', p1::text, true);
  -- The second period would only be generated once its time comes; create it now.
  insert into public.reporting_periods (schedule_id, period_start, period_end, due_at)
  values (s.id, date '2026-11-16', date '2026-11-29', public.reporting_due_at(s, date '2026-11-29'))
  on conflict (schedule_id, period_start) do nothing;
end $$;

-- Helper: how many notifications of a type a test user has.
create function pg_temp.n(p_user text, p_type text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = current_setting(p_user)::uuid and type = p_type
$$;

do $$
declare
  sent int;
  base_a int := pg_temp.n('test.a', 'staff_report_due');
  base_b int := pg_temp.n('test.b', 'staff_report_due');
  msg text;
begin
  -- Nothing before the first reminder (Thu Nov 12 22:00 UTC = 3 days before).
  sent := public.staff_reports_tick(timestamptz '2026-11-12 21:30+00');
  if sent <> 0 then raise exception 'FAIL reminder sent too early (%)', sent; end if;

  -- 3 days before: one reminder each.
  sent := public.staff_reports_tick(timestamptz '2026-11-13 22:30+00');
  if sent <> 2 then raise exception 'FAIL expected 2 reminders 3 days before, got %', sent; end if;
  -- Same window, next hour: nothing new.
  sent := public.staff_reports_tick(timestamptz '2026-11-13 23:30+00');
  if sent <> 0 then raise exception 'FAIL duplicate reminders (%)', sent; end if;

  select message into msg from public.notifications
  where user_id = current_setting('test.a')::uuid and type = 'staff_report_due' order by created_at desc limit 1;
  if msg not like 'Your Case Management report for Nov 2 – Nov 15, 2026 is due Mon, Nov 16 at 5:00 PM.' then
    raise exception 'FAIL reminder text: %', msg;
  end if;

  -- 1 day before.
  sent := public.staff_reports_tick(timestamptz '2026-11-15 22:30+00');
  if sent <> 2 then raise exception 'FAIL expected 2 reminders 1 day before, got %', sent; end if;
  if pg_temp.n('test.a', 'staff_report_due') <> base_a + 2 or pg_temp.n('test.b', 'staff_report_due') <> base_b + 2 then
    raise exception 'FAIL wrong reminder counts';
  end if;
end $$;

-- A submits on Monday morning; B never does.
do $$
begin
  insert into public.staff_reports (period_id, staff_id, department_id, status, version, submitted_at, submitted_by,
                                    activities, accomplishments, challenges, no_assistance_needed, next_goals)
  select current_setting('test.p1')::uuid, current_setting('test.a')::uuid, id, 'submitted', 1,
         timestamptz '2026-11-16 14:00+00', current_setting('test.a')::uuid, 'a', 'b', 'c', true, 'd'
  from public.departments where key = 'case_management';
end $$;

do $$
declare
  sent int;
  a_due int := pg_temp.n('test.a', 'staff_report_due');
  msg text;
begin
  -- Just before the deadline: no reviewer notice yet.
  sent := public.staff_reports_tick(timestamptz '2026-11-16 21:30+00');
  if sent <> 0 then raise exception 'FAIL notices before the deadline (%)', sent; end if;

  -- Deadline (grace 0): B's on-the-day reminder, and one notice to the
  -- reviewer counting B's report as overdue. A, who submitted, gets nothing.
  sent := public.staff_reports_tick(timestamptz '2026-11-16 22:30+00');
  if sent <> 2 then raise exception 'FAIL expected 2 notices at the deadline, got %', sent; end if;
  if pg_temp.n('test.a', 'staff_report_due') <> a_due then raise exception 'FAIL reminded after submitting'; end if;
  if pg_temp.n('test.r', 'staff_report_overdue_digest') <> 1 then raise exception 'FAIL reviewer overdue notice missing'; end if;
  select message into msg from public.notifications
  where user_id = current_setting('test.r')::uuid and type = 'staff_report_overdue_digest' limit 1;
  if msg <> '1 report is overdue for Nov 2 – Nov 15, 2026.' then raise exception 'FAIL digest text: %', msg; end if;

  -- A day later: B's overdue reminder; the reviewer is not told again.
  sent := public.staff_reports_tick(timestamptz '2026-11-17 22:30+00');
  if sent <> 1 then raise exception 'FAIL expected 1 overdue reminder, got %', sent; end if;
  if pg_temp.n('test.b', 'staff_report_overdue') <> 1 then raise exception 'FAIL overdue reminder missing'; end if;
  if pg_temp.n('test.a', 'staff_report_overdue') <> 0 then raise exception 'FAIL overdue reminder after submitting'; end if;
  if pg_temp.n('test.r', 'staff_report_overdue_digest') <> 1 then raise exception 'FAIL reviewer notified twice'; end if;
  sent := public.staff_reports_tick(timestamptz '2026-11-18 03:00+00');
  if sent <> 0 then raise exception 'FAIL duplicate overdue notices (%)', sent; end if;

  -- Days later the moment has passed: nothing is sent late.
  sent := public.staff_reports_tick(timestamptz '2026-11-20 12:00+00');
  if sent <> 0 then raise exception 'FAIL stale notices sent (%)', sent; end if;
end $$;

-- Grace period: with 48 hours' grace, the second period (Nov 16 - Nov 29,
-- due Mon Nov 30 22:00 UTC) gets no overdue reminder or reviewer notice until
-- Wed Dec 2 22:00 UTC. Neither A nor B has reported for it.
update public.reporting_schedules set grace_hours = 48;
do $$
declare
  sent int;
begin
  sent := public.staff_reports_tick(timestamptz '2026-11-30 22:30+00');
  if sent <> 2 then raise exception 'FAIL expected 2 on-the-day reminders with grace, got %', sent; end if;
  if pg_temp.n('test.r', 'staff_report_overdue_digest') <> 1 then raise exception 'FAIL reviewer notified inside the grace period'; end if;
  sent := public.staff_reports_tick(timestamptz '2026-12-01 22:30+00');
  if sent <> 0 then raise exception 'FAIL overdue reminder inside the grace period (%)', sent; end if;
  sent := public.staff_reports_tick(timestamptz '2026-12-02 22:30+00');
  if sent <> 3 then raise exception 'FAIL expected 2 overdue reminders and 1 reviewer notice after grace, got %', sent; end if;
  if pg_temp.n('test.r', 'staff_report_overdue_digest') <> 2 then raise exception 'FAIL reviewer notice after grace missing'; end if;
end $$;

-- Daylight time: a deadline in summer is still 5:00 PM local (21:00 UTC).
do $$
begin
  if public.staff_report_due_label(timestamptz '2027-06-14 21:00+00', 'America/New_York') <> 'Mon, Jun 14 at 5:00 PM' then
    raise exception 'FAIL due label in daylight time: %', public.staff_report_due_label(timestamptz '2027-06-14 21:00+00', 'America/New_York');
  end if;
end $$;

-- An inactive schedule sends nothing.
update public.reporting_schedules set active = false;
do $$
begin
  if public.staff_reports_tick(timestamptz '2026-11-13 22:30+00') <> 0 then raise exception 'FAIL inactive schedule sent reminders'; end if;
end $$;

-- Signed-in users cannot run the job themselves.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.staff_reports_tick();
    raise exception 'FAIL a signed-in user ran the reminder job';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.staff_report_notices_sent;
    if found then raise exception 'FAIL a signed-in user read the sent-notice log'; end if;
  end;
end $$;
reset role;

-- The hourly job is scheduled.
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'staff-report-reminders' and schedule = '7 * * * *') then
    raise exception 'FAIL cron job not scheduled';
  end if;
end $$;

do $$ begin raise exception 'ALL_TESTS_PASSED'; end $$;
