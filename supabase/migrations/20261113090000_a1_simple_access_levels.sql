-- a1_simple_access_levels: one choice per program instead of five tabs.
--
-- An admin sets, for each program, No access / Staff / Manager, plus two
-- switches (Front desk, Administrator). This migration adds what that needs
-- on top of the p1b access model. It changes nobody's access by itself:
--
--   1. Four built-in roles the levels hand out: Program Staff and Program
--      Manager (assigned once per program, so their program permissions only
--      count in that program), Front Desk, and Organization Tools (the
--      org-wide extras an administrator had besides the admin pages).
--   2. profiles.access_mode. 'account_type' (everyone today) keeps the
--      legacy sync exactly as it is. 'levels' stops the account type from
--      handing out roles and programs; access then comes from the levels.
--      SNAP and Staff Reports keep using program_staff in both modes, since
--      each has its own staff page.
--   3. admin_set_access_levels(): saves a person's levels in one step and
--      switches them to 'levels'. admin_use_account_type() switches back.
--      Both are for System Administrators only, never on yourself.
--   4. start_new_session() also accepts the students.sessions.manage
--      permission, so a Students Manager whose account type isn't case
--      manager or job developer can start a session.
--
-- In 'levels' mode the account type is kept in step automatically (it still
-- decides a few things: who counts as an administrator for the older checks,
-- and who can be booked for appointments):
--   Administrator on        -> administrator
--   Case Management level   -> case_manager
--   Workforce level         -> job_developer
--   any other program level -> staff
--   Front desk only         -> receptionist
--
-- Down (only if no one has been switched to 'levels', or after switching
-- them back with admin_use_account_type):
--   drop function public.admin_set_access_levels(uuid, jsonb, boolean, boolean, text);
--   drop function public.admin_use_account_type(uuid, text);
--   drop function public.access_levels_account_type(jsonb, boolean, boolean);
--   drop trigger profiles_guard_access_mode on public.profiles;
--   drop function public.guard_access_mode();
--   restore sync_legacy_access() and sync_legacy_access_trigger() from
--   p3a / p1b, start_new_session() from phase3_lock_down_functions,
--   and the profiles_sync_legacy_access trigger from p1b;
--   alter table public.profiles drop column access_mode, drop column account_type_before_levels;
--   archive the four roles (roles are archived, not deleted).

-- ======================================================================
-- 1. Built-in roles for the levels
-- ======================================================================
insert into public.roles (key, name, description, kind, protected, created_by) values
  ('program_staff', 'Program Staff',
   'Day-to-day work in the programs it is given for: view, add and update records. Used by the Staff access level.', 'builtin', false, null),
  ('program_manager', 'Program Manager',
   'Everything Program Staff can do, plus deleting, exporting, reports and program settings. Used by the Manager access level.', 'builtin', false, null),
  ('front_desk', 'Front Desk',
   'Check visitors in and out and print the check-in QR code. Used by the Front desk switch.', 'builtin', false, null),
  ('organization_tools', 'Organization Tools',
   'Organization-wide tools for administrators: newsletters, announcements, message templates, every calendar event, merging client records, reading private notes, the staff report schedule and SNAP staff settings. Used by the Administrator switch.', 'builtin', false, null)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, v.permission_key, v.scope
