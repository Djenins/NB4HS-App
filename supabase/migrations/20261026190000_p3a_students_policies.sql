-- Phase 3, part A -- the Students program's tables move from account-role
-- checks to permissions (plans/unified-access-architecture.md §4, §5, §13
-- Phase 3).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026190000), after
-- rolled-back dry runs (parity up and down, program access checks). Afterwards
-- on live: parity in reverse (rollback inside a transaction) found all 1,280
-- answers equal to the old rules, and the p1, p2 and p3a checks passed.
--
-- NOBODY'S ACCESS CHANGES. supabase/tests/p3_policy_parity_*.sql proves it:
-- for every combination of account type, Workforce access and program role,
-- each policy on these tables gives the same answer before and after.
--
-- What changes is what the rules are written in. Before, "is_staff()" or a
-- list of account types; after, permissions -- so once people move off the
-- legacy roles (Phase 5), a custom role can open exactly what it should:
--
--   students             read    students.view, or participants.view
--                        add     students.create, or participants.edit
--                        change  students.edit / attendance / grading, or participants.edit
--                        remove  students.delete, or participants.edit
--   classes              read    everyone, signed in or not (the kiosk lists classes)
--                        write   students.classes.manage, or participants.edit
--   sessions,
--   past_session_students        students.sessions.manage
--
-- Today every staff account can read and edit student and class records
-- (the old policies were is_staff()), including receptionists and staff who
-- never see the Students page: check-in reads the roster, and a client
-- profile can enroll someone as a student. The legacy roles keep exactly
-- that through two participant-record permissions:
--   participants.view  receptionists gain it (every other account type had it)
--   participants.edit  new; every legacy account type gets it
-- Reviewing who really needs them is Phase 5's job (decision D5: mirror first).
--
-- Students records have no owner or assignee column, so the Students
-- permissions count here only at program or organization scope; a role
-- scoped to "own" or "assigned" students opens nothing on these tables yet.
--
-- Also (section 5): grant and remove program access from Administration,
-- and the legacy sync now restores a program an admin removed when the
-- account type still includes it.
--
-- Rollback: supabase/rollback/p3a_students_policies_down.sql restores the
-- old policies verbatim and removes the two grants and participants.edit.

