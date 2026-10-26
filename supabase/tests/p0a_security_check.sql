-- Regression checks for 20261026130000_p0a_security_hotfixes.sql.
-- Run AFTER the migration, inside the same transaction. It always ends by
-- raising 'P0A_CHECKS_PASSED', so nothing it (or the migration) wrote is ever
-- committed; any failed check raises its own message first.
-- Personas are real live profiles, identified by role only:
--   :cm    an active case_manager     :staff an active 'staff' profile
--   :admin an active administrator
do $$
declare
  cm    uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  v jsonb;
  n int;
  ok boolean;
  note_id uuid;
begin
  if cm is null or staff is null or admin is null then raise exception 'personas missing'; end if;

  -- ---------- anon ----------
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  -- New staff picker: names and roles, no email column.
  select count(*) into n from public.public_appointment_staff();
  if n < 1 then raise exception 'public_appointment_staff returned nothing'; end if;

  -- A request routed to a picked staff member gets that member's email, forced status/source.
  perform public.request_appointment('Dry', 'Run', '555-0100', '', current_date + 7, '10:00 AM', 'p0a check', cm, null);
  reset role;
  select count(*) into n from public.appointments
    where last_name = 'Run' and reason = 'p0a check' and status = 'requested' and source = 'client'
      and assigned_email = (select email from public.profiles where id = cm);
  if n <> 1 then raise exception 'request_appointment did not resolve the assignee'; end if;
  set local role anon;

  -- An unknown or non-eligible staff id is refused (an administrator is not pickable).
  ok := false;
  begin perform public.request_appointment('Dry', 'Run', '555', '', current_date + 7, '10:00', '', admin, null);
  exception when others then ok := true; end;
  if not ok then raise exception 'request_appointment accepted an ineligible staff id'; end if;

  -- Writes through staff_directory are gone.
  ok := false;
  begin update public.staff_directory set name = name;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon can still write through staff_directory'; end if;

  -- Numbering functions are not anonymous RPCs.
  ok := false;
  begin perform public.next_nb_id();
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon can still call next_nb_id'; end if;

  -- Not yet removed (part B): the old anon insert path still works, so the
  -- live page keeps working between part A and the frontend deploy.
  insert into public.appointments (first_name, last_name, phone, appt_date, appt_time, meeting_with, status, source)
  values ('Dry', 'Legacy', '555', current_date + 7, '10:00', 'case_manager', 'requested', 'client');
  reset role;

  -- ---------- 'staff' role ----------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);

  ok := false;
  begin perform public.create_case_client('{"first_name":"Dry","last_name":"Run"}', '{"first_name":"Dry","last_name":"Run"}', null);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'staff can still create case clients'; end if;

  ok := false;
  begin perform public.create_job_client('{"first_name":"Dry","last_name":"Run"}', '{"first_name":"Dry","last_name":"Run"}', null);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'staff can still create job clients'; end if;

  -- Unchanged for staff: food clients and students (their tables allow any active staff).
  v := public.create_food_client('{"first_name":"Dry","last_name":"Food"}', '{"first_name":"Dry","last_name":"Food"}', null);
  if v->>'client_id' is null then raise exception 'staff lost create_food_client'; end if;
  v := public.create_student('{"first_name":"Dry","last_name":"Student"}', '{"first_name":"Dry","last_name":"Student"}', null);
  if v->>'client_id' is null then raise exception 'staff lost create_student'; end if;

  -- Attribution is stamped from the session, even when the client claims someone else.
  insert into public.client_notes (client_id, content, created_by, visibility)
  values ((v->>'client_id')::uuid, 'p0a check', admin, 'private') returning id into note_id;
  reset role;
  if (select created_by from public.client_notes where id = note_id) <> staff then
    raise exception 'client_notes.created_by was not stamped';
  end if;
  set local role authenticated;

  -- A user cannot change their own email.
  update public.profiles set email = 'someone-else@example.org' where id = staff;
  reset role;
  if (select email from public.profiles where id = staff) = 'someone-else@example.org' then
    raise exception 'staff could change their own email';
  end if;

  -- ---------- case manager ----------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  v := public.create_case_client('{"first_name":"Dry","last_name":"Case"}', '{"first_name":"Dry","last_name":"Case"}', null);
  if v->>'client_id' is null then raise exception 'case manager lost create_case_client'; end if;
  v := public.create_job_client('{"first_name":"Dry","last_name":"Job"}', '{"first_name":"Dry","last_name":"Job"}', null);
  if v->>'client_id' is null then raise exception 'case manager lost create_job_client'; end if;
  reset role;

  -- ---------- storage policies by role ----------
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname like 'client_documents_bucket_%') <> 3
     or (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
        and policyname like 'client_documents_bucket_%' and coalesce(qual, with_check) like '%has_role%') <> 3 then
    raise exception 'expected 3 role-checked bucket policies';
  end if;

  -- ---------- signup ----------
  -- handle_new_user maps a requested administrator to staff (checked on the function body,
  -- since creating a real auth user in a dry run would send nothing but is still noise).
  if position('''administrator''' in pg_get_functiondef('public.handle_new_user'::regproc)) > 0 then
    raise exception 'handle_new_user still accepts administrator';
  end if;

  raise exception 'P0A_CHECKS_PASSED';
end;
$$;