from (values
  -- ---------- Program Staff ----------
  -- Shared: what every program worker already has under the account types.
  ('program_staff', 'dashboard.view', null), ('program_staff', 'my_caseload.view', null),
  ('program_staff', 'calendar.view', null), ('program_staff', 'calendar.events.create', null),
  ('program_staff', 'staff_reports.submit', null), ('program_staff', 'org_reports.view', null),
  ('program_staff', 'communications.view', null), ('program_staff', 'communications.messages.send', null),
  ('program_staff', 'communications.announcements.view', null),
  ('program_staff', 'front_desk.checkout', null), ('program_staff', 'front_desk.visits.search', null),
  ('program_staff', 'participants.view', 'org'), ('program_staff', 'participants.edit', 'org'),
  ('program_staff', 'participants.notes.view', 'org'), ('program_staff', 'participants.notes.create', 'org'),
  ('program_staff', 'participants.documents.view', 'org'), ('program_staff', 'participants.documents.manage', 'org'),
  -- Workforce
  ('program_staff', 'workforce.view', null), ('program_staff', 'workforce.overview.view', null),
  ('program_staff', 'workforce.participants.view', 'program'), ('program_staff', 'workforce.participants.create', 'program'),
  ('program_staff', 'workforce.participants.edit', 'program'),
  ('program_staff', 'workforce.jobs.view', null), ('program_staff', 'workforce.jobs.create', null),
  ('program_staff', 'workforce.jobs.edit', null),
  ('program_staff', 'workforce.employers.view', null), ('program_staff', 'workforce.employers.create', null),
  ('program_staff', 'workforce.employers.edit', null),
  ('program_staff', 'workforce.matching.view', null),
  ('program_staff', 'workforce.referrals.view', 'program'), ('program_staff', 'workforce.referrals.create', 'program'),
  ('program_staff', 'workforce.referrals.edit', 'program'),
  ('program_staff', 'workforce.placements.view', 'program'), ('program_staff', 'workforce.placements.create', 'program'),
  ('program_staff', 'workforce.placements.edit', 'program'),
  -- Students
  ('program_staff', 'students.view', 'program'), ('program_staff', 'students.create', 'program'),
  ('program_staff', 'students.edit', 'program'),
  ('program_staff', 'students.classes.view', null),
  ('program_staff', 'students.attendance.view', 'program'), ('program_staff', 'students.attendance.manage', 'program'),
  ('program_staff', 'students.assessments.view', 'program'), ('program_staff', 'students.assessments.create', 'program'),
  ('program_staff', 'students.assessments.administer', 'program'), ('program_staff', 'students.assessments.grade', 'program'),
  -- Case Management
  ('program_staff', 'case_management.view', 'program'), ('program_staff', 'case_management.clients.create', 'program'),
  ('program_staff', 'case_management.clients.edit', 'program'),
  ('program_staff', 'case_management.notes.view', 'program'), ('program_staff', 'case_management.notes.create', 'program'),
  ('program_staff', 'case_management.intake.view', 'program'), ('program_staff', 'case_management.intake.edit', 'program'),
  ('program_staff', 'case_management.documents.view', 'program'), ('program_staff', 'case_management.documents.upload', 'program'),
  ('program_staff', 'case_management.appointments.view', 'program'), ('program_staff', 'case_management.appointments.manage', 'program'),
  -- Food Distribution
  ('program_staff', 'food_distribution.view', 'program'), ('program_staff', 'food_distribution.clients.create', 'program'),
  ('program_staff', 'food_distribution.clients.edit', 'program'), ('program_staff', 'food_distribution.distributions.record', 'program'),

  -- ---------- Program Manager: Program Staff plus the rows below ----------
  ('program_manager', 'lists.manage', null), ('program_manager', 'org_reports.export', null),
  ('program_manager', 'front_desk.qrcode', null),
  ('program_manager', 'participants.demographics.view', 'org'),
  ('program_manager', 'workforce.participants.delete', 'program'), ('program_manager', 'workforce.participants.export', 'program'),
  ('program_manager', 'workforce.jobs.delete', null), ('program_manager', 'workforce.employers.delete', null),
  ('program_manager', 'workforce.reports.view', null), ('program_manager', 'workforce.reports.export', null),
  ('program_manager', 'workforce.settings.manage', null),
  ('program_manager', 'students.delete', 'program'), ('program_manager', 'students.export', 'program'),
  ('program_manager', 'students.classes.manage', null), ('program_manager', 'students.sessions.manage', null),
  ('program_manager', 'students.assessments.manage', null),
  ('program_manager', 'case_management.clients.delete', 'program'), ('program_manager', 'case_management.clients.export', 'program'),
  ('program_manager', 'case_management.documents.delete', 'program'), ('program_manager', 'case_management.reports.view', null),
  ('program_manager', 'food_distribution.reports.view', null),

  -- ---------- Front Desk ----------
  ('front_desk', 'front_desk.checkin', null), ('front_desk', 'front_desk.checkout', null),
  ('front_desk', 'front_desk.qrcode', null),
  ('front_desk', 'calendar.view', null), ('front_desk', 'calendar.events.create', null),
  ('front_desk', 'staff_reports.submit', null), ('front_desk', 'communications.announcements.view', null),

  -- ---------- Organization Tools ----------
  ('organization_tools', 'dashboard.view', null), ('organization_tools', 'calendar.view', null),
  ('organization_tools', 'calendar.events.create', null), ('organization_tools', 'calendar.events.manage_all', null),
  ('organization_tools', 'staff_reports.submit', null), ('organization_tools', 'staff_reports.schedule.manage', null),
  ('organization_tools', 'org_reports.view', null), ('organization_tools', 'org_reports.export', null),
  ('organization_tools', 'lists.manage', null),
  ('organization_tools', 'communications.view', null), ('organization_tools', 'communications.messages.send', null),
  ('organization_tools', 'communications.announcements.view', null), ('organization_tools', 'communications.announcements.post', null),
  ('organization_tools', 'communications.templates.manage', null), ('organization_tools', 'communications.newsletters.send', null),
  ('organization_tools', 'participants.merge', null), ('organization_tools', 'participants.notes.view_private', 'org'),
  ('organization_tools', 'front_desk.visits.edit', null), ('organization_tools', 'front_desk.visits.search', null),
  ('organization_tools', 'snap.staff.manage', null), ('organization_tools', 'snap.settings.manage', null)
) as v(role_key, permission_key, scope)
join public.roles r on r.key = v.role_key
on conflict do nothing;

