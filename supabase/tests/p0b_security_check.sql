-- Regression checks for 20261026130100_p0b_close_anon_appointment_paths.sql.
-- Run AFTER p0a and p0b, inside the same transaction. Always ends by raising
-- 'P0B_CHECKS_PASSED', so nothing is ever committed.
do $$
declare
  cm    uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  ok boolean;
begin
  set local role anon;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  ok := false;
  begin insert into public.appointments (first_name, last_name, phone, appt_date, appt_time, meeting_with, status, source)
    values ('Dry', 'Legacy', '555', current_date + 7, '10:00', 'case_manager', 'scheduled', 'staff');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon can still insert appointments directly'; end if;

  ok := false;
  begin perform 1 from public.staff_directory limit 1;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'anon can still read staff_directory'; end if;

  -- The supported public path still works.
  perform public.request_appointment('Dry', 'Run', '555', '', current_date + 7, '10:00', 'p0b check', cm, null);
  reset role;

  -- Staff still create appointments directly.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  insert into public.appointments (first_name, last_name, phone, appt_date, appt_time, meeting_with, status, source)
    values ('Dry', 'Staff', '555', current_date + 7, '10:00', 'case_manager', 'scheduled', 'staff');
  reset role;

  if (select count(*) from public.appointments where last_name in ('Run', 'Staff') and first_name = 'Dry') <> 2 then
    raise exception 'supported appointment paths broken';
  end if;
  raise exception 'P0B_CHECKS_PASSED';
end;
$$;
