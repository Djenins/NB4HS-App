-- Checks for m1_mileage_log. Run AFTER the migration; ends by raising
-- 'M1_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $f$;
grant execute on function pg_temp.act_as(uuid) to authenticated;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  worker uuid := pg_temp.dryrun_account('staff');
  other uuid := pg_temp.dryrun_account('case_manager');
  lead uuid := pg_temp.dryrun_account('staff');
  reviewer uuid := pg_temp.dryrun_account('staff');
  v_trip uuid;
  n int;
  msg text;
begin
  perform public.refresh_effective_permissions(admin);
  -- worker and lead are on SNAP; reviewer reviews staff reports (worker is
  -- also a staff-reports member, which must not open their mileage).
  insert into public.program_staff (user_id, program, program_role) values
    (worker, 'snap', 'worker'), (lead, 'snap', 'supervisor'),
    (reviewer, 'staff_reports', 'program_admin'), (worker, 'staff_reports', 'reviewer');

  -- A worker logs a trip; it is theirs whatever staff_id they send.
  perform pg_temp.act_as(worker);
  insert into public.mileage_trips (trip_date, start_location, destination, purpose, miles, round_trip)
  values (date '2026-11-03', 'Office', 'Client home, Pawtucket', 'SNAP application help', 6.4, true)
  returning id into v_trip;
  msg := null;
  begin
    insert into public.mileage_trips (staff_id, trip_date, start_location, destination, purpose, miles)
    values (other, date '2026-11-03', 'Office', 'Somewhere', 'Pretend', 3);
  exception when insufficient_privilege then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a worker logged a trip for someone else'; end if;

  -- Bad values are refused.
  msg := null;
  begin
    insert into public.mileage_trips (trip_date, start_location, destination, purpose, miles)
    values (date '2026-11-03', 'Office', 'Here', 'Zero miles', 0);
  exception when check_violation then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a zero-mile trip was accepted'; end if;
  msg := null;
  begin
    insert into public.mileage_trips (trip_date, start_location, destination, purpose, miles, odometer_start, odometer_end)
    values (date '2026-11-03', 'Office', 'Here', 'Backwards odometer', 4, 1000, 990);
  exception when check_violation then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an odometer that ran backwards was accepted'; end if;

  update public.mileage_trips set miles = 7.0 where id = v_trip;
  if not found then raise exception 'FAIL: the worker could not edit their own trip'; end if;
  reset role;

  -- Another staff member neither sees nor changes it.
  perform pg_temp.act_as(other);
  select count(*) into n from public.mileage_trips where id = v_trip;
  if n <> 0 then raise exception 'FAIL: another staff member saw the trip'; end if;
  update public.mileage_trips set miles = 99 where id = v_trip;
  delete from public.mileage_trips where id = v_trip;
  reset role;
  if (select miles from public.mileage_trips where id = v_trip) <> 7.0 then
    raise exception 'FAIL: another staff member changed the trip';
  end if;

  -- The worker's SNAP supervisor reads it, can't change it, and has them on the team list.
  perform pg_temp.act_as(lead);
  select count(*) into n from public.mileage_trips where id = v_trip;
  if n <> 1 then raise exception 'FAIL: the SNAP supervisor could not read their worker''s trip'; end if;
  update public.mileage_trips set miles = 50 where id = v_trip;
  if found then raise exception 'FAIL: the supervisor edited their worker''s trip'; end if;
  if not exists (select 1 from public.mileage_team() where id = worker) then
    raise exception 'FAIL: the worker is missing from the supervisor''s team list';
  end if;
  if exists (select 1 from public.mileage_team() where id = other) then
    raise exception 'FAIL: someone outside the program is on the supervisor''s team list';
  end if;
  reset role;

  -- Staff Reports leads are not mileage supervisors; a worker sees no team.
  perform pg_temp.act_as(reviewer);
  select count(*) into n from public.mileage_trips where id = v_trip;
  if n <> 0 then raise exception 'FAIL: a staff-reports admin read the trip'; end if;
  reset role;
  perform pg_temp.act_as(worker);
  if exists (select 1 from public.mileage_team()) then raise exception 'FAIL: a worker has a mileage team'; end if;
  reset role;

  -- An inactive membership no longer counts.
  update public.program_staff set active = false where user_id = worker and program = 'snap';
  perform pg_temp.act_as(lead);
  select count(*) into n from public.mileage_trips where id = v_trip;
  if n <> 0 then raise exception 'FAIL: the supervisor still reads a former worker''s trips'; end if;
  reset role;
  update public.program_staff set active = true where user_id = worker and program = 'snap';

  -- An administrator reads it but cannot edit or delete it.
  perform pg_temp.act_as(admin);
  select count(*) into n from public.mileage_trips where id = v_trip;
  if n <> 1 then raise exception 'FAIL: the administrator could not read the trip'; end if;
  update public.mileage_trips set miles = 50 where id = v_trip;
  delete from public.mileage_trips where id = v_trip;
  reset role;
  if (select miles from public.mileage_trips where id = v_trip) <> 7.0 then
    raise exception 'FAIL: the administrator changed someone else''s trip';
  end if;

  -- The rate: administrators only, a sane number.
  perform pg_temp.act_as(admin);
  perform public.admin_set_setting('mileage_rate', '0.7'::jsonb, null);
  msg := null;
  begin perform public.admin_set_setting('mileage_rate', '"lots"'::jsonb, null); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a text mileage rate was accepted'; end if;
  msg := null;
  begin perform public.admin_set_setting('mileage_rate', '7'::jsonb, null); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a 7 dollar mileage rate was accepted'; end if;
  perform public.admin_set_setting('closing_time', '"17:00"'::jsonb, null);
  reset role;
  if (select value from public.app_settings where key = 'mileage_rate') <> '0.7'::jsonb then
    raise exception 'FAIL: the mileage rate was not saved';
  end if;
  perform pg_temp.act_as(worker);
  msg := null;
  begin perform public.admin_set_setting('mileage_rate', '0.9'::jsonb, null); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a worker changed the mileage rate'; end if;
  reset role;

  -- The worker deletes their own trip; every step was audited.
  perform pg_temp.act_as(worker);
  delete from public.mileage_trips where id = v_trip;
  if not found then raise exception 'FAIL: the worker could not delete their own trip'; end if;
  reset role;
  if (select count(*) from public.audit_events where table_name = 'mileage_trips' and record_id = v_trip::text) <> 3 then
    raise exception 'FAIL: insert, edit and delete were not all audited';
  end if;
  raise exception 'M1_CHECKS_PASSED';
end $$;
