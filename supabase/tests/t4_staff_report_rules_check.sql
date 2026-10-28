-- Checks for t4_staff_report_rules. Run AFTER the migration; ends by raising
-- 'T4_CHECKS_PASSED', so nothing is committed. Needs supabase/seed.sql's
-- administrator, staff member (reports) and case manager (made a reviewer
-- here, as p6a does).
do $$
declare
  admin uuid := '00000000-0000-4000-a000-000000000001';
  author uuid := '00000000-0000-4000-a000-000000000003';
  reviewer uuid := '00000000-0000-4000-a000-000000000005';
  v_schedule uuid := (select id from public.reporting_schedules where active order by created_at limit 1);
  v_current uuid;
  v_past uuid;
  v_future uuid;
  v_report uuid;
  r public.staff_reports;
  old_path text;
  new_path text;
  n int;
  msg text;
begin
  -- A schedule whose current period is Oct 19 - Nov 1 2026, due Mon Nov 2
  -- 17:00 EST, the day after daylight saving ends. (No reports yet, so the
  -- start date may still move.)
  update public.reporting_schedules set first_period_start = date '2026-09-21', period_days = 14,
         deadline_days_after_end = 1, deadline_time = '17:00', reminder_offsets = '{-3,-1,0,1}', grace_hours = 0,
         time_zone = 'America/New_York'
  where id = v_schedule;
  perform public.ensure_reporting_periods();
  select id into v_current from public.reporting_periods where schedule_id = v_schedule and period_start = date '2026-10-19';
  select id into v_past from public.reporting_periods where schedule_id = v_schedule and period_start = date '2026-10-05';
  insert into public.reporting_periods (schedule_id, period_start, period_end, due_at)
  values (v_schedule, date '2027-01-11', date '2027-01-24', timestamptz '2027-01-25 17:00 America/New_York')
  returning id into v_future;
  if v_current is null or v_past is null then raise exception 'setup: periods missing'; end if;
  insert into public.program_staff (user_id, program, program_role, active) values (reviewer, 'staff_reports', 'reviewer', true)
  on conflict (user_id, program) do update set program_role = 'reviewer', active = true;

  -- ---------------- 5. reminders across daylight saving ----------------
  -- "3 days before" a Nov 2 17:00 EST deadline is Oct 30 17:00 EDT (21:00Z).
  -- The old UTC maths fired at 18:00 EDT. At 17:30 EDT it must have gone.
  set local timezone = 'UTC';
  delete from public.notifications where user_id = author;
  perform public.staff_reports_tick(timestamptz '2026-10-30 16:30 America/New_York');
  if exists (select 1 from public.notifications where user_id = author and type = 'staff_report_due') then
    raise exception 'FAIL: the 3-day reminder fired before 17:00 local';
  end if;
  perform public.staff_reports_tick(timestamptz '2026-10-30 17:30 America/New_York');
  if not exists (select 1 from public.notifications where user_id = author and type = 'staff_report_due') then
    raise exception 'FAIL: the 3-day reminder did not fire at 17:00 local across the DST change';
  end if;
  reset timezone;

  -- ---------------- 1. periods ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin insert into public.staff_reports (period_id, programs) values (v_future, '{}'); exception when others then msg := sqlerrm; end;
  if msg is distinct from 'that period has not started yet' then raise exception 'FAIL: a future-period report was accepted (%)', msg; end if;
  insert into public.staff_reports (period_id, programs) values (v_past, '{}');  -- late report: allowed
  insert into public.staff_reports (period_id, programs, activities) values (v_current, array['organization'], 'first draft') returning id into v_report;
  update public.staff_reports set activities = 'as submitted', accomplishments = 'a', challenges = 'c',
         next_goals = 'g', no_assistance_needed = true, outcomes = '[]' where id = v_report;
  reset role;

  -- A file from before the first submission.
  old_path := v_report || '/' || gen_random_uuid() || '-before.pdf';
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('staff-report-files', old_path, author, '{"size": 2048, "mimetype": "application/pdf"}');
  insert into public.staff_report_attachments (report_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  values (v_report, old_path, 'before.pdf', 'image/png', 1, author);

  -- ---------------- 4. stored size and type win ----------------
  if (select size_bytes || ' ' || mime_type from public.staff_report_attachments where storage_path = old_path) <> '2048 application/pdf' then
    raise exception 'FAIL: the attachment kept the browser-supplied size or type';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.submit_staff_report(v_report);
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', reviewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.start_staff_report_review(v_report);
  perform public.request_staff_report_revision(v_report, 'Please add detail');
  reset role;

  -- The author edits and adds a file during the revision.
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.staff_reports set activities = 'EDIT IN PROGRESS' where id = v_report;
  if (select activities from public.staff_reports where id = v_report) <> 'EDIT IN PROGRESS' then
    raise exception 'FAIL: the author cannot see their own edit';
  end if;
  reset role;
  new_path := v_report || '/' || gen_random_uuid() || '-during.pdf';
  insert into storage.objects (bucket_id, name, owner, metadata, created_at)
  values ('staff-report-files', new_path, author, '{"size": 10, "mimetype": "application/pdf"}', clock_timestamp());
  -- now() is fixed for the whole transaction; a real upload comes later.
  insert into public.staff_report_attachments (report_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at)
  values (v_report, new_path, 'during.pdf', 'application/pdf', 10, author, clock_timestamp());

  -- ---------------- 2. the reviewer during the revision ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', reviewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.staff_reports where id = v_report) then
    raise exception 'FAIL: the reviewer reads the live row during a revision';
  end if;
  select * into r from public.staff_reports_in_revision(v_report);
  if r.id is null or r.activities <> 'as submitted' or r.status <> 'revision_requested' then
    raise exception 'FAIL: staff_reports_in_revision gave % / %', r.activities, r.status;
  end if;
  if (select count(*) from public.staff_reports_in_revision()) <> 1 then
    raise exception 'FAIL: the revision list is wrong';
  end if;
  if not exists (select 1 from public.staff_report_versions where report_id = v_report)
     or not exists (select 1 from public.staff_report_reviews where report_id = v_report) then
    raise exception 'FAIL: the reviewer lost the history or review trail during the revision';
  end if;
  if not exists (select 1 from public.staff_report_attachments where storage_path = old_path)
     or exists (select 1 from public.staff_report_attachments where storage_path = new_path) then
    raise exception 'FAIL: attachment visibility during the revision is wrong';
  end if;
  if not exists (select 1 from storage.objects where name = old_path)
     or exists (select 1 from storage.objects where name = new_path) then
    raise exception 'FAIL: file visibility during the revision is wrong';
  end if;
  reset role;

  -- The author doesn't get the reviewer copy of their own report.
  perform set_config('request.jwt.claims', json_build_object('sub', author, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.staff_reports_in_revision()) then
    raise exception 'FAIL: the author sees the reviewer copy';
  end if;
  perform public.submit_staff_report(v_report);
  reset role;

  -- After resubmitting, the reviewer sees the new content and the new file.
  perform set_config('request.jwt.claims', json_build_object('sub', reviewer, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select activities from public.staff_reports where id = v_report) is distinct from 'EDIT IN PROGRESS' then
    raise exception 'FAIL: the reviewer cannot read the resubmitted report';
  end if;
  if not exists (select 1 from public.staff_report_attachments where storage_path = new_path)
     or not exists (select 1 from storage.objects where name = new_path) then
    raise exception 'FAIL: the reviewer cannot see the file after resubmission';
  end if;
  reset role;

  -- ---------------- 4. the five-file cap ----------------
  for n in 1..3 loop
    insert into storage.objects (bucket_id, name, owner, metadata)
    values ('staff-report-files', v_report || '/' || gen_random_uuid() || '-x.pdf', author, '{"size": 1, "mimetype": "application/pdf"}');
  end loop;
  insert into public.staff_report_attachments (report_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
  select v_report, o.name, 'x.pdf', 'application/pdf', 1, author from storage.objects o
  where o.name like v_report || '/%-x.pdf';
  msg := null;
  begin
    insert into public.staff_report_attachments (report_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (v_report, v_report || '/sixth.pdf', 'sixth.pdf', 'application/pdf', 1, author);
  exception when others then msg := sqlerrm; end;
  if msg is distinct from 'a report can have at most 5 files' then raise exception 'FAIL: a sixth file was accepted (%)', msg; end if;

  -- ---------------- 3. a used schedule is locked ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin update public.reporting_schedules set period_days = 7 where id = v_schedule; exception when others then msg := sqlerrm; end;
  if msg not like 'this schedule already has reports%' then raise exception 'FAIL: a used schedule changed length (%)', msg; end if;
  msg := null;
  begin update public.reporting_schedules set first_period_start = first_period_start + 1 where id = v_schedule; exception when others then msg := sqlerrm; end;
  if msg not like 'this schedule already has reports%' then raise exception 'FAIL: a used schedule changed start (%)', msg; end if;
  update public.reporting_schedules set deadline_time = '16:00' where id = v_schedule;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: other schedule settings can no longer change'; end if;
  reset role;

  raise exception 'T4_CHECKS_PASSED';
end $$;