-- ======================================================================
-- 1. Scope helper and the participant-record grants
-- ======================================================================
-- Does the signed-in user hold a scoped permission at this scope or wider?
create or replace function public.has_permission_at(p_key text, p_min_scope text, p_program text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.access_scope_rank(public.permission_scope(p_key, p_program))
         >= greatest(public.access_scope_rank(p_min_scope), 1);
$$;
revoke all on function public.has_permission_at(text, text, text) from public, anon;
grant execute on function public.has_permission_at(text, text, text) to authenticated;

insert into public.permissions (key, module_key, scoped, sensitivity, sort_order, description) values
  ('participants.edit', 'participants', true, 'normal', 4, 'Add, change and remove participant and class records in any program');

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, v.permission_key, 'org'
from (values
  ('legacy_receptionist', 'participants.view'),
  ('legacy_administrator', 'participants.edit'),
  ('legacy_staff', 'participants.edit'),
  ('legacy_receptionist', 'participants.edit'),
  ('legacy_case_manager', 'participants.edit'),
  ('legacy_job_developer', 'participants.edit')
) as v(role_key, permission_key)
join public.roles r on r.key = v.role_key;

-- ======================================================================
-- 2. students
-- ======================================================================
-- (select ...) makes each check an InitPlan: evaluated once per statement,
-- not once per row.
drop policy students_select on public.students;
drop policy students_insert on public.students;
drop policy students_update on public.students;
drop policy students_delete on public.students;

create policy students_select on public.students for select to authenticated
  using ((select public.has_permission_at('students.view', 'program', 'students'))
         or (select public.has_permission_at('participants.view', 'program')));
create policy students_insert on public.students for insert to authenticated
  with check ((select public.has_permission_at('students.create', 'program', 'students'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy students_update on public.students for update to authenticated
  using ((select public.has_permission_at('students.edit', 'program', 'students'))
         or (select public.has_permission_at('students.attendance.manage', 'program', 'students'))
         or (select public.has_permission_at('students.assessments.grade', 'program', 'students'))
         or (select public.has_permission_at('participants.edit', 'program')))
  with check ((select public.has_permission_at('students.edit', 'program', 'students'))
              or (select public.has_permission_at('students.attendance.manage', 'program', 'students'))
              or (select public.has_permission_at('students.assessments.grade', 'program', 'students'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy students_delete on public.students for delete to authenticated
  using ((select public.has_permission_at('students.delete', 'program', 'students'))
         or (select public.has_permission_at('participants.edit', 'program')));

-- ======================================================================
-- 3. classes (classes_select -- everyone, for the kiosk -- is unchanged)
-- ======================================================================
drop policy classes_insert on public.classes;
drop policy classes_update on public.classes;
drop policy classes_delete on public.classes;

create policy classes_insert on public.classes for insert to authenticated
  with check ((select public.has_permission('students.classes.manage', 'students'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy classes_update on public.classes for update to authenticated
  using ((select public.has_permission('students.classes.manage', 'students'))
         or (select public.has_permission_at('participants.edit', 'program')))
  with check ((select public.has_permission('students.classes.manage', 'students'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy classes_delete on public.classes for delete to authenticated
  using ((select public.has_permission('students.classes.manage', 'students'))
         or (select public.has_permission_at('participants.edit', 'program')));

-- ======================================================================
-- 4. sessions and past_session_students
-- ======================================================================
-- The old policies were granted to every role (public) and checked the
-- account type; these are for signed-in staff only, which is who could pass.
drop policy sessions_select on public.sessions;
drop policy sessions_insert on public.sessions;
drop policy sessions_update on public.sessions;
drop policy sessions_delete on public.sessions;
drop policy past_session_students_select on public.past_session_students;
drop policy past_session_students_insert on public.past_session_students;
drop policy past_session_students_update on public.past_session_students;
drop policy past_session_students_delete on public.past_session_students;

create policy sessions_select on public.sessions for select to authenticated
  using ((select public.has_permission('students.sessions.manage', 'students')));
create policy sessions_insert on public.sessions for insert to authenticated
  with check ((select public.has_permission('students.sessions.manage', 'students')));
create policy sessions_update on public.sessions for update to authenticated
  using ((select public.has_permission('students.sessions.manage', 'students')))
  with check ((select public.has_permission('students.sessions.manage', 'students')));
create policy sessions_delete on public.sessions for delete to authenticated
  using ((select public.has_permission('students.sessions.manage', 'students')));

create policy past_session_students_select on public.past_session_students for select to authenticated
  using ((select public.has_permission('students.sessions.manage', 'students')));
create policy past_session_students_insert on public.past_session_students for insert to authenticated
  with check ((select public.has_permission('students.sessions.manage', 'students')));
create policy past_session_students_update on public.past_session_students for update to authenticated
  using ((select public.has_permission('students.sessions.manage', 'students')))
  with check ((select public.has_permission('students.sessions.manage', 'students')));
create policy past_session_students_delete on public.past_session_students for delete to authenticated
  using ((select public.has_permission('students.sessions.manage', 'students')));

-- ======================================================================
-- 5. Program access from Administration (the Program Access tab)
-- ======================================================================
-- sync_legacy_access() as in p1b, with one change marked below.
create or replace function public.sync_legacy_access(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  want_roles jsonb := '[]'::jsonb;   -- [{role, program}]
  want_programs text[] := '{}';
begin
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then return; end if;

  want_roles := want_roles || jsonb_build_object('role', 'legacy_' || v_role, 'program', null);
  want_programs := public.legacy_role_programs(v_role);

  if v_role <> 'administrator' and exists (
    select 1 from public.workforce_role_access w where w.role = v_role and w.enabled
  ) then
    want_roles := want_roles || jsonb_build_object('role', 'legacy_workforce_access', 'program', null);
    want_programs := want_programs || array['workforce'];
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
  -- A revoked row is restored as automatic whoever created it: an admin
  -- removing their own grant must not take away what the account type gives.
  on conflict (user_id, program_key) do update
    set revoked_at = null, revoked_by = null, granted_at = now(), granted_by = excluded.granted_by,
        source = 'legacy_sync'
    where user_program_access.revoked_at is not null;
end;
$$;

-- Re-applies the automatic (legacy) rows for one person after an admin
-- change. Needs the right to assign access.
create or replace function public.admin_resync_legacy(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require('admin.permissions.assign');
  perform public.sync_legacy_access(p_user);
end;
$$;

-- Run as the caller, so RLS and guard_access_change() decide (not on
-- yourself; only programs you can open yourself, unless a System
-- Administrator). The reason goes to the audit log.
create or replace function public.admin_grant_program(p_user uuid, p_program text, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (select 1 from public.user_program_access where user_id = p_user and program_key = p_program and revoked_at is null) then
    raise exception 'this person can already open this program' using errcode = '23505';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.user_program_access
    set revoked_at = null, revoked_by = null, source = 'admin', granted_by = auth.uid(), granted_at = now()
  where user_id = p_user and program_key = p_program and revoked_at is not null;
  if not found then
    insert into public.user_program_access (user_id, program_key) values (p_user, p_program);
  end if;
end;
$$;

-- Only access an admin gave; automatic access follows the account type,
-- Workforce access and program staff settings.
create or replace function public.admin_revoke_program(p_user uuid, p_program text, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.user_program_access set revoked_at = now(), revoked_by = auth.uid()
  where user_id = p_user and program_key = p_program and revoked_at is null and source = 'admin';
  if not found then
    raise exception 'only program access an admin gave can be removed here' using errcode = 'P0002';
  end if;
  perform public.admin_resync_legacy(p_user);
end;
$$;

revoke all on function public.admin_resync_legacy(uuid) from public, anon;
revoke all on function public.admin_grant_program(uuid, text, text) from public, anon;
revoke all on function public.admin_revoke_program(uuid, text, text) from public, anon;
grant execute on function public.admin_resync_legacy(uuid) to authenticated;
grant execute on function public.admin_grant_program(uuid, text, text) to authenticated;
grant execute on function public.admin_revoke_program(uuid, text, text) to authenticated;