-- Program Manager includes every Program Staff permission.
insert into public.role_permissions (role_id, permission_key, scope)
select m.id, rp.permission_key, rp.scope
from public.role_permissions rp
join public.roles s on s.id = rp.role_id and s.key = 'program_staff'
cross join public.roles m
where m.key = 'program_manager'
on conflict do nothing;

-- ======================================================================
-- 2. Access mode
-- ======================================================================
alter table public.profiles
  add column access_mode text not null default 'account_type'
  check (access_mode in ('account_type', 'levels')),
  add column account_type_before_levels text;

comment on column public.profiles.access_mode is
  'account_type: roles and programs follow profiles.role (legacy sync). levels: they come from the access levels an admin set (admin_set_access_levels).';
comment on column public.profiles.account_type_before_levels is
  'The account type a person had when switched to levels (which then keep profiles.role in step). admin_use_account_type() puts it back.';

-- Only the level functions below (which run as their owner) change it,
-- never the app directly: switching yourself back to account_type could
-- restore access an admin took away.
create or replace function public.guard_access_mode()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (new.access_mode is distinct from old.access_mode
      or new.account_type_before_levels is distinct from old.account_type_before_levels)
     and current_user = 'authenticated' then
    raise exception 'access mode is changed through the access levels' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_access_mode() from public, anon;

create trigger profiles_guard_access_mode before update of access_mode, account_type_before_levels on public.profiles
  for each row execute function public.guard_access_mode();

