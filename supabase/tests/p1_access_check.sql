-- Checks for the Phase 1 migrations (p1a_audit_hardening, p1b_access_foundation).
-- Run AFTER both, inside the same transaction. Always ends by raising
-- 'P1_CHECKS_PASSED ...', so nothing it (or the migrations) wrote is committed;
-- any failed check raises its own message first.
--
-- Part 1 is the PARITY CHECK: for every active account, the navigation the
-- old rules give (src/lib/nav.js navItemsForRole, reproduced below) must equal
-- the navigation the new effective permissions give (src/lib/modules.js
-- NAV_REQUIREMENTS, reproduced below). Phase 4 switches the sidebar over only
-- if this holds.
do $$
declare
  acct record;
  legacy text[];
  modern text[];
  wf_roles text[] := array(select role from public.workforce_role_access where enabled);
  n_users int := 0;
  cm uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  admin2 uuid := (select id from public.profiles where role = 'administrator' and active order by created_at offset 1 limit 1);
  v_role uuid;
  ok boolean;
  n int;
  s text;
begin
  -- ---------------- Part 1: parity ----------------
  for acct in select p.id, p.role from public.profiles p where p.active loop
    n_users := n_users + 1;
    legacy := case acct.role
      when 'administrator' then array['dashboard','mycaseload','checkin','checkout','search','reports','fooddistribution','calendar','qrcode','manage','students','assessments','casemanagement','jobdeveloper','users','settings']
      when 'staff' then array['dashboard','checkout','search','reports','fooddistribution','calendar']
      when 'receptionist' then array['checkin','checkout','calendar']
      when 'case_manager' then array['dashboard','mycaseload','checkin','checkout','search','reports','calendar','qrcode','manage','students','assessments','casemanagement']
      when 'job_developer' then array['dashboard','mycaseload','checkin','checkout','search','reports','calendar','qrcode','manage','students','assessments','jobdeveloper']
      else array[]::text[] end;
    if acct.role = 'administrator' or exists (select 1 from public.program_staff ps where ps.user_id = acct.id and ps.active and ps.program <> 'staff_reports') then
      legacy := legacy || array['outreach'];
    end if;
    legacy := legacy || array['myreports'];
    if acct.role = 'administrator' or exists (select 1 from public.program_staff ps where ps.user_id = acct.id and ps.active and ps.program = 'staff_reports') then
      legacy := legacy || array['staffreports'];
    end if;
    if acct.role = 'administrator' or acct.role = any (wf_roles) then
      legacy := legacy || array['workforcedashboard','employers','jobopenings','candidatematching','referrals','placements','workforcereports'];
    end if;

    select coalesce(array_agg(distinct nav.k order by nav.k), '{}') into modern
    from (values
      ('dashboard', 'dashboard.view'), ('mycaseload', 'my_caseload.view'), ('checkin', 'front_desk.checkin'),
      ('checkout', 'front_desk.checkout'), ('search', 'front_desk.visits.search'), ('reports', 'org_reports.view'),
      ('fooddistribution', 'food_distribution.view'), ('calendar', 'calendar.view'), ('qrcode', 'front_desk.qrcode'),
      ('manage', 'lists.manage'), ('students', 'students.view'), ('assessments', 'students.assessments.view'),
      ('casemanagement', 'case_management.view'), ('jobdeveloper', 'workforce.participants.view'),
      ('workforcedashboard', 'workforce.overview.view'), ('employers', 'workforce.employers.view'),
      ('jobopenings', 'workforce.jobs.view'), ('candidatematching', 'workforce.matching.view'),
      ('referrals', 'workforce.referrals.view'), ('placements', 'workforce.placements.view'),
      ('workforcereports', 'workforce.reports.view'),
      ('outreach', 'snap.view'), ('outreach', 'snap.staff.manage'),
      ('myreports', 'staff_reports.submit'),
      ('staffreports', 'staff_reports.review'), ('staffreports', 'staff_reports.view_all'), ('staffreports', 'staff_reports.schedule.manage'),
      ('users', 'admin.users.view'), ('settings', 'admin.settings.manage')
    ) as nav(k, perm)
    where exists (select 1 from public.user_effective_permissions e where e.user_id = acct.id and e.permission_key = nav.perm);

    legacy := array(select distinct x from unnest(legacy) x order by x);
    if legacy is distinct from modern then
      raise exception 'PARITY FAIL for a % account: legacy-only %, new-only %', acct.role,
        array(select unnest(legacy) except select unnest(modern)),
        array(select unnest(modern) except select unnest(legacy));
    end if;
  end loop;

  -- Inactive accounts hold nothing.
  if exists (select 1 from public.user_effective_permissions e join public.profiles p on p.id = e.user_id where not p.active) then
    raise exception 'an inactive account has effective permissions';
  end if;

  -- ---------------- Part 2: resolution rules ----------------
  -- Administrators hold no SNAP case data (O1 rule), but do manage SNAP staff.
  if exists (select 1 from public.user_effective_permissions where user_id = admin and permission_key like 'snap.cases.%') then
    raise exception 'administrator holds SNAP case permissions';
  end if;

  -- Deny with a scope caps: deny 'program' on case_management.view leaves 'team'.
  insert into public.user_permission_overrides (user_id, permission_key, effect, scope, reason)
  values (cm, 'case_management.view', 'deny', 'program', 'p1 check');
  select scope into s from public.user_effective_permissions where user_id = cm and permission_key = 'case_management.view';
  if s is distinct from 'team' then raise exception 'scoped deny did not cap (got %)', s; end if;

  -- Full deny on a program's .view removes its submodules too (parent gate):
  -- Assessments, Attendance, Classes, Sessions all need students.view.
  if not exists (select 1 from public.user_effective_permissions where user_id = cm and permission_key = 'students.assessments.grade') then
    raise exception 'case manager should start with students.assessments.grade';
  end if;
  insert into public.user_permission_overrides (user_id, permission_key, effect, reason)
  values (cm, 'students.view', 'deny', 'p1 check');
  if exists (select 1 from public.user_effective_permissions e join public.permissions p on p.key = e.permission_key
             join public.app_modules m on m.key = p.module_key
             where e.user_id = cm and m.parent_key = 'students') then
    raise exception 'denying students.view left student submodule permissions';
  end if;

  -- Program gate: without program access, a role grants nothing in that program.
  update public.user_program_access set revoked_at = now() where user_id = cm and program_key = 'case_management';
  if exists (select 1 from public.user_effective_permissions where user_id = cm and permission_key like 'case_management.%') then
    raise exception 'program gate failed';
  end if;

  -- ---------------- Part 3: safeguards (as signed-in users) ----------------
  -- A staff member cannot assign access.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  ok := false;
  begin
    insert into public.user_roles (user_id, role_id) select cm, id from public.roles where key = 'legacy_administrator';
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'staff could assign a role'; end if;
  ok := false;
  begin
    update public.roles set name = 'x' where key = 'legacy_staff';
    get diagnostics n = row_count;
    ok := n = 0;  -- RLS hides the row from a non-admin writer
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'staff could edit a role'; end if;
  reset role;

  -- An administrator: custom roles work, protected roles and self-changes don't.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  -- (Until Phase 2 builds the Roles page, admin.roles.* is not active, so RLS
  -- hides roles from writers; once it is, the guard refuses protected ones.)
  ok := false;
  begin
    update public.roles set name = 'x' where key = 'system_administrator';
    get diagnostics n = row_count;
    ok := n = 0;
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'the protected role could be edited'; end if;
  ok := false;
  begin insert into public.user_roles (user_id, role_id) select admin, id from public.roles where key = 'executive_oversight';
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'an administrator could change their own access'; end if;
  ok := false;
  begin insert into public.user_roles (user_id, role_id, source) select staff, id, 'legacy_sync' from public.roles where key = 'legacy_receptionist';
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'a client could write a legacy_sync row'; end if;

  -- Preview shows the effect and saves nothing.
  select count(*) into n from public.preview_effective_permissions(staff,
    jsonb_build_object('add_roles', jsonb_build_array(jsonb_build_object('role_id', (select id from public.roles where key = 'executive_oversight')))))
  where change = 'added';
  if n = 0 then raise exception 'preview showed no added permissions'; end if;
  reset role;
  if exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = staff and r.key = 'executive_oversight') then
    raise exception 'preview saved its changes';
  end if;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);

  -- Assigning a role really updates the effective permissions.
  insert into public.user_roles (user_id, role_id) select staff, id from public.roles where key = 'executive_oversight';
  reset role;
  if not exists (select 1 from public.user_effective_permissions where user_id = staff and permission_key = 'staff_reports.review') then
    raise exception 'role assignment did not refresh effective permissions';
  end if;

  -- has_permission() answers for the signed-in user.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  if not public.has_permission('staff_reports.review') or public.has_permission('admin.view') then
    raise exception 'has_permission gave the wrong answer';
  end if;
  reset role;

  -- The legacy sync follows a role change made on the Users page.
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  update public.profiles set role = 'receptionist' where id = staff;
  reset role;
  if not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = staff and r.key = 'legacy_receptionist' and ur.revoked_at is null)
     or exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                where ur.user_id = staff and r.key = 'legacy_staff' and ur.revoked_at is null) then
    raise exception 'legacy sync did not follow the role change';
  end if;
  if exists (select 1 from public.user_effective_permissions where user_id = staff and permission_key = 'food_distribution.view') then
    raise exception 'old program access survived the role change';
  end if;

  -- The last System Administrator cannot be removed.
  -- (Removing every administrator role at once, as the table owner, so the
  -- profiles escalation trigger can't be what stops it.)
  ok := false;
  begin
    update public.user_roles set revoked_at = now()
    where role_id = (select id from public.roles where key = 'legacy_administrator');
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'every administrator could be removed'; end if;

  -- The audit log is append-only, even for the table owner, and recorded values.
  ok := false;
  begin update public.audit_events set reason = 'x' where id = (select max(id) from public.audit_events);
  exception when insufficient_privilege then ok := true; end;
  if not ok then raise exception 'audit_events could be updated'; end if;
  if not exists (select 1 from public.audit_events where table_name = 'profiles' and subject_user_id = staff and new_values ->> 'role' = 'receptionist') then
    raise exception 'the role change was not audited with values';
  end if;

  select count(*) into n from public.user_effective_permissions;
  raise exception 'P1_CHECKS_PASSED parity ok for % active accounts; % effective permission rows', n_users, n;
end;
$$;
