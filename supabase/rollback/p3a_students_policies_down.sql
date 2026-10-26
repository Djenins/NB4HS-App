-- Rollback for p3a_students_policies: restores the policies exactly as they
-- were before it (copied from pg_policies on 2026-10-26) and removes what it
-- added. Not a migration -- run by hand only if p3a has to be undone.
-- supabase/tests/p3_policy_parity_*.sql is run across up + down in the dry
-- run to prove this returns every account to where it started.
-- Order: p3 rollbacks undo in reverse (newest first: p3f, p3e, p3d, p3c, p3b, p3a) -- later
-- parts' policies use helpers the earlier parts created.

drop policy students_select on public.students;
drop policy students_insert on public.students;
drop policy students_update on public.students;
drop policy students_delete on public.students;
create policy students_select on public.students for select to authenticated using (is_staff());
create policy students_insert on public.students for insert to authenticated with check (is_staff());
create policy students_update on public.students for update to authenticated using (is_staff()) with check (is_staff());
create policy students_delete on public.students for delete to authenticated using (is_staff());

drop policy classes_insert on public.classes;
drop policy classes_update on public.classes;
drop policy classes_delete on public.classes;
create policy classes_insert on public.classes for insert to authenticated with check (is_staff());
create policy classes_update on public.classes for update to authenticated using (is_staff()) with check (is_staff());
create policy classes_delete on public.classes for delete to authenticated using (is_staff());

drop policy sessions_select on public.sessions;
drop policy sessions_insert on public.sessions;
drop policy sessions_update on public.sessions;
drop policy sessions_delete on public.sessions;
create policy sessions_select on public.sessions for select using (has_role(array['administrator', 'case_manager', 'job_developer']));
create policy sessions_insert on public.sessions for insert with check (has_role(array['administrator', 'case_manager', 'job_developer']));
create policy sessions_update on public.sessions for update using (has_role(array['administrator', 'case_manager', 'job_developer']))
  with check (has_role(array['administrator', 'case_manager', 'job_developer']));
create policy sessions_delete on public.sessions for delete using (has_role(array['administrator', 'case_manager', 'job_developer']));

drop policy past_session_students_select on public.past_session_students;
drop policy past_session_students_insert on public.past_session_students;
drop policy past_session_students_update on public.past_session_students;
drop policy past_session_students_delete on public.past_session_students;
create policy past_session_students_select on public.past_session_students for select using (has_role(array['administrator', 'case_manager', 'job_developer']));
create policy past_session_students_insert on public.past_session_students for insert with check (has_role(array['administrator', 'case_manager', 'job_developer']));
create policy past_session_students_update on public.past_session_students for update using (has_role(array['administrator', 'case_manager', 'job_developer']))
  with check (has_role(array['administrator', 'case_manager', 'job_developer']));
create policy past_session_students_delete on public.past_session_students for delete using (has_role(array['administrator', 'case_manager', 'job_developer']));

delete from public.role_permissions rp using public.roles r
where r.id = rp.role_id and r.key = 'legacy_receptionist' and rp.permission_key = 'participants.view';
delete from public.permissions where key = 'participants.edit';  -- cascades to role_permissions
drop function public.has_permission_at(text, text, text);

drop function public.admin_grant_program(uuid, text, text);
drop function public.admin_revoke_program(uuid, text, text);
drop function public.admin_resync_legacy(uuid);
-- sync_legacy_access() exactly as p1b left it.
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
  on conflict (user_id, program_key) do update
    set revoked_at = null, revoked_by = null, granted_at = now(), granted_by = excluded.granted_by
    where user_program_access.source = 'legacy_sync' and user_program_access.revoked_at is not null;
end;
$$;
