-- Checks for p6a_staff_reports_r1b. Run AFTER the migration, inside the same
-- transaction. Always ends by raising 'P6A_CHECKS_PASSED ...', so nothing it
-- (or the migration) wrote is committed; any failed check raises its own
-- message first. Replaces staff_reports_r1_check.sql and
-- staff_reports_r2_check.sql, which test the per-department shape.
--
-- Each block signs in as a real account (request.jwt.claims + role
-- authenticated), the way the browser reaches the tables and functions.
do $$
declare
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  cm uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  v_period uuid;
  v_due timestamptz;
  v_report uuid;
  v_content jsonb;
  v_prog text;
  n int;
  msg text;
begin
  if admin is null or staff is null or cm is null then
    raise exception 'need an active administrator, staff member and case manager to run these checks';
  end if;
  perform public.ensure_reporting_periods();
  -- Reports can only start in a period that has begun (t4): use the latest
  -- such period, or add one for this rolled-back run.
  select id, due_at into v_period, v_due from public.reporting_periods
  where period_start <= current_date order by period_start desc limit 1;
  if v_period is null then
    insert into public.reporting_periods (schedule_id, period_start, period_end, due_at)
    select s.id, current_date - 7, current_date + 6, ((current_date + 7) + s.deadline_time) at time zone s.time_zone
    from public.reporting_schedules s where s.active order by s.created_at limit 1
    returning id, due_at into v_period, v_due;
  end if;
  select upa.program_key into v_prog from public.user_program_access upa
  where upa.user_id = staff and upa.revoked_at is null order by upa.program_key limit 1;

  -- ---------------- shape ----------------
  if exists (select 1 from pg_constraint where conname = 'staff_reports_period_id_staff_id_department_id_key') then
    raise exception 'FAIL: the per-department unique key is still there';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_reports_one_per_period') then
    raise exception 'FAIL: no one-report-per-period key';
  end if;
  if has_function_privilege('anon', 'public.my_report_program_options()', 'EXECUTE')
     or has_function_privilege('anon', 'public.can_read_staff_reports()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.staff_report_reviewer_ids()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.staff_report_expectations(uuid)', 'EXECUTE') then
    raise exception 'FAIL: a helper is callable by the wrong role';
  end if;

  -- The case manager reviews (today's mechanism: program_staff reviewer,
  -- mirrored into the legacy reviewer role and so staff_reports.review).
  insert into public.program_staff (user_id, program, program_role, active) values (cm, 'staff_reports', 'reviewer', true)
  on conflict (user_id, program) do update set program_role = 'reviewer', active = true;
  if not exists (select 1 from public.user_effective_permissions where user_id = cm and permission_key = 'staff_reports.review') then
    raise exception 'FAIL: a program_staff reviewer did not get staff_reports.review';
  end if;

  -- ---------------- who is expected ----------------
  if not exists (select 1 from public.staff_report_expectations(v_period) where staff_id = staff) then
    raise exception 'FAIL: a staff member who reports is not expected';
  end if;
  if exists (select 1 from public.staff_report_expectations(v_period) where staff_id = cm) then
    raise exception 'FAIL: a reviewer is expected to report';
  end if;

  -- ---------------- the author ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated', 'email', 'x@nb4hs.org')::text, true);
  set local role authenticated;

  if not ('organization' = any (public.my_report_program_options())) then
    raise exception 'FAIL: organization-wide is not an option';
  end if;
  msg := null;
  begin
    insert into public.staff_reports (period_id, programs) values (v_period, array['not_a_program']);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: reported on a program they cannot open'; end if;
  msg := null;
  begin
    insert into public.staff_reports (period_id, department_id, programs)
    values (v_period, (select id from public.departments limit 1), array['organization']);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a new report took a department'; end if;
  msg := null;
  begin
    insert into public.staff_reports (period_id, staff_id, programs) values (v_period, cm, array['organization']);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: created a report for someone else'; end if;

  insert into public.staff_reports (period_id, programs) values (v_period, '{}') returning id into v_report;
  msg := null;
  begin
    insert into public.staff_reports (period_id, programs) values (v_period, array['organization']);
  exception when unique_violation then msg := 'dup'; end;
  if msg is null then raise exception 'FAIL: two reports for one person and period'; end if;

  update public.staff_reports set activities = 'Ran sessions', accomplishments = 'Finished intake backlog',
    challenges = 'Staffing', no_assistance_needed = true, next_goals = 'Outreach week' where id = v_report;
  msg := null;
  begin perform public.submit_staff_report(v_report); exception when others then msg := sqlerrm; end;
  if msg is null or msg not like '%programs%' then raise exception 'FAIL: submitted without programs (%)', msg; end if;

  update public.staff_reports set programs = array_remove(array['organization', v_prog], null) where id = v_report;
  msg := null;
  begin update public.staff_reports set status = 'acknowledged' where id = v_report; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: the author changed the status directly'; end if;
  perform public.submit_staff_report(v_report);
  reset role;

  select content into v_content from public.staff_report_versions where report_id = v_report and version = 1;
  if v_content is null or v_content -> 'programs' is null or v_content -> 'positions' is null
     or not (v_content -> 'programs' ? 'organization') then
    raise exception 'FAIL: the version did not record programs and positions (%)', v_content;
  end if;
  if not exists (select 1 from public.notifications where user_id = cm and type = 'staff_report_submitted' and link = '/staffreports/' || v_report) then
    raise exception 'FAIL: the reviewer was not notified';
  end if;
  if exists (select 1 from public.notifications where user_id = admin and type = 'staff_report_submitted' and link = '/staffreports/' || v_report) then
    raise exception 'FAIL: a non-reviewer administrator was notified';
  end if;

  -- ---------------- an administrator configures but does not read ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.staff_reports where id = v_report;
  if n <> 0 then raise exception 'FAIL: a non-reviewer administrator read a report'; end if;
  msg := null;
  begin perform * from public.staff_reports_overview(v_period); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a non-reviewer saw the overview'; end if;
  update public.reporting_schedules set grace_hours = 2;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'FAIL: an administrator could not change the schedule'; end if;
  update public.reporting_schedules set grace_hours = 0;
  reset role;

  -- staff can't change the schedule
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.reporting_schedules set grace_hours = 5;
  get diagnostics n = row_count;
  reset role;
  if n <> 0 then raise exception 'FAIL: staff changed the schedule'; end if;

  -- ---------------- the reviewer ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.staff_reports_overview(v_period) where report_id = v_report and 'organization' = any (programs);
  if n <> 1 then raise exception 'FAIL: the overview does not show the report with its programs'; end if;
  perform public.start_staff_report_review(v_report);
  perform public.request_staff_report_revision(v_report, 'Please add numbers');
  reset role;
  if (select status from public.staff_reports where id = v_report) <> 'revision_requested' then
    raise exception 'FAIL: revision request did not apply';
  end if;

  -- ---------------- reminders (R2 tick on the new rules) ----------------
  delete from public.staff_report_notices_sent where notice_key like 'due:' || v_period || ':%';
  n := public.staff_reports_tick(v_due - interval '3 days' + interval '1 hour');
  if not exists (select 1 from public.notifications where user_id = admin and type = 'staff_report_due'
                 and message like 'Your report for %' and created_at = now()) then
    raise exception 'FAIL: no reminder to someone who still owes a report (sent %)', n;
  end if;
  if exists (select 1 from public.notifications where user_id = cm and type = 'staff_report_due' and created_at = now()) then
    raise exception 'FAIL: a reviewer was reminded to report';
  end if;
  if public.staff_reports_tick(v_due - interval '3 days' + interval '2 hours') <> 0 then
    raise exception 'FAIL: the reminder repeated on the next run';
  end if;
  n := public.staff_reports_tick(v_due + interval '1 hour');
  if not exists (select 1 from public.notifications where user_id = cm and type = 'staff_report_overdue_digest' and created_at = now()) then
    raise exception 'FAIL: the reviewer got no overdue digest';
  end if;

  raise exception 'P6A_CHECKS_PASSED period %, one report per person, programs and reviewers by permission', v_period;
end;
$$;
