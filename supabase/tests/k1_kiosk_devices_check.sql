-- Checks for k1_kiosk_devices. Run AFTER the migration; ends by raising
-- 'K1_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts, a
-- throwaway class and student, and plays the anonymous caller, a paired
-- tablet and a revoked tablet by setting the request headers PostgREST
-- would.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

-- Act as someone: null = the anonymous kiosk or phone. p_key is the
-- x-kiosk-key header, if any.
create or replace function pg_temp.act_as(p_user uuid, p_key text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role":"anon"}' else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_key is null then '{}' else json_build_object('x-kiosk-key', p_key)::text end, true);
  if p_user is null then set local role anon; else set local role authenticated; end if;
end $f$;
grant execute on function pg_temp.act_as(uuid, text) to anon, authenticated;

-- Did the call raise "not a paired kiosk"?
create or replace function pg_temp.refused(p_sql text) returns boolean language plpgsql as $f$
begin
  execute p_sql;
  return false;
exception when insufficient_privilege then
  return true;
end $f$;
grant execute on function pg_temp.refused(text) to anon, authenticated;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  rec uuid := pg_temp.dryrun_account('receptionist');
  staff uuid := pg_temp.dryrun_account('staff');
  v_student uuid;
  v_device jsonb;
  v_key text;
  v_res jsonb;
  v_visit public.visits;
  msg text;
begin
  perform public.refresh_effective_permissions(admin);
  perform public.refresh_effective_permissions(rec);
  insert into public.classes (key, name) values ('k1-class', 'K1 Class');
  insert into public.students (first_name, last_name, class_key, phone, active)
  values ('Kay', 'Onetest', 'k1-class', '(401) 555-0142', true) returning id into v_student;

  -- Pairing is for administrators only.
  perform pg_temp.act_as(staff, null);
  msg := null;
  begin perform public.admin_create_kiosk_device('Lobby'); exception when insufficient_privilege then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a non-administrator paired a tablet'; end if;
  reset role;
  perform pg_temp.act_as(admin, null);
  v_device := public.admin_create_kiosk_device('Lobby tablet');
  v_key := v_device->>'key';
  if v_key !~ '^[0-9a-f]{64}$' then raise exception 'FAIL: pairing did not hand back a key'; end if;
  if not exists (select 1 from public.admin_kiosk_devices() d where d.name = 'Lobby tablet') then
    raise exception 'FAIL: the paired tablet is not listed';
  end if;
  reset role;
  if exists (select 1 from public.kiosk_devices where key_hash = v_key) then
    raise exception 'FAIL: the key is stored in plain text';
  end if;

  -- The anonymous caller: no lists, no student check-in by id.
  perform pg_temp.act_as(null, null);
  if not pg_temp.refused('select * from public.kiosk_roster()') then raise exception 'FAIL: anon read the roster'; end if;
  if not pg_temp.refused('select * from public.kiosk_visits(current_date)') then raise exception 'FAIL: anon read open visits'; end if;
  if not pg_temp.refused(format('select public.kiosk_student_check_in(%L, current_date)', v_student)) then
    raise exception 'FAIL: anon checked a student in by id';
  end if;
  -- A made-up key is no better.
  reset role;
  perform pg_temp.act_as(null, repeat('ab', 32));
  if not pg_temp.refused('select * from public.kiosk_roster()') then raise exception 'FAIL: a wrong key read the roster'; end if;
  reset role;

  -- A phone: visitor check-in today works, a backdated one doesn't.
  perform pg_temp.act_as(null, null);
  v_visit := public.kiosk_create_visit(jsonb_build_object('first_name', 'K1', 'last_name', 'Visitor', 'service', 'case_manager'));
  if v_visit.id is null then raise exception 'FAIL: phone visitor check-in failed'; end if;
  msg := null;
  begin
    perform public.kiosk_create_visit(jsonb_build_object('first_name', 'K1', 'last_name', 'Old', 'visit_date', '2020-01-06'));
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a phone filed a visit in 2020'; end if;
  -- ... and checks its own visit out by id.
  if (public.check_out_visit(v_visit.id)).time_out is null then raise exception 'FAIL: phone checkout by id failed'; end if;

  -- A phone: student self check-in.
  v_res := public.kiosk_student_self_check_in('Kay', 'Onetest', '0000', current_date);
  if v_res->>'status' <> 'not_found' then raise exception 'FAIL: wrong digits checked a student in (%)', v_res; end if;
  v_res := public.kiosk_student_self_check_in('kay ', ' ONETEST', '0142', current_date);
  if v_res->>'status' <> 'ok' or (v_res#>>'{visit,student_id}')::uuid <> v_student then
    raise exception 'FAIL: student self check-in failed (%)', v_res;
  end if;
  v_res := public.kiosk_student_self_check_in('Kay', 'Onetest', '0142', current_date);
  if v_res->>'status' <> 'already' then raise exception 'FAIL: second self check-in was not refused (%)', v_res; end if;
  if (v_res ? 'visit') then raise exception 'FAIL: the refusal handed back a visit'; end if;
  reset role;

  -- The paired tablet sees both lists and records that it was seen.
  perform pg_temp.act_as(null, v_key);
  if not exists (select 1 from public.kiosk_roster() r where r.id = v_student) then
    raise exception 'FAIL: the paired tablet does not see the roster';
  end if;
  if not exists (select 1 from public.kiosk_visits(current_date) kv where kv.student_id = v_student) then
    raise exception 'FAIL: the paired tablet does not see today''s check-ins';
  end if;
  reset role;
  if (select last_seen_at from public.kiosk_devices where id = (v_device->>'id')::uuid) is null then
    raise exception 'FAIL: last_seen_at was not recorded';
  end if;

  -- Staff with front-desk check-in still get the roster without a key.
  perform pg_temp.act_as(rec, null);
  if not exists (select 1 from public.kiosk_roster() r where r.id = v_student) then
    raise exception 'FAIL: the receptionist lost the roster';
  end if;
  reset role;

  -- Unpairing shuts the tablet out.
  perform pg_temp.act_as(admin, null);
  perform public.admin_revoke_kiosk_device((v_device->>'id')::uuid);
  reset role;
  perform pg_temp.act_as(null, v_key);
  if not pg_temp.refused('select * from public.kiosk_roster()') then raise exception 'FAIL: a revoked tablet read the roster'; end if;
  reset role;

  if (select count(*) from public.audit_events where table_name = 'kiosk_devices' and record_id = v_device->>'id') <> 2 then
    raise exception 'FAIL: pairing and unpairing were not both audited';
  end if;
  raise exception 'K1_CHECKS_PASSED';
end $$;
