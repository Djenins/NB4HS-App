-- Checks for p3a's program-access functions (the Program Access tab). Run
-- AFTER the migration, in the same transaction. Ends by raising
-- P3A_PROGRAM_ACCESS_PASSED, so nothing is committed.
do $$
declare
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  msg text;
begin
  if admin is null or staff is null then raise exception 'need an active administrator and staff member'; end if;
  if exists (select 1 from public.user_program_access where user_id = staff and program_key = 'students') then
    raise exception 'checks assume the staff member has no Students access yet';
  end if;

  -- A staff member can't give anyone access.
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform public.admin_grant_program(admin, 'students', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff granted program access'; end if;
  msg := null;
  begin perform public.admin_resync_legacy(admin); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff could run the legacy resync'; end if;
  reset role;

  -- An administrator grants, can't grant twice, can't touch their own.
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_grant_program(staff, 'students', 'Covering enrolment');
  msg := null;
  begin perform public.admin_grant_program(staff, 'students', 'again'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: granted the same program twice'; end if;
  msg := null;
  begin perform public.admin_grant_program(admin, 'snap', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an admin changed their own program access'; end if;
  msg := null;
  begin perform public.admin_revoke_program(staff, 'food_distribution', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: removed automatic program access by hand'; end if;
  reset role;

  if not exists (select 1 from public.user_program_access where user_id = staff and program_key = 'students'
                 and source = 'admin' and revoked_at is null and granted_by = admin) then
    raise exception 'FAIL: the grant was not recorded as the admin''s';
  end if;
  if not exists (select 1 from public.audit_events where table_name = 'user_program_access' and subject_user_id = staff
                 and actor_id = admin and reason = 'Covering enrolment') then
    raise exception 'FAIL: the grant was not audited with its reason';
  end if;

  -- Remove it again (and re-grant after removal works).
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_revoke_program(staff, 'students', 'Cover ended');
  perform public.admin_grant_program(staff, 'students', 'Back again');
  reset role;
  if not exists (select 1 from public.user_program_access where user_id = staff and program_key = 'students' and revoked_at is null and source = 'admin') then
    raise exception 'FAIL: re-granting after removal';
  end if;

  -- The account type now includes Students too: removing the admin's grant
  -- must leave the automatic access in place.
  update public.profiles set role = 'case_manager' where id = staff;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.admin_revoke_program(staff, 'students', 'Now automatic');
  reset role;
  if not exists (select 1 from public.user_program_access where user_id = staff and program_key = 'students'
                 and revoked_at is null and source = 'legacy_sync') then
    raise exception 'FAIL: removing an admin grant took away access the account type gives';
  end if;
  if not exists (select 1 from public.user_effective_permissions where user_id = staff and permission_key = 'students.view') then
    raise exception 'FAIL: the case manager lost students.view';
  end if;

  raise exception 'P3A_PROGRAM_ACCESS_PASSED';
end $$;
