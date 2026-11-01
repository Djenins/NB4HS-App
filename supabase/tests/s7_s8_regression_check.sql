-- Regression check for audit findings S7 and S8 (plans/unified-access-architecture.md
-- §2.1), fixed by p3b and p3c. Unlike p3b_s7_check and p3c_s8_check, it needs
-- no before-snapshot: run it on any database with every migration applied.
-- Ends by raising 'S7_S8_CHECKS_PASSED', so nothing is committed. Uses
-- throwaway accounts and rows.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;
create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated',
    'email', 'dryrun-' || p_uid || '@example.invalid')::text, true);
end $f$;

do $$
declare
  cm uuid := pg_temp.dryrun_account('case_manager');
  jd uuid := pg_temp.dryrun_account('job_developer');
  staff uuid := pg_temp.dryrun_account('staff');
  admin uuid := pg_temp.dryrun_account('administrator');
  emp uuid;
  client uuid;
  n int;
  seen jsonb;
begin
  insert into public.employers (business_name) values ('S7 dry run employer') returning id into emp;
  insert into public.clients (first_name, last_name) values ('S8', 'Dry run') returning id into client;
  insert into public.client_intakes (client_id, form) values (client, '{"household": "S8 secret"}');

  -- ===== S7: the Workforce setting and the database agree =====
  -- Setting on for case managers: a case manager reads employers.
  update public.workforce_role_access set enabled = true where role = 'case_manager';
  perform pg_temp.as_user(cm);
  set local role authenticated;
  select count(*) into n from public.employers where id = emp;
  reset role;
  if n <> 1 then raise exception 'FAIL S7: case manager with Workforce access is refused employers'; end if;

  -- Setting off for case managers: refused again.
  update public.workforce_role_access set enabled = false where role = 'case_manager';
  perform pg_temp.as_user(cm);
  set local role authenticated;
  select count(*) into n from public.employers where id = emp;
  reset role;
  if n <> 0 then raise exception 'FAIL S7: case manager without Workforce access reads employers'; end if;

  -- Setting off for job developers: the database refuses them too (it used
  -- to let them in by account type).
  update public.workforce_role_access set enabled = false where role = 'job_developer';
  perform pg_temp.as_user(jd);
  set local role authenticated;
  select count(*) into n from public.employers where id = emp;
  reset role;
  if n <> 0 then raise exception 'FAIL S7: job developer without Workforce access still reads employers'; end if;
  update public.workforce_role_access set enabled = true where role = 'job_developer';
  perform pg_temp.as_user(jd);
  set local role authenticated;
  select count(*) into n from public.employers where id = emp;
  reset role;
  if n <> 1 then raise exception 'FAIL S7: job developer with Workforce access is refused employers'; end if;

  -- ===== S8: the intake form is not readable by every staff account =====
  -- Plain staff read the client but not the intake form, on either table.
  perform pg_temp.as_user(staff);
  set local role authenticated;
  select count(*) into n from public.clients where id = client;
  if n <> 1 then reset role; raise exception 'FAIL S8 setup: staff cannot read the client record'; end if;
  select count(*) into n from public.client_intakes where client_id = client;
  if n <> 0 then reset role; raise exception 'FAIL S8: staff read the intake form'; end if;
  select intake_form into seen from public.clients where id = client;
  if seen is not null then reset role; raise exception 'FAIL S8: the intake form is on clients, readable by staff'; end if;
  -- Writing through the old column can't save it either.
  begin
    update public.clients set intake_form = '{"household": "planted"}' where id = client;
  exception when others then null;
  end;
  reset role;
  if exists (select 1 from public.client_intakes i where i.client_id = client and i.form ->> 'household' = 'planted') then
    raise exception 'FAIL S8: staff saved an intake form through clients.intake_form';
  end if;
  if exists (select 1 from public.clients where intake_form is not null) then
    raise exception 'FAIL S8: an intake form is stored on clients';
  end if;

  -- Case managers and administrators still read it.
  foreach staff in array array[cm, admin] loop
    perform pg_temp.as_user(staff);
    set local role authenticated;
    select count(*) into n from public.client_intakes where client_id = client;
    reset role;
    if n <> 1 then raise exception 'FAIL S8: % lost the intake form', (select role from public.profiles where id = staff); end if;
  end loop;

  -- Signed out: nothing.
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  select count(*) into n from public.client_intakes;
  reset role;
  if n <> 0 then raise exception 'FAIL S8: intake forms are readable signed out'; end if;

  raise exception 'S7_S8_CHECKS_PASSED';
end $$;
