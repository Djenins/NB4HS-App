-- Checks for p2a_admin_accounts. Run AFTER the migration, inside the same
-- transaction. Always ends by raising 'P2_CHECKS_PASSED ...', so nothing it
-- (or the migration) wrote is committed; any failed check raises its own
-- message first.
--
-- Each block signs in as a real account (request.jwt.claims + role
-- authenticated), the way the browser and the Edge Function reach these
-- functions, then switches back to check the result as the owner.
do $$
declare
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  cm uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  legacy_staff uuid := (select id from public.roles where key = 'legacy_staff');
  v_role uuid;
  v_assign uuid;
  v_pos1 uuid;
  v_pos2 uuid;
  n int;
  m int;
  msg text;
  s text;
begin
  if admin is null or staff is null or cm is null then
    raise exception 'need an active administrator, staff member and case manager to run these checks';
  end if;

  -- ---------------- modules ----------------
  if exists (select 1 from public.app_modules where key in ('admin.roles', 'admin.positions') and not implemented) then
    raise exception 'FAIL: Roles and Positions modules are still off';
  end if;
  if not exists (select 1 from public.user_effective_permissions where user_id = admin and permission_key = 'admin.roles.manage')
     or not exists (select 1 from public.user_effective_permissions where user_id = admin and permission_key = 'admin.positions.manage') then
    raise exception 'FAIL: administrators did not gain the roles and positions permissions';
  end if;
  if exists (select 1 from public.user_effective_permissions where user_id in (staff, cm) and permission_key like 'admin.%') then
    raise exception 'FAIL: a non-administrator holds an admin permission';
  end if;

  -- ---------------- anon can call none of it ----------------
  select string_agg(p.proname, ', ') into s from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'EXECUTE');
  if s is not null then raise exception 'FAIL: anon can execute %', s; end if;
  select string_agg(p.proname, ', ') into s from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('admin_require', 'admin_is_privileged', 'admin_check_target', 'admin_audit_event')
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if s is not null then raise exception 'FAIL: signed-in users can call internal helper %', s; end if;

  -- ---------------- a staff member is refused everything ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform * from public.admin_users(); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could list accounts'; end if;
  msg := null;
  begin perform public.admin_set_user_active(cm, false, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could deactivate someone'; end if;
  msg := null;
  begin perform public.admin_revoke_sessions(cm, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could sign someone out'; end if;
  msg := null;
  begin perform public.admin_create_role('Sneaky', ''); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could create a role'; end if;
  msg := null;
  begin perform public.admin_create_position('Sneaky', ''); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could create a position'; end if;
  msg := null;
  begin perform public.admin_record_invite(cm, 'email', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could record an invite'; end if;

  -- Browser writes: own name yes; own role/status/email no; someone else no.
  update public.profiles set name = name || ' (t)', role = 'administrator', active = false, email = 'x@example.org' where id = staff;
  update public.profiles set name = 'Changed by staff' where id = cm;
  reset role;
  if (select role from public.profiles where id = staff) <> 'staff'
     or not (select active from public.profiles where id = staff)
     or (select email from public.profiles where id = staff) = 'x@example.org' then
    raise exception 'FAIL: staff changed their own role, status or email';
  end if;
  if (select name from public.profiles where id = staff) not like '% (t)' then
    raise exception 'FAIL: staff could no longer edit their own name';
  end if;
  if (select name from public.profiles where id = cm) = 'Changed by staff' then
    raise exception 'FAIL: staff edited someone else''s profile';
  end if;

  -- ---------------- an administrator ----------------
  insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), staff, now(), now());
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.admin_users();
  select count(*) into m from public.admin_users(staff);
  if m <> 1 then raise exception 'FAIL: admin_users(one) returned % rows', m; end if;

  -- Their own account is off limits; a reason is required.
  msg := null;
  begin perform public.admin_set_user_active(admin, false, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an admin deactivated themselves'; end if;
  msg := null;
  begin perform public.admin_set_user_active(staff, false, ' '); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: deactivated without a reason'; end if;

  -- Browser path: an admin still can't change their own status or anyone's email.
  update public.profiles set active = false where id = admin;
  update public.profiles set email = 'x@example.org' where id = cm;

  perform public.admin_set_user_active(staff, false, 'Left the organisation');
  reset role;

  if (select count(*) from public.profiles) <> n then raise exception 'FAIL: admin_users() missed accounts'; end if;
  if not (select active from public.profiles where id = admin) then raise exception 'FAIL: an admin deactivated themselves in the browser'; end if;
  if (select email from public.profiles where id = cm) = 'x@example.org' then raise exception 'FAIL: an admin changed a sign-in email in the browser'; end if;
  if (select active from public.profiles where id = staff)
     or (select deactivated_by from public.profiles where id = staff) is distinct from admin
     or (select deactivated_at from public.profiles where id = staff) is null then
    raise exception 'FAIL: deactivation did not mark the profile';
  end if;
  if coalesce((select banned_until from auth.users where id = staff), now()) < now() + interval '50 years' then
    raise exception 'FAIL: deactivation did not block sign-in';
  end if;
  if exists (select 1 from auth.sessions where user_id = staff) then
    raise exception 'FAIL: deactivation left sessions open';
  end if;
  if exists (select 1 from public.user_effective_permissions where user_id = staff) then
    raise exception 'FAIL: a deactivated account still holds permissions';
  end if;
  if not exists (select 1 from public.audit_events where table_name = 'profiles' and subject_user_id = staff
                 and actor_id = admin and reason = 'Left the organisation' and 'active' = any (changed_fields)) then
    raise exception 'FAIL: deactivation was not audited with its reason';
  end if;
  if not exists (select 1 from public.audit_events where action = 'revoke_sessions' and subject_user_id = staff
                 and actor_id = admin and (new_values ->> 'sessions_ended')::int >= 1) then
    raise exception 'FAIL: ending the sessions was not audited';
  end if;

  -- Reactivate, then sign out everywhere on its own.
  insert into auth.sessions (id, user_id, created_at, updated_at) values (gen_random_uuid(), staff, now(), now());
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_set_user_active(staff, true, 'Rehired');
  n := public.admin_revoke_sessions(staff, 'Lost laptop');
  reset role;
  if not (select active from public.profiles where id = staff)
     or (select deactivated_at from public.profiles where id = staff) is not null
     or (select banned_until from auth.users where id = staff) is not null then
    raise exception 'FAIL: reactivation did not restore the account';
  end if;
  if n < 1 or exists (select 1 from auth.sessions where user_id = staff) then
    raise exception 'FAIL: sign out everywhere left sessions (% ended)', n;
  end if;
  if not exists (select 1 from public.user_effective_permissions where user_id = staff) then
    raise exception 'FAIL: reactivated account got no permissions back';
  end if;

  -- Invites only for accounts that never signed in.
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform public.admin_record_invite(cm, 'email', 'Invited'); exception when others then msg := sqlerrm; end;
  reset role;
  if (select last_sign_in_at from auth.users where id = cm) is not null and msg is null then
    raise exception 'FAIL: an invite was recorded for someone who has already signed in';
  end if;

  -- ---------------- roles ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_role := public.admin_create_role('Front Desk Lead (Test)', 'For the checks', legacy_staff);
  v_assign := public.admin_assign_role(staff, v_role, null, null, 'Covering the front desk');
  msg := null;
  begin perform public.admin_assign_role(staff, legacy_staff, null, null, 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a legacy role was assigned by hand'; end if;
  msg := null;
  begin perform public.admin_assign_role(admin, v_role, null, null, 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an admin assigned a role to themselves'; end if;
  msg := null;
  begin perform public.admin_assign_role(staff, v_role, null, now() - interval '1 day', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: assigned a role that had already expired'; end if;
  msg := null;
  begin update public.roles set name = 'Renamed' where key = 'system_administrator'; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: the protected System Administrator role was renamed'; end if;
  update public.roles set description = 'Edited' where id = v_role;
  reset role;

  if (select kind from public.roles where id = v_role) <> 'custom'
     or (select key from public.roles where id = v_role) !~ '^front_desk_lead_test_[0-9a-f]{4}$' then
    raise exception 'FAIL: new role has kind % / key %', (select kind from public.roles where id = v_role), (select key from public.roles where id = v_role);
  end if;
  if (select count(*) from public.role_permissions where role_id = v_role)
     <> (select count(*) from public.role_permissions where role_id = legacy_staff) then
    raise exception 'FAIL: duplicating a role did not copy its permissions';
  end if;
  if (select description from public.roles where id = v_role) <> 'Edited' then
    raise exception 'FAIL: a custom role could not be edited';
  end if;
  if not exists (select 1 from public.audit_events where table_name = 'user_roles' and subject_user_id = staff
                 and reason = 'Covering the front desk' and actor_id = admin) then
    raise exception 'FAIL: the role assignment was not audited with its reason';
  end if;
  if not exists (select 1 from public.user_effective_permissions e where e.user_id = staff
                 and e.sources::text like '%' || v_assign::text || '%') then
    raise exception 'FAIL: the assigned role does not show in effective permissions';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_revoke_role(v_assign, 'Cover ended');
  msg := null;
  begin
    perform public.admin_revoke_role((select id from public.user_roles where user_id = staff and source = 'legacy_sync' and revoked_at is null limit 1), 'x');
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a legacy role assignment was revoked by hand'; end if;
  reset role;
  if (select revoked_by from public.user_roles where id = v_assign) is distinct from admin then
    raise exception 'FAIL: revoking the role did not record who';
  end if;

  -- ---------------- positions ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  v_pos1 := public.admin_create_position('Test Coordinator', '');
  v_pos2 := (select id from public.positions where key = 'receptionist');
  insert into public.user_positions (user_id, position_id, is_primary) values (staff, v_pos1, true), (staff, v_pos2, false);
  perform public.admin_set_primary_position(staff, v_pos2);
  perform public.admin_set_primary_position(staff, v_pos1);
  perform public.admin_set_primary_position(staff, v_pos1);
  msg := null;
  begin insert into public.user_positions (user_id, position_id, is_primary)
        values (staff, (select id from public.positions where key = 'case_manager'), true);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a second primary position was allowed'; end if;
  delete from public.user_positions where user_id = staff and position_id = v_pos2;
  reset role;
  if (select string_agg(name_en || '/' || name_ht || '/' || name_fr, '') from public.positions where id = v_pos1)
     <> 'Test Coordinator/Test Coordinator/Test Coordinator' then
    raise exception 'FAIL: a new position did not get all three names';
  end if;
  if (select count(*) from public.user_positions where user_id = staff) <> 1
     or not (select is_primary from public.user_positions where user_id = staff and position_id = v_pos1) then
    raise exception 'FAIL: primary position handling';
  end if;

  -- staff can't touch positions
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin insert into public.user_positions (user_id, position_id) values (cm, v_pos2); exception when others then msg := sqlerrm; end;
  reset role;
  if msg is null then raise exception 'FAIL: staff assigned a position'; end if;

  raise exception 'P2_CHECKS_PASSED % accounts listed; lifecycle, roles and positions behave', (select count(*) from public.profiles);
end;
$$;
