-- Checks for p5a_permission_admin. Run AFTER the migration, inside the same
-- transaction. Always ends by raising 'P5_CHECKS_PASSED ...', so nothing it
-- (or the migration) wrote is committed; any failed check raises its own
-- message first.
--
-- The Phase 5 exit criteria (plans/unified-access-architecture.md §13):
--   * escalation tests -- a staff member, and an assigner who isn't a System
--     Administrator, are refused what they shouldn't do;
--   * the preview equals the state after saving, for overrides and for
--     role edits.
-- Each block signs in as a real account (request.jwt.claims + role
-- authenticated), the way the browser reaches these functions.
do $$
declare
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  cm uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  v_perm text;
  v_scoped boolean;
  v_prog text;
  v_held text;
  v_held_prog text;
  v_role uuid;
  v_role2 uuid;
  v_override uuid;
  v_deny uuid;
  n int;
  msg text;
  s text;
  preview_set text[];
  actual_set text[];
begin
  if admin is null or staff is null or cm is null then
    raise exception 'need an active administrator, staff member and case manager to run these checks';
  end if;

  -- ---------------- modules ----------------
  if exists (select 1 from public.app_modules where key in ('admin.programs', 'admin.audit') and not implemented) then
    raise exception 'FAIL: Programs & Modules or the Audit Log is still off';
  end if;
  if not exists (select 1 from public.user_effective_permissions where user_id = admin and permission_key = 'admin.audit.view')
     or not exists (select 1 from public.user_effective_permissions where user_id = admin and permission_key = 'admin.programs.manage') then
    raise exception 'FAIL: administrators did not gain the audit and programs permissions';
  end if;
  if exists (select 1 from public.user_effective_permissions where user_id in (staff, cm) and permission_key like 'admin.%') then
    raise exception 'FAIL: a non-administrator holds an admin permission';
  end if;

  -- ---------------- anon can call none of it ----------------
  select string_agg(p.proname, ', ') into s from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname in ('admin_add_override', 'admin_revoke_override', 'admin_set_role_permissions',
    'preview_role_permissions', 'admin_set_module_active', 'admin_set_setting', 'admin_check_access_target', 'admin_require_reason')
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if s is not null then raise exception 'FAIL: anon can execute %', s; end if;
  if has_table_privilege('anon', 'public.app_settings', 'SELECT') then raise exception 'FAIL: anon can read app_settings'; end if;
  if has_table_privilege('authenticated', 'public.app_settings', 'INSERT')
     or has_table_privilege('authenticated', 'public.app_settings', 'UPDATE') then
    raise exception 'FAIL: signed-in users can write app_settings directly';
  end if;

  -- A permission the staff member doesn't hold but could (module on, program open
  -- to them or no program), not an administration one; and one they do hold.
  select p.key, p.scoped, coalesce(nullif(pm.program_key, ''), null) into v_perm, v_scoped, v_prog
  from public.permissions p
  join lateral (
    with recursive up as (
      select m.key, m.parent_key, m.kind from public.app_modules m where m.key = p.module_key
      union all select m.key, m.parent_key, m.kind from public.app_modules m join up on m.key = up.parent_key
    ) select case when (select kind from up where parent_key is null) = 'program' then (select key from up where parent_key is null) else '' end as program_key
  ) pm on true
  where p.sensitivity = 'normal' and p.key not like '%.view'
    and (select m.parent_key from public.app_modules m where m.key = p.module_key) is null
    and not exists (select 1 from public.user_effective_permissions e where e.user_id = staff and e.permission_key = p.key)
    and (pm.program_key = '' or exists (select 1 from public.user_program_access a where a.user_id = staff and a.program_key = pm.program_key and a.revoked_at is null))
    and exists (select 1 from public.compute_effective_permissions(admin) c where c.permission_key = p.key)
    and (pm.program_key = '' or exists (select 1 from public.user_effective_permissions e
         where e.user_id = staff and e.permission_key = pm.program_key || '.view'))
  order by p.key limit 1;
  if v_perm is null then raise exception 'could not find a permission to test with'; end if;
  select e.permission_key, e.program_key into v_held, v_held_prog from public.user_effective_permissions e
  join public.permissions p on p.key = e.permission_key and not p.scoped
  where e.user_id = staff order by e.permission_key limit 1;
  if v_held is null then raise exception 'the staff member holds no unscoped permission to test a deny with'; end if;

  -- ---------------- a staff member is refused everything ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform public.admin_add_override(cm, v_perm, 'grant', case when v_scoped then 'org' end, null, null, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff added an override'; end if;
  msg := null;
  begin perform public.admin_set_role_permissions((select id from public.roles where key = 'legacy_staff'), '[]', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff edited a role'; end if;
  msg := null;
  begin perform * from public.preview_role_permissions((select id from public.roles where key = 'legacy_staff'), '[]'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff previewed a role edit'; end if;
  msg := null;
  begin perform public.admin_set_module_active('food_distribution', false, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff switched a module off'; end if;
  msg := null;
  begin perform public.admin_set_setting('closing_time', '"18:00"', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff changed a setting'; end if;
  reset role;

  -- ---------------- an administrator: overrides ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;

  msg := null;
  begin perform public.admin_add_override(admin, v_perm, 'grant', case when v_scoped then 'org' end, null, null, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an admin gave themselves an override'; end if;
  msg := null;
  begin perform public.admin_add_override(staff, v_perm, 'grant', case when v_scoped then 'org' end, null, null, ' '); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: override added without a reason'; end if;
  msg := null;
  begin perform public.admin_add_override(staff, v_perm, 'grant', case when v_scoped then 'org' end, null, now() - interval '1 day', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: override added with a past expiry'; end if;

  -- Grant: preview, save, compare. (An aggregate's "order by 1" sorts by
  -- the constant 1, not a column, so each one orders by its own expression.)
  select array_agg(permission_key || '|' || program_key || '|' || coalesce(after_scope, '-') order by permission_key || '|' || program_key || '|' || coalesce(after_scope, '-')) into preview_set
  from public.preview_effective_permissions(staff, jsonb_build_object('add_overrides', jsonb_build_array(jsonb_build_object(
    'permission_key', v_perm, 'effect', 'grant', 'scope', case when v_scoped then 'org' end, 'reason', 'testing'))))
  where change <> 'removed';
  v_override := public.admin_add_override(staff, v_perm, 'grant', case when v_scoped then 'org' end, null, null, 'Covering for a colleague');
  select array_agg(permission_key || '|' || program_key || '|' || coalesce(scope, '-') order by permission_key || '|' || program_key || '|' || coalesce(scope, '-')) into actual_set
  from public.user_permissions(staff);
  if preview_set is distinct from actual_set then
    raise exception 'FAIL: the grant preview (%) differs from the saved result (%)', preview_set, actual_set;
  end if;
  if not (v_perm = any (select permission_key from public.user_permissions(staff))) then
    raise exception 'FAIL: the grant override did not take effect (%)', v_perm;
  end if;

  -- Deny: preview, save, compare.
  select array_agg(permission_key || '|' || program_key || '|' || coalesce(after_scope, '-') order by permission_key || '|' || program_key || '|' || coalesce(after_scope, '-')) into preview_set
  from public.preview_effective_permissions(staff, jsonb_build_object('add_overrides', jsonb_build_array(jsonb_build_object(
    'permission_key', v_held, 'effect', 'deny', 'reason', 'testing'))))
  where change <> 'removed';
  v_deny := public.admin_add_override(staff, v_held, 'deny', null, null, null, 'Paused during review');
  select array_agg(permission_key || '|' || program_key || '|' || coalesce(scope, '-') order by permission_key || '|' || program_key || '|' || coalesce(scope, '-')) into actual_set
  from public.user_permissions(staff);
  if preview_set is distinct from actual_set then
    raise exception 'FAIL: the deny preview differs from the saved result';
  end if;
  if v_held = any (select permission_key from public.user_permissions(staff)) then
    raise exception 'FAIL: the deny override did not take effect (%)', v_held;
  end if;

  msg := null;
  begin perform public.admin_revoke_override(v_deny, ''); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: override revoked without a reason'; end if;
  perform public.admin_revoke_override(v_deny, 'Review finished');
  reset role;
  if not exists (select 1 from public.user_effective_permissions where user_id = staff and permission_key = v_held) then
    raise exception 'FAIL: revoking the deny did not restore %', v_held;
  end if;
  if not exists (select 1 from public.audit_events where table_name = 'user_permission_overrides' and record_id = v_override::text
                 and reason = 'Covering for a colleague' and new_values is not null) then
    raise exception 'FAIL: the override was not audited with its reason';
  end if;

  -- ---------------- an assigner who isn't a System Administrator ----------------
  set local role authenticated;
  v_role := public.admin_create_role('P5 check assigner', '');
  perform public.admin_set_role_permissions(v_role,
    '[{"key": "admin.view"}, {"key": "admin.users.view"}, {"key": "admin.permissions.assign"}]', 'Test role');
  perform public.admin_assign_role(cm, v_role, null, null, 'testing');
  reset role;
  if not exists (select 1 from public.user_effective_permissions where user_id = cm and permission_key = 'admin.permissions.assign') then
    raise exception 'FAIL: the test assigner did not receive admin.permissions.assign';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform public.admin_add_override(staff, 'admin.users.view', 'grant', null, null, null, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a non-System-Administrator granted an administration permission'; end if;
  -- something the assigner doesn't hold
  select p.key into s from public.permissions p
  where p.sensitivity = 'normal' and not p.scoped
    and not exists (select 1 from public.user_effective_permissions e where e.user_id = cm and e.permission_key = p.key)
  order by p.key limit 1;
  if s is not null then
    msg := null;
    begin perform public.admin_add_override(staff, s, 'grant', null, null, null, 'testing'); exception when others then msg := sqlerrm; end;
    if msg is null then raise exception 'FAIL: an assigner granted a permission they do not hold (%)', s; end if;
  end if;
  msg := null;
  begin perform public.admin_add_override(admin, v_held, 'deny', null, null, null, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a non-System-Administrator changed an administrator''s access'; end if;
  msg := null;
  begin perform public.admin_add_override(cm, v_held, 'grant', null, null, null, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an assigner changed their own access'; end if;
  reset role;

  -- ---------------- an administrator: roles ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform public.admin_set_role_permissions((select id from public.roles where key = 'system_administrator'), '[]', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: the protected System Administrator role was edited'; end if;
  msg := null;
  begin perform public.admin_set_role_permissions((select id from public.roles where key = 'legacy_staff'), '[]', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a legacy role was edited'; end if;

  v_role2 := public.admin_create_role('P5 check role', '');
  perform public.admin_assign_role(staff, v_role2, null, null, 'testing');
  -- Give the role the test permission (and its program's .view); preview, then save.
  s := jsonb_build_array(jsonb_build_object('key', v_perm, 'scope', case when v_scoped then 'program' end))::text;
  -- the override above already grants v_perm at org scope; drop it so the role edit shows
  perform public.admin_revoke_override(v_override, 'Test cleanup');
  select array_agg(user_id::text || '|' || permission_key || '|' || program_key || '|' || coalesce(after_scope, '-') || '|' || change order by user_id::text || '|' || permission_key || '|' || program_key || '|' || coalesce(after_scope, '-') || '|' || change)
    into preview_set from public.preview_role_permissions(v_role2, s::jsonb);
  reset role;
  create temp table p5_before on commit drop as
    select user_id, permission_key, program_key, scope from public.user_effective_permissions where user_id = staff;
  set local role authenticated;
  n := public.admin_set_role_permissions(v_role2, s::jsonb, 'Give the test permission');
  reset role;
  if n <> 1 then raise exception 'FAIL: expected 1 person affected, got %', n; end if;
  select array_agg(x order by x) into actual_set from (
    select coalesce(a.user_id, b.user_id)::text || '|' || coalesce(a.permission_key, b.permission_key) || '|' || coalesce(a.program_key, b.program_key)
           || '|' || coalesce(a.scope, '-') || '|' ||
           case when b.permission_key is null then 'added' when a.permission_key is null then 'removed' else 'scope_changed' end as x
    from (select * from public.user_effective_permissions where user_id = staff) a
    full join p5_before b on a.user_id = b.user_id and a.permission_key = b.permission_key and a.program_key = b.program_key
    where b.permission_key is null or a.permission_key is null or a.scope is distinct from b.scope
  ) d;
  if preview_set is distinct from actual_set then
    raise exception 'FAIL: the role preview (%) differs from the saved result (%)', preview_set, actual_set;
  end if;
  if preview_set is null then
    raise exception 'FAIL: the role edit changed nobody''s access (%)', v_perm;
  end if;
  if not exists (select 1 from public.audit_events where table_name = 'role_permissions' and reason = 'Give the test permission') then
    raise exception 'FAIL: the role edit was not audited with its reason';
  end if;

  -- ---------------- an administrator: modules ----------------
  set local role authenticated;
  msg := null;
  begin perform public.admin_set_module_active('admin.users', false, 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: Administration was switched off'; end if;
  msg := null;
  begin perform public.admin_set_module_active('food_distribution', false, ''); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a module was switched off without a reason'; end if;
  perform public.admin_set_module_active('food_distribution', false, 'Seasonal pause');
  reset role;
  if exists (select 1 from public.user_effective_permissions where permission_key like 'food_distribution.%') then
    raise exception 'FAIL: switching Food Distribution off left its permissions in place';
  end if;
  set local role authenticated;
  perform public.admin_set_module_active('food_distribution', true, 'Back on');
  reset role;
  if not exists (select 1 from public.user_effective_permissions where user_id = admin and permission_key like 'food_distribution.%') then
    raise exception 'FAIL: switching Food Distribution back on did not restore it';
  end if;

  -- ---------------- an administrator: settings ----------------
  set local role authenticated;
  msg := null;
  begin perform public.admin_set_setting('closing_time', '"25:00"', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an invalid closing time was saved'; end if;
  msg := null;
  begin perform public.admin_set_setting('anything_else', '"x"', 'testing'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: an unknown setting was saved'; end if;
  perform public.admin_set_setting('closing_time', '"18:30"', 'Longer hours');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if (select value #>> '{}' from public.app_settings where key = 'closing_time') is distinct from '18:30' then
    raise exception 'FAIL: staff cannot read the closing time';
  end if;
  reset role;
  if not exists (select 1 from public.audit_events where table_name = 'app_settings' and reason = 'Longer hours') then
    raise exception 'FAIL: the setting change was not audited';
  end if;

  raise exception 'P5_CHECKS_PASSED tested % (grant), % (deny); previews matched the saved state', v_perm, v_held;
end;
$$;
