-- Checks for t7_calendar_privacy. Run AFTER the migration; ends by raising
-- 'T7_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;
-- Sign in as someone (claims carry the email, as Supabase Auth's do).
create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated',
    'email', 'dryrun-' || p_uid || '@example.invalid')::text, true);
end $f$;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  cm1 uuid := pg_temp.dryrun_account('case_manager');
  cm2 uuid := pg_temp.dryrun_account('case_manager');
  jd uuid := pg_temp.dryrun_account('job_developer');
  staff uuid := pg_temp.dryrun_account('staff');
  rec uuid := pg_temp.dryrun_account('receptionist');
  a_cm1 uuid; a_case uuid; a_job uuid; a_jd uuid;
  e_cm1 uuid; e_staff uuid;
  seen text;
  r record;
  msg text;
begin
  insert into public.appointments (first_name, last_name, appt_date, appt_time, reason, assigned_email, meeting_with, status, source)
  values ('T7', 'Assigned', current_date + 3, '10:00', 'x', 'dryrun-' || cm1 || '@example.invalid', 'case_manager', 'scheduled', 'staff')
  returning id into a_cm1;
  insert into public.appointments (first_name, last_name, appt_date, appt_time, reason, meeting_with, status, source)
  values ('T7', 'CaseQueue', current_date + 3, '11:00', 'x', 'case_manager', 'requested', 'client') returning id into a_case;
  insert into public.appointments (first_name, last_name, appt_date, appt_time, reason, meeting_with, status, source)
  values ('T7', 'JobQueue', current_date + 3, '12:00', 'x', 'job_developer', 'requested', 'client') returning id into a_job;
  insert into public.appointments (first_name, last_name, appt_date, appt_time, reason, staff_id, meeting_with, status, source)
  values ('T7', 'Booked', current_date + 3, '13:00', 'x', jd, 'job_developer', 'scheduled', 'client') returning id into a_jd;
  insert into public.calendar_events (type, title, person_name, notes, event_date, start_time, created_by)
  values ('appointment', 'T7 meeting', 'Client Name', 'private note', current_date + 3, '09:00', cm1) returning id into e_cm1;
  insert into public.calendar_events (type, title, person_name, notes, event_date, start_time, created_by)
  values ('visit', 'T7 visit', 'Other Client', 'other note', current_date + 3, '14:00', staff) returning id into e_staff;

  -- ---------------- client appointments ----------------
  for r in select * from (values
      (admin, 'a_cm1,a_case,a_job,a_jd'),
      (cm1,   'a_cm1,a_case'),
      (cm2,   'a_case'),
      (jd,    'a_job,a_jd'),
      (staff, ''),
      (rec,   '')) as t(uid, expected)
  loop
    perform pg_temp.as_user(r.uid);
    set local role authenticated;
    select coalesce(string_agg(case id when a_cm1 then 'a_cm1' when a_case then 'a_case' when a_job then 'a_job' when a_jd then 'a_jd' end, ',' order by appt_time), '')
      into seen from public.appointments where id in (a_cm1, a_case, a_job, a_jd);
    reset role;
    if seen <> r.expected then
      raise exception 'FAIL: % sees appointments [%], expected [%]',
        (select role from public.profiles where id = r.uid), seen, r.expected;
    end if;
  end loop;

  -- ---------------- staff calendar events ----------------
  -- The table: creator and administrators only.
  perform pg_temp.as_user(cm1);
  set local role authenticated;
  if exists (select 1 from public.calendar_events where id = e_staff) or not exists (select 1 from public.calendar_events where id = e_cm1) then
    raise exception 'FAIL: a case manager reads calendar_events rows they did not add (or not their own)';
  end if;
  -- The calendar: every time block; names and notes only on your own.
  select count(*) filter (where id in (e_cm1, e_staff)),
         max(case when id = e_cm1 then coalesce(person_name, '') || '/' || coalesce(notes, '') end),
         max(case when id = e_staff then coalesce(person_name, '') || '/' || coalesce(notes, '') || '/' || title end)
    into r from public.calendar_events_between(current_date, current_date + 7);
  reset role;
  if r.count <> 2 or r.max <> 'Client Name/private note' then raise exception 'FAIL: own event on the calendar: %', r; end if;

  perform pg_temp.as_user(cm1);
  set local role authenticated;
  select coalesce(person_name, '') || '/' || coalesce(notes, '') || '/' || title into seen
  from public.calendar_events_between(current_date, current_date + 7) where id = e_staff;
  reset role;
  if seen <> '//T7 visit' then raise exception 'FAIL: someone else''s event shows person or notes: %', seen; end if;

  perform pg_temp.as_user(rec);
  set local role authenticated;
  select coalesce(person_name, '') || '/' || coalesce(notes, '') || '/' || title into seen
  from public.calendar_events_between(current_date, current_date + 7) where id = e_cm1;
  reset role;
  if seen <> '//T7 meeting' then raise exception 'FAIL: a receptionist sees the person or notes: %', seen; end if;

  perform pg_temp.as_user(admin);
  set local role authenticated;
  if (select count(*) from public.calendar_events_between(current_date, current_date + 7)
      where id in (e_cm1, e_staff) and person_name is not null and notes is not null) <> 2 then
    raise exception 'FAIL: an administrator does not see the person and notes';
  end if;
  reset role;

  -- Signed out: nothing.
  if has_function_privilege('anon', 'public.calendar_events_between(date, date)', 'EXECUTE') then
    raise exception 'FAIL: the calendar is readable signed out';
  end if;

  -- The creator still edits; others still can't.
  perform pg_temp.as_user(cm1);
  set local role authenticated;
  update public.calendar_events set title = 'T7 meeting edited' where id = e_cm1;
  if not found then raise exception 'FAIL: the creator can no longer edit their event'; end if;
  update public.calendar_events set title = 'hijack' where id = e_staff;
  if found then raise exception 'FAIL: edited someone else''s event'; end if;
  reset role;

  raise exception 'T7_CHECKS_PASSED';
end $$;
