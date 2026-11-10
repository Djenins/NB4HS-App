-- Checks for s1_mfa_lookup_hardening. Run AFTER the migration; ends by
-- raising 'S1_CHECKS_PASSED', so nothing is committed. Uses throwaway
-- accounts and leaves require_mfa as it found it.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

create or replace function pg_temp.act_as(p_user uuid, p_aal text) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('request.path', '/profiles', true);
  set local role authenticated;
end $f$;
grant execute on function pg_temp.act_as(uuid, text) to authenticated;

create or replace function pg_temp.act_anon() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.path', '/rpc/kiosk_roster', true);
  set local role anon;
end $f$;
grant execute on function pg_temp.act_anon() to anon, authenticated;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  worker uuid := pg_temp.dryrun_account('staff');
  n int;
  cols text;
  missing text;
  msg text;
begin
  perform public.refresh_effective_permissions(admin);
  perform public.refresh_effective_permissions(worker);

  -- 1. Lookup no longer returns the reason.
  select string_agg(a, ',' order by o) into cols
  from pg_proc p, unnest(p.proargnames, p.proargmodes::text[]) with ordinality as x(a, m, o)
  where p.proname = 'lookup_client_appointments' and m = 't';
  if cols <> 'appt_date,appt_time,meeting_with,status' then
    raise exception 'lookup returns %', cols;
  end if;
  if not has_function_privilege('anon', 'public.lookup_client_appointments(text,text,text)', 'execute') then
    raise exception 'anon lost the lookup';
  end if;

  -- 2. Every public RLS table and storage.objects carries the gate.
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
                    and p.policyname = 'mfa_required' and p.permissive = 'RESTRICTIVE');
  if missing is not null then raise exception 'no mfa_required policy on %', missing; end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'mfa_required') then
    raise exception 'no mfa_required policy on storage.objects';
  end if;

  -- 3. Setting off: a password-only session still works.
  delete from public.app_settings where key = 'require_mfa';
  perform pg_temp.act_as(worker, 'aal1');
  perform public.api_pre_request();
  select count(*) into n from public.profiles where id = worker;
  if n <> 1 then raise exception 'off: aal1 lost its own profile'; end if;
  reset role;

  -- 4. An admin can't switch it on from a password-only session.
  perform pg_temp.act_as(admin, 'aal1');
  begin
    perform public.admin_set_setting('require_mfa', 'true'::jsonb, 'check');
    raise exception 'aal1 admin turned require_mfa on';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_set_setting('require_mfa', '"yes"'::jsonb, 'check');
    raise exception 'require_mfa took a string';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  perform pg_temp.act_as(admin, 'aal2');
  perform public.admin_set_setting('require_mfa', 'true'::jsonb, 'check');
  reset role;

  -- 5. Setting on: aal1 sees nothing and is refused at the door.
  perform pg_temp.act_as(worker, 'aal1');
  select count(*) into n from public.profiles where id = worker;
  if n <> 0 then raise exception 'on: aal1 still reads profiles'; end if;
  select count(*) into n from public.app_settings;
  if n <> 0 then raise exception 'on: aal1 still reads app_settings'; end if;
  begin
    perform public.api_pre_request();
    raise exception 'on: pre-request let aal1 through';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg not like 'Two-step sign-in required%' then raise; end if;
  end;
  reset role;

  -- 6. Setting on: aal2 works as before.
  perform pg_temp.act_as(worker, 'aal2');
  perform public.api_pre_request();
  select count(*) into n from public.profiles where id = worker;
  if n <> 1 then raise exception 'on: aal2 lost its own profile'; end if;
  reset role;

  -- 7. Signed-out callers are untouched.
  perform pg_temp.act_anon();
  begin
    perform public.api_pre_request();
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like 'Two-step%' then raise exception 'anon hit the MFA gate'; end if;
  end;
  reset role;

  -- 8. Audited authenticator reset.
  perform pg_temp.act_as(admin, 'aal2');
  perform public.admin_log_auth_action(worker, 'mfa_reset', 'Lost phone');
  begin
    perform public.admin_log_auth_action(worker, 'something_else', 'x');
    raise exception 'unknown auth action accepted';
  exception when invalid_parameter_value then null;
  end;
  reset role;
  select count(*) into n from public.audit_events where action = 'mfa_reset' and record_id = worker::text;
  if n <> 1 then raise exception 'mfa_reset not audited (%)', n; end if;

  -- 9. Enrollment list: admins only, and nobody here has a factor.
  perform pg_temp.act_as(admin, 'aal2');
  select count(*) into n from public.admin_mfa_enrollment() where user_id in (admin, worker) and not enrolled;
  if n <> 2 then raise exception 'enrollment list wrong (%)', n; end if;
  reset role;
  perform pg_temp.act_as(worker, 'aal2');
  begin
    perform public.admin_mfa_enrollment();
    raise exception 'staff read the enrollment list';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise exception 'S1_CHECKS_PASSED';
end;
$$;