-- sync_legacy_access() as in p3a, except that in 'levels' mode the account
-- type and the Workforce setting add nothing. SNAP and Staff Reports roles
-- still follow program_staff.
create or replace function public.sync_legacy_access(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_mode text;
  want_roles jsonb := '[]'::jsonb;   -- [{role, program}]
  want_programs text[] := '{}';
begin
  select role, access_mode into v_role, v_mode from public.profiles where id = p_user;
  if v_role is null then return; end if;

  if v_mode = 'account_type' then
    want_roles := want_roles || jsonb_build_object('role', 'legacy_' || v_role, 'program', null);
    want_programs := public.legacy_role_programs(v_role);

    if v_role <> 'administrator' and exists (
      select 1 from public.workforce_role_access w where w.role = v_role and w.enabled
    ) then
      want_roles := want_roles || jsonb_build_object('role', 'legacy_workforce_access', 'program', null);
      want_programs := want_programs || array['workforce'];
    end if;
  end if;

  -- Outreach program roles, per program.
  select want_roles || coalesce(jsonb_agg(jsonb_build_object('role', 'legacy_outreach_' || ps.program_role, 'program', m.key)), '[]'::jsonb),
         want_programs || coalesce(array_agg(m.key), '{}')
    into want_roles, want_programs
  from public.program_staff ps
  join public.app_modules m on m.outreach_program = ps.program
  where ps.user_id = p_user and ps.active;

  -- Staff Reports roles (organization-wide).
  select want_roles || coalesce(jsonb_agg(jsonb_build_object('role', 'legacy_report_' || ps.program_role, 'program', null)), '[]'::jsonb)
    into want_roles
  from public.program_staff ps
  where ps.user_id = p_user and ps.active and ps.program = 'staff_reports';

  -- Roles: revoke legacy rows no longer wanted, add missing ones.
  update public.user_roles ur set revoked_at = now(), revoked_by = auth.uid()
  where ur.user_id = p_user and ur.source = 'legacy_sync' and ur.revoked_at is null
    and not exists (
      select 1 from jsonb_array_elements(want_roles) w join public.roles r on r.key = w->>'role'
      where r.id = ur.role_id and coalesce(w->>'program', '') = coalesce(ur.program_key, '')
    );
  insert into public.user_roles (user_id, role_id, program_key, source, granted_by)
  select distinct p_user, r.id, w->>'program', 'legacy_sync', auth.uid()
  from jsonb_array_elements(want_roles) w
  join public.roles r on r.key = w->>'role'
  where not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user and ur.role_id = r.id and ur.revoked_at is null
      and coalesce(ur.program_key, '') = coalesce(w->>'program', '')
  );

  -- Program access: same idea, one row per (user, program).
  update public.user_program_access upa set revoked_at = now(), revoked_by = auth.uid()
  where upa.user_id = p_user and upa.source = 'legacy_sync' and upa.revoked_at is null
    and not (upa.program_key = any (want_programs));
  insert into public.user_program_access (user_id, program_key, source, granted_by)
  select distinct p_user, k, 'legacy_sync', auth.uid() from unnest(want_programs) k
  on conflict (user_id, program_key) do update
    set revoked_at = null, revoked_by = null, granted_at = now(), granted_by = excluded.granted_by,
        source = 'legacy_sync'
    where user_program_access.revoked_at is not null;
end;
$$;
revoke all on function public.sync_legacy_access(uuid) from public, anon, authenticated;

-- The profiles trigger also fires on a change of access_mode.
drop trigger profiles_sync_legacy_access on public.profiles;
create trigger profiles_sync_legacy_access after insert or update of role, active, access_mode on public.profiles
  for each row execute function public.sync_legacy_access_trigger();

-- ======================================================================
-- 3. Saving levels
-- ======================================================================
-- The account type that matches a set of levels (see the header).
create or replace function public.access_levels_account_type(p_levels jsonb, p_front_desk boolean, p_admin boolean)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_admin then 'administrator'
    when coalesce(p_levels->>'case_management', 'none') <> 'none' then 'case_manager'
    when coalesce(p_levels->>'workforce', 'none') <> 'none' then 'job_developer'
    when exists (select 1 from jsonb_each_text(coalesce(p_levels, '{}'::jsonb)) l where l.value <> 'none') then 'staff'
    when p_front_desk then 'receptionist'
    else 'staff'
  end;
$$;
revoke all on function public.access_levels_account_type(jsonb, boolean, boolean) from public, anon;
grant execute on function public.access_levels_account_type(jsonb, boolean, boolean) to authenticated;

