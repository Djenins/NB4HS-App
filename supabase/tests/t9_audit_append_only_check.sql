-- Checks for t9_audit_append_only (audit finding S11). Run AFTER the
-- migration, as postgres; fails on a database without it. Ends by raising
-- 'T9_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
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
  admin uuid := pg_temp.dryrun_account('administrator');
  gone uuid := pg_temp.dryrun_account('staff');
  last_id bigint;
  n int;
  ok boolean;
begin
  select max(id) into last_id from public.audit_events;

  -- Owner, normal mode: UPDATE, DELETE and TRUNCATE are refused (p1a, kept).
  ok := false;
  begin update public.audit_events set reason = 'tampered' where id = last_id;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: the owner updated audit_events'; end if;
  ok := false;
  begin delete from public.audit_events where id = last_id;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: the owner deleted from audit_events'; end if;
  ok := false;
  begin truncate public.audit_events;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: the owner truncated audit_events'; end if;

  -- Replica mode no longer switches the guard off.
  set local session_replication_role = replica;
  ok := false;
  begin update public.audit_events set reason = 'tampered' where id = last_id;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: audit_events was updated with session_replication_role = replica'; end if;
  ok := false;
  begin delete from public.audit_events where id = last_id;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'FAIL: audit_events was deleted from with session_replication_role = replica'; end if;
  -- ...and profile changes are still audited in that mode.
  update public.profiles set name = 'Renamed in replica mode' where id = gone;
  if not exists (select 1 from public.audit_events where table_name = 'profiles' and subject_user_id = gone
                 and new_values ->> 'name' = 'Renamed in replica mode') then
    raise exception 'FAIL: a profile change in replica mode was not audited';
  end if;
  set local session_replication_role = origin;

  -- Only the audit functions write the log: not the API roles.
  foreach n in array array[1, 2, 3] loop
    perform set_config('request.jwt.claims', case when n = 3 then
      json_build_object('sub', admin, 'role', 'authenticated')::text else '' end, true);
    execute format('set local role %I', (array['service_role', 'anon', 'authenticated'])[n]);
    ok := false;
    begin insert into public.audit_events (action, table_name, record_id) values ('update', 'profiles', 'forged');
    exception when insufficient_privilege then ok := true; end;
    reset role;
    if not ok then raise exception 'FAIL: % wrote a row into audit_events', (array['service_role', 'anon', 'authenticated'])[n]; end if;
  end loop;

  -- Deleting an account with audit history works, the delete is recorded,
  -- and the earlier rows keep the account's id.
  select count(*), max(id) into n, last_id from public.audit_events where subject_user_id = gone;
  if n = 0 then raise exception 'FAIL setup: the throwaway account has no audit history'; end if;
  perform pg_temp.as_user(admin);
  delete from auth.users where id = gone;
  if exists (select 1 from public.profiles where id = gone) then raise exception 'FAIL: the profile was not deleted'; end if;
  if not exists (select 1 from public.audit_events where table_name = 'profiles' and action = 'delete'
                 and subject_user_id = gone and actor_id = admin and old_values ->> 'role' = 'staff') then
    raise exception 'FAIL: the profile delete was not audited';
  end if;
  if (select count(*) from public.audit_events where subject_user_id = gone and id <= last_id) <> n then
    raise exception 'FAIL: the deleted account''s earlier audit rows lost its id';
  end if;

  raise exception 'T9_CHECKS_PASSED';
end $$;
