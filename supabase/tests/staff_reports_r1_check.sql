-- Staff Reporting R1 -- database checks. Run AFTER the R1 migration, inside
-- a transaction that is always rolled back: it borrows three existing active
-- profiles (author A, colleague B, reviewer R) and changes nothing for good.
-- Success ends with the deliberate error ALL_TESTS_PASSED (which also forces
-- the rollback); any other error names the failed check.
--
--   begin;
--   \i supabase/migrations/20261026075822_staff_reports_r1_core.sql   -- only on a database without it
--   \i supabase/tests/staff_reports_r1_check.sql
--   rollback;

-- ---------- setup (as the table owner) ----------
do $$
declare
  a uuid; b uuid; r uuid;
begin
  select id into a from public.profiles where active order by created_at limit 1;
  select id into b from public.profiles where active and id <> a order by created_at limit 1;
  select id into r from public.profiles where active and id not in (a, b) order by created_at limit 1;
  if r is null then raise exception 'SETUP needs three active profiles'; end if;
  perform set_config('test.a', a::text, true);
  perform set_config('test.b', b::text, true);
  perform set_config('test.r', r::text, true);

  insert into public.staff_departments (user_id, department_id)
  select a, id from public.departments where key in ('case_management', 'workforce_development');
  insert into public.staff_departments (user_id, department_id)
  select b, id from public.departments where key = 'administration';
  insert into public.program_staff (user_id, program, program_role) values (r, 'staff_reports', 'reviewer')
  on conflict (user_id, program) do update set program_role = 'reviewer', active = true;
  -- program_staff only accepts known program/role pairs
  begin
    insert into public.program_staff (user_id, program, program_role) values (b, 'staff_reports', 'worker');
    raise exception 'FAIL staff_reports accepted a SNAP role';
  exception when check_violation then null;
  end;
  perform public.ensure_reporting_periods();
end $$;

-- ---------- deadline math: DST ends Sun Nov 1 2026 in New York ----------
do $$
declare
  s public.reporting_schedules;
begin
  select * into s from public.reporting_schedules limit 1;
  if public.reporting_due_at(s, date '2026-11-15') <> timestamptz '2026-11-16 22:00:00+00' then
    raise exception 'FAIL due_at after DST end: %', public.reporting_due_at(s, date '2026-11-15');
  end if;
  if public.reporting_due_at(s, date '2026-10-18') <> timestamptz '2026-10-19 21:00:00+00' then
    raise exception 'FAIL due_at before DST end: %', public.reporting_due_at(s, date '2026-10-18');
  end if;
  if not exists (select 1 from public.reporting_periods where period_start = date '2026-11-02'
                 and period_end = date '2026-11-15' and due_at = timestamptz '2026-11-16 22:00:00+00') then
    raise exception 'FAIL first period not materialized as Nov 2 - Nov 15, due Nov 16 5 PM ET';
  end if;
end $$;