-- p_levels: {"workforce": "none" | "staff" | "manager", "snap": ..., "students": ...,
--            "case_management": ..., "food_distribution": ...}; a program left
-- out keeps its current level only if it has one through SNAP's own staff
-- page, otherwise it counts as "none".
--
-- Runs with the definer's rights so one call can touch profiles, roles,
-- program access and program_staff together; the checks below stand in for
-- the row-level ones. Every row change still goes to the audit log with the
-- reason, through each table's audit trigger.
create or replace function public.admin_set_access_levels(
  p_user uuid, p_levels jsonb, p_front_desk boolean, p_admin boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  prog text;
  lvl text;
  want_role text;
  v_staff uuid;
  v_manager uuid;
  v_front uuid;
  v_sysadmin uuid;
  v_orgtools uuid;
  v_snap_role text;
begin
  if me is null or not public.is_system_admin(me) or not public.has_permission('admin.permissions.assign') then
    raise exception 'only a System Administrator can set access levels' using errcode = '42501';
  end if;
  if p_user = me then
    raise exception 'you cannot change your own access' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such account' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from jsonb_each_text(coalesce(p_levels, '{}'::jsonb)) l
    where l.value not in ('none', 'staff', 'manager')
       or l.key not in (select key from public.app_modules where kind = 'program')
  ) then
    raise exception 'unknown program or access level' using errcode = '22023';
  end if;

  select id into v_staff from public.roles where key = 'program_staff';
  select id into v_manager from public.roles where key = 'program_manager';
  select id into v_front from public.roles where key = 'front_desk';
  select id into v_sysadmin from public.roles where key = 'system_administrator';
  select id into v_orgtools from public.roles where key = 'organization_tools';

  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);

  -- Switch to levels and keep the account type in step. The sync trigger
  -- then takes away what the account type gave.
  update public.profiles
    set account_type_before_levels = case when access_mode = 'account_type' then role else account_type_before_levels end,
        access_mode = 'levels',
        role = public.access_levels_account_type(p_levels, coalesce(p_front_desk, false), coalesce(p_admin, false))
  where id = p_user;

  -- Programs other than SNAP: program access + one Staff or Manager role.
  for prog in select key from public.app_modules where kind = 'program' and outreach_program is null loop
    lvl := coalesce(p_levels->>prog, 'none');
    want_role := case lvl when 'staff' then 'program_staff' when 'manager' then 'program_manager' end;

    update public.user_roles set revoked_at = now(), revoked_by = me
    where user_id = p_user and program_key = prog and revoked_at is null
      and role_id in (v_staff, v_manager)
      and (want_role is null or role_id <> (select id from public.roles where key = want_role));

    if want_role is null then
      update public.user_program_access set revoked_at = now(), revoked_by = me
      where user_id = p_user and program_key = prog and revoked_at is null;
    else
      insert into public.user_program_access (user_id, program_key, source, granted_by)
      values (p_user, prog, 'admin', me)
      on conflict (user_id, program_key) do update
        set revoked_at = null, revoked_by = null, source = 'admin', granted_by = me, granted_at = now()
        where user_program_access.revoked_at is not null or user_program_access.source <> 'admin';

      insert into public.user_roles (user_id, role_id, program_key, source, granted_by)
      select p_user, r.id, prog, 'admin', me from public.roles r
      where r.key = want_role
        and not exists (
          select 1 from public.user_roles ur
          where ur.user_id = p_user and ur.role_id = r.id and ur.program_key = prog and ur.revoked_at is null
        );
    end if;
  end loop;

  -- SNAP (and any other Outreach program): the level is the program_staff
  -- row its own staff page also edits. Staff = worker, Manager = supervisor;
  -- an existing program admin stays program admin.
  for prog, v_snap_role in
    select m.outreach_program, ps.program_role
    from public.app_modules m
    left join public.program_staff ps on ps.program = m.outreach_program and ps.user_id = p_user
    where m.kind = 'program' and m.outreach_program is not null
      and p_levels ? m.key
  loop
    lvl := p_levels->>(select key from public.app_modules where outreach_program = prog and kind = 'program');
    if lvl = 'none' then
      update public.program_staff set active = false where user_id = p_user and program = prog and active;
    else
      want_role := case
        when lvl = 'staff' then 'worker'
        when v_snap_role = 'program_admin' then 'program_admin'
        else 'supervisor'
      end;
      insert into public.program_staff (user_id, program, program_role, active, granted_by)
      values (p_user, prog, want_role, true, me)
      on conflict (user_id, program) do update
        set program_role = excluded.program_role, active = true, granted_by = me
        where program_staff.program_role <> excluded.program_role or not program_staff.active;
    end if;
  end loop;

  -- An administrator manages each Outreach program's staff and settings
  -- (snap.staff.manage), which only counts with access to the program --
  -- without being given its case data. So Administrator opens the program
  -- even at "No access"; the access an admin gave goes when it's turned off
  -- and the program's level is "none" (program_staff's own access is
  -- separate and stays with the sync).
  for prog in select key from public.app_modules where kind = 'program' and outreach_program is not null loop
    if coalesce(p_admin, false) then
      insert into public.user_program_access (user_id, program_key, source, granted_by)
      values (p_user, prog, 'admin', me)
      on conflict (user_id, program_key) do update
        set revoked_at = null, revoked_by = null, source = 'admin', granted_by = me, granted_at = now()
        where user_program_access.revoked_at is not null or user_program_access.source <> 'admin';
    elsif coalesce(p_levels->>prog, 'none') = 'none' then
      update public.user_program_access set revoked_at = now(), revoked_by = me
      where user_id = p_user and program_key = prog and revoked_at is null and source = 'admin';
    end if;
  end loop;

  -- Front desk and Administrator (organization-wide roles).
  if coalesce(p_front_desk, false) then
    insert into public.user_roles (user_id, role_id, program_key, source, granted_by)
    select p_user, v_front, null, 'admin', me
    where not exists (select 1 from public.user_roles where user_id = p_user and role_id = v_front and program_key is null and revoked_at is null);
  else
    update public.user_roles set revoked_at = now(), revoked_by = me
    where user_id = p_user and role_id = v_front and revoked_at is null;
  end if;

  if coalesce(p_admin, false) then
    insert into public.user_roles (user_id, role_id, program_key, source, granted_by)
    select p_user, x.id, null, 'admin', me from (values (v_sysadmin), (v_orgtools)) as x(id)
    where not exists (select 1 from public.user_roles where user_id = p_user and role_id = x.id and program_key is null and revoked_at is null);
  else
    update public.user_roles set revoked_at = now(), revoked_by = me
    where user_id = p_user and role_id in (v_sysadmin, v_orgtools) and revoked_at is null;
  end if;

  perform public.refresh_effective_permissions(p_user);