-- ---------- author A: drafts, validation, duplicates, impersonation ----------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  pid uuid; d uuid; rid uuid;
begin
  select id into pid from public.reporting_periods where period_start = date '2026-11-02';
  select id into d from public.departments where key = 'case_management';
  insert into public.staff_reports (period_id, department_id, activities) values (pid, d, 'Ran two workshops')
  returning id into rid;
  perform set_config('test.report', rid::text, true);
  perform set_config('test.period', pid::text, true);
  -- A second, never-submitted draft (Workforce) that reviewers must not see.
  insert into public.staff_reports (period_id, department_id, activities)
  values (pid, (select id from public.departments where key = 'workforce_development'), 'private draft')
  returning id into rid;
  perform set_config('test.draft', rid::text, true);
  rid := current_setting('test.report')::uuid;

  begin
    insert into public.staff_reports (period_id, department_id) values (pid, d);
    raise exception 'FAIL duplicate report allowed';
  exception when unique_violation then null;
  end;
  begin
    insert into public.staff_reports (period_id, department_id)
    values (pid, (select id from public.departments where key = 'food_distribution'));
    raise exception 'FAIL report for an unassigned department allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.staff_reports (period_id, staff_id, department_id)
    values (pid, current_setting('test.b')::uuid, (select id from public.departments where key = 'administration'));
    raise exception 'FAIL report created on someone else''s behalf';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.staff_reports set status = 'acknowledged' where id = rid;
    raise exception 'FAIL author changed status directly';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_staff_report(rid);
    raise exception 'FAIL incomplete report submitted';
  exception when check_violation then null;
  end;

  update public.staff_reports
  set accomplishments = 'Placed 3 participants', challenges = 'Staffing', no_assistance_needed = true,
      next_goals = 'Two more workshops', outcomes = '[{"metric":"Workshops","value":"2"}]'
  where id = rid;
  perform public.submit_staff_report(rid);

  if (select status from public.staff_reports where id = rid) <> 'submitted' then
    raise exception 'FAIL submit did not set status';
  end if;
  begin
    update public.staff_reports set activities = 'changed' where id = rid;
    raise exception 'FAIL submitted report edited';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.submit_staff_report(rid);
    raise exception 'FAIL report submitted twice';
  exception when check_violation then null;
  end;
  begin
    perform public.acknowledge_staff_report(rid);
    raise exception 'FAIL non-reviewer acknowledged';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.staff_reports_overview(pid);
    raise exception 'FAIL non-reviewer read the overview';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.notifications (user_id, type, title) values (auth.uid(), 'x', 'x');
    raise exception 'FAIL client inserted a notification';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------- colleague B: cannot see A's report ----------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  rid uuid := current_setting('test.report')::uuid;
begin
  if exists (select 1 from public.staff_reports where id = rid) then raise exception 'FAIL colleague read the report'; end if;
  if exists (select 1 from public.staff_report_versions where report_id = rid) then raise exception 'FAIL colleague read a version'; end if;
  if exists (select 1 from public.staff_report_reviews where report_id = rid) then raise exception 'FAIL colleague read the review history'; end if;
  -- Assignments are visible to whoever manages reporting (administrators),
  -- so this only applies when the borrowed colleague isn't one.
  if not public.can_manage_program('staff_reports')
     and exists (select 1 from public.staff_departments where user_id = current_setting('test.a')::uuid) then
    raise exception 'FAIL colleague read assignments';
  end if;
  update public.staff_reports set activities = 'hijack' where id = rid;  -- RLS: matches no rows
  begin
    perform public.start_staff_report_review(rid);
    raise exception 'FAIL colleague started a review';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------- reviewer R: overview, revision request ----------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.r'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  rid uuid := current_setting('test.report')::uuid;
  pid uuid := current_setting('test.period')::uuid;
  n int;
begin
  if exists (select 1 from public.staff_reports where id = current_setting('test.draft')::uuid) then
    raise exception 'FAIL reviewer read an unsubmitted draft';
  end if;
  if not exists (select 1 from public.notifications where user_id = auth.uid() and type = 'staff_report_submitted'
                 and link = '/staffreports/' || rid) then
    raise exception 'FAIL reviewer was not notified of the submission';
  end if;
  select count(*) into n from public.staff_reports_overview(pid) o where o.staff_id = current_setting('test.a')::uuid;
  if n <> 2 then raise exception 'FAIL expected 2 expectations for a two-department author, got %', n; end if;
  if not exists (select 1 from public.staff_reports_overview(pid) o
                 where o.staff_id = current_setting('test.b')::uuid and o.status = 'not_started') then
    raise exception 'FAIL missing report not listed as not_started';
  end if;

  if (select activities from public.staff_reports where id = rid) <> 'Ran two workshops' then
    raise exception 'FAIL colleague changed the report';
  end if;
  perform public.start_staff_report_review(rid);
  if (select status from public.staff_reports where id = rid) <> 'under_review' then raise exception 'FAIL review not started'; end if;
  begin
    perform public.request_staff_report_revision(rid, '  ');
    raise exception 'FAIL revision requested without a comment';
  exception when check_violation then null;
  end;
  perform public.request_staff_report_revision(rid, 'Please add the workshop attendance numbers.');
  begin
    perform public.acknowledge_staff_report(rid);
    raise exception 'FAIL acknowledged a report awaiting revision';
  exception when check_violation then null;
  end;
end $$;
reset role;

-- ---------- author A: revise and resubmit ----------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  rid uuid := current_setting('test.report')::uuid;
begin
  if not exists (select 1 from public.notifications where user_id = auth.uid() and type = 'staff_report_revision_requested'
                 and link = '/myreports/' || rid) then
    raise exception 'FAIL author was not notified of the revision request';
  end if;
  if not exists (select 1 from public.staff_report_reviews where report_id = rid and action = 'revision_requested'
                 and comment like 'Please add%') then
    raise exception 'FAIL author cannot read the reviewer comment';
  end if;
  update public.staff_reports set outcomes = '[{"metric":"Workshops","value":"2"},{"metric":"Attendees","value":"31"}]' where id = rid;
  perform public.submit_staff_report(rid);
  if (select version from public.staff_reports where id = rid) <> 2 then raise exception 'FAIL resubmission did not bump version'; end if;
  if (select count(*) from public.staff_report_versions where report_id = rid) <> 2 then raise exception 'FAIL versions not kept'; end if;
end $$;
reset role;

-- ---------- reviewer R: acknowledge; cannot review own report ----------
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.r'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  rid uuid := current_setting('test.report')::uuid;
begin
  perform public.acknowledge_staff_report(rid, 'Thanks');
  if (select status from public.staff_reports where id = rid) <> 'acknowledged' then raise exception 'FAIL not acknowledged'; end if;
end $$;
reset role;

do $$
begin
  -- R also reports for Administration, then tries to review it.
  insert into public.staff_departments (user_id, department_id)
  select current_setting('test.r')::uuid, id from public.departments where key = 'administration';
  insert into public.staff_reports (period_id, staff_id, department_id, status, version, submitted_at, submitted_by,
                                    activities, accomplishments, challenges, no_assistance_needed, next_goals)
  select current_setting('test.period')::uuid, current_setting('test.r')::uuid, id, 'submitted', 1, now(),
         current_setting('test.r')::uuid, 'a', 'b', 'c', true, 'd'
  from public.departments where key = 'administration';
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.r'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.acknowledge_staff_report(
      (select id from public.staff_reports where staff_id = auth.uid() limit 1));
    raise exception 'FAIL reviewer acknowledged their own report';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ---------- author A: acknowledged notice, overdue detection ----------
do $$
begin
  -- Pretend A was assigned in September and the schedule started Sep 7, so
  -- the Oct 5 - Oct 18 period (due Oct 19) is past due with nothing filed.
  update public.staff_departments set created_at = timestamptz '2026-09-01 12:00+00'
  where user_id = current_setting('test.a')::uuid;
  update public.reporting_schedules set first_period_start = date '2026-09-07';
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.notifications where user_id = auth.uid() and type = 'staff_report_acknowledged') then
    raise exception 'FAIL author was not notified of the acknowledgment';
  end if;
  if not exists (select 1 from public.my_staff_report_expectations() e
                 where e.period_start = date '2026-10-05' and e.overdue and e.status = 'not_started') then
    raise exception 'FAIL overdue period not detected';
  end if;
  if exists (select 1 from public.my_staff_report_expectations() e
             where e.period_start = date '2026-11-02' and e.overdue) then
    raise exception 'FAIL future period marked overdue';
  end if;
  if not exists (select 1 from public.my_staff_report_expectations() e
                 where e.period_start = date '2026-11-02' and e.status = 'acknowledged') then
    raise exception 'FAIL the reported period lost its report after the schedule changed';
  end if;
end $$;
reset role;

do $$ begin raise exception 'ALL_TESTS_PASSED'; end $$;