end;
$$;
revoke all on function public.admin_set_access_levels(uuid, jsonb, boolean, boolean, text) from public, anon;
grant execute on function public.admin_set_access_levels(uuid, jsonb, boolean, boolean, text) to authenticated;

-- Back to the account type: the account type they had before the switch
-- comes back with its own roles and programs. What the levels gave goes:
-- the level roles, and program access an admin gave (while on levels, all of
-- it is the levels'; any given before the switch was taken over then).
create or replace function public.admin_use_account_type(p_user uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.is_system_admin(me) or not public.has_permission('admin.permissions.assign') then
    raise exception 'only a System Administrator can set access levels' using errcode = '42501';
  end if;
  if p_user = me then
    raise exception 'you cannot change your own access' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and access_mode = 'levels') then
    return;
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.user_roles ur set revoked_at = now(), revoked_by = me
  from public.roles r
  where r.id = ur.role_id and ur.user_id = p_user and ur.revoked_at is null and ur.source = 'admin'
    and r.key in ('program_staff', 'program_manager', 'front_desk', 'organization_tools', 'system_administrator');
  update public.user_program_access set revoked_at = now(), revoked_by = me
  where user_id = p_user and revoked_at is null and source = 'admin';
  -- The sync trigger then restores the account type's roles and programs.
  update public.profiles
    set access_mode = 'account_type',
        role = coalesce(account_type_before_levels, role),
        account_type_before_levels = null
  where id = p_user;
  perform public.refresh_effective_permissions(p_user);
end;
$$;
revoke all on function public.admin_use_account_type(uuid, text) from public, anon;
grant execute on function public.admin_use_account_type(uuid, text) to authenticated;

-- ======================================================================
-- 4. Starting a new Students session
-- ======================================================================
create or replace function public.start_new_session(new_start date, new_end date)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.sessions;
begin
  if not (has_role(array['administrator','case_manager','job_developer'])
          or public.has_permission('students.sessions.manage', 'students')) then
    raise exception 'not authorized';
  end if;

  update public.sessions set is_current = false where is_current = true;

  insert into public.sessions (start_date, end_date, is_current)
  values (new_start, new_end, true)
  returning * into new_row;

  update public.students set class_key = null where class_key is not null and active = true;

  return new_row;
end;
$$;
