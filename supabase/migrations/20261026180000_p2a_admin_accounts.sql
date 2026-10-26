-- Phase 2, part A -- staff accounts, positions and roles administration
-- (plans/unified-access-architecture.md §6, §13 Phase 2). NOT YET APPLIED.
--
-- What it adds, for the new Administration area (/admin):
--   * Roles & Permissions and Staff Positions switch on (implemented = true),
--     so their admin.roles.* / admin.positions.manage permissions take effect.
--   * admin_users(): staff accounts with their sign-in state, positions and
--     roles, for admins only.
--   * Account lifecycle, each change in one audited transaction with a reason:
--       admin_set_user_active()   deactivate (profile off, sign-in blocked,
--                                 every session ended) or reactivate/approve
--       admin_revoke_sessions()   sign someone out everywhere
--       admin_record_invite()     marks an account invited and active; called
--                                 by the admin-users Edge Function after
--                                 Supabase Auth creates the invited user
--       admin_log_auth_action()   audit row for an invite or reset link sent
--   * Role and position helpers that run as the caller, so the RLS policies
--     and guard_access_change() from p1b still apply, and record a reason:
--       admin_create_role(), admin_assign_role(), admin_revoke_role(),
--       admin_create_position(), admin_set_primary_position()
--
-- Behaviour changes for existing screens: none for staff. profiles writes
-- from the browser keep today's rule (only administrators change role or
-- active status) and additionally refuse changes to your own role, status
-- or sign-in email. Trusted server code -- the admin functions above, which
-- do their own checks -- is no longer second-guessed by that trigger.
--
-- Rollback: the only existing objects it changes are
-- prevent_self_role_escalation() (p0a's version: SECURITY DEFINER, "if not
-- is_admin() then keep role, active and email"), the profiles update policy
-- (was "id = auth.uid() or is_admin()") and audit_events' action check (was
-- insert/update/delete). Everything else is new and can be dropped; set the
-- two modules back to implemented = false.

-- ======================================================================
-- 1. Turn on the Roles and Positions admin modules
-- ======================================================================
update public.app_modules set implemented = true where key in ('admin.roles', 'admin.positions');

-- One primary position per person.
create unique index user_positions_one_primary on public.user_positions (user_id) where is_primary;

-- Account-level audit actions that aren't a row change.
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in ('insert', 'update', 'delete', 'invite', 'revoke_sessions', 'password_reset'));

-- ======================================================================
-- 2. profiles: browser writes vs trusted server code
-- ======================================================================
-- Runs as the invoker so it can tell a signed-in browser (current_user =
-- 'authenticated') from trusted server code (the admin functions below run
-- as the table owner and make their own checks). In the browser:
--   * nobody changes their own role, status or lifecycle dates;
--   * only administrators change anyone else's;
--   * the email is the sign-in identity and only changes through Supabase Auth.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.id := old.id;
  if current_user <> 'authenticated' then
    return new;
  end if;
  new.email := old.email;
  if new.id = auth.uid() or not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.invited_at := old.invited_at;
    new.deactivated_at := old.deactivated_at;
    new.deactivated_by := old.deactivated_by;
  end if;
  return new;
end;
$$;

-- Admins under the new model (admin.users.edit) can edit names and the
-- primary workspace too; the trigger above still keeps role/status theirs.
drop policy profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin() or public.has_permission('admin.users.edit'))
  with check (id = auth.uid() or public.is_admin() or public.has_permission('admin.users.edit'));

-- ======================================================================
-- 3. Shared checks
-- ======================================================================
create or replace function public.admin_require(p_key text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission(p_key) then
    raise exception 'you do not have permission to do this (%)', p_key using errcode = '42501';
  end if;
end;
$$;

-- Whether an account holds (or, if reactivated, would hold) administrator
-- powers: the legacy administrator role or a System Administrator role,
-- whether or not the account is active right now.
create or replace function public.admin_is_privileged(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user and role = 'administrator')
      or exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = p_user and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
          and r.key in ('system_administrator', 'legacy_administrator')
      );
$$;

-- Checks every lifecycle action shares: signed in with the permission, not
-- acting on yourself, the account exists, a reason is given, and only a
-- System Administrator acts on another administrator.
create or replace function public.admin_check_target(p_user uuid, p_permission text, p_reason text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_require(p_permission);
  if p_user = auth.uid() then
    raise exception 'you cannot do this to your own account' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'no such account' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if public.admin_is_privileged(p_user) and not public.is_system_admin(auth.uid()) then
    raise exception 'only a System Administrator can do this to an administrator' using errcode = '42501';
  end if;
end;
$$;

-- An audit row for an account action that isn't a row change.
create or replace function public.admin_audit_event(p_action text, p_table text, p_user uuid, p_reason text, p_values jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events (actor_id, action, table_name, record_id, subject_user_id, new_values, reason)
  values (auth.uid(), p_action, p_table, p_user::text, p_user, p_values, nullif(btrim(p_reason), ''));
$$;

revoke all on function public.admin_require(text) from public, anon, authenticated;
revoke all on function public.admin_is_privileged(uuid) from public, anon, authenticated;
revoke all on function public.admin_check_target(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_audit_event(text, text, uuid, text, jsonb) from public, anon, authenticated;

-- ======================================================================
-- 4. Reading accounts
-- ======================================================================
-- Every staff account (or one, with p_user) with what the admin screens
-- need from Supabase Auth: last sign-in, whether the invite was accepted,
-- whether sign-in is blocked, and how many sessions are open. Never tokens.
create or replace function public.admin_users(p_user uuid default null)
returns table (
  id uuid, name text, email text, role text, active boolean, primary_workspace text,
  created_at timestamptz, invited_at timestamptz, deactivated_at timestamptz, deactivated_by uuid,
  last_sign_in_at timestamptz, email_confirmed_at timestamptz, banned_until timestamptz,
  session_count int, positions jsonb, roles jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.admin_require('admin.users.view');
  return query
    select p.id, p.name, p.email, p.role, p.active, p.primary_workspace,
      p.created_at, p.invited_at, p.deactivated_at, p.deactivated_by,
      u.last_sign_in_at, u.email_confirmed_at, u.banned_until,
      (select count(*)::int from auth.sessions s where s.user_id = p.id),
      coalesce((
        select jsonb_agg(jsonb_build_object('id', pos.id, 'name', pos.name_en, 'is_primary', up.is_primary)
                         order by up.is_primary desc, pos.sort_order)
        from public.user_positions up join public.positions pos on pos.id = up.position_id
        where up.user_id = p.id and up.ended_on is null
      ), '[]'::jsonb),
      coalesce((
        select jsonb_agg(jsonb_build_object('id', ur.id, 'role_id', r.id, 'key', r.key, 'name', r.name,
                                            'kind', r.kind, 'program_key', ur.program_key, 'source', ur.source,
                                            'expires_at', ur.expires_at)
                         order by r.kind, r.name)
        from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = p.id and ur.revoked_at is null
          and (ur.expires_at is null or ur.expires_at > now())
      ), '[]'::jsonb)
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p_user is null or p.id = p_user
    order by lower(coalesce(p.name, p.email));
end;
$$;

-- ======================================================================
-- 5. Account lifecycle
-- ======================================================================
-- Deactivate: the profile goes inactive (RLS stops serving them at once),
-- Supabase Auth refuses their sign-in and token refresh, and every open
-- session ends. Reactivate (also how a pending self-signup is approved)
-- reverses the first two.
create or replace function public.admin_set_user_active(p_user uuid, p_active boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ended int;
begin
  perform public.admin_check_target(p_user, 'admin.users.deactivate', p_reason);
  perform set_config('nb4hs.audit_reason', btrim(p_reason), true);
  if p_active then
    update public.profiles set active = true, deactivated_at = null, deactivated_by = null where id = p_user;
    update auth.users set banned_until = null where id = p_user;
  else
    update public.profiles set active = false, deactivated_at = now(), deactivated_by = auth.uid() where id = p_user;
    -- What auth.admin.updateUserById(ban_duration: '876000h') sets.
    update auth.users set banned_until = now() + interval '100 years' where id = p_user;
    delete from auth.sessions where user_id = p_user;
    get diagnostics ended = row_count;
    perform public.admin_audit_event('revoke_sessions', 'auth.sessions', p_user, p_reason,
                                     jsonb_build_object('sessions_ended', ended));
  end if;
end;
$$;

-- Sign someone out on every device; the account stays active.
create or replace function public.admin_revoke_sessions(p_user uuid, p_reason text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ended int;
begin
  perform public.admin_check_target(p_user, 'admin.users.revoke_sessions', p_reason);
  delete from auth.sessions where user_id = p_user;
  get diagnostics ended = row_count;
  perform public.admin_audit_event('revoke_sessions', 'auth.sessions', p_user, p_reason,
                                   jsonb_build_object('sessions_ended', ended));
  return ended;
end;
$$;

-- Called by the admin-users Edge Function, with the admin's own token, right
-- after Supabase Auth created (or re-invited) the user. Only for accounts
-- that have never signed in, so an invite can't revive a deactivated account
-- that was in use.
create or replace function public.admin_record_invite(p_user uuid, p_delivery text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_check_target(p_user, 'admin.users.invite', coalesce(nullif(btrim(p_reason), ''), 'Invited'));
  if p_delivery not in ('email', 'link') then
    raise exception 'unknown delivery %', p_delivery using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where id = p_user and last_sign_in_at is not null) then
    raise exception 'this person has already signed in' using errcode = '42501';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(nullif(btrim(p_reason), ''), 'Invited'), true);
  update public.profiles set active = true, invited_at = now(), deactivated_at = null, deactivated_by = null
  where id = p_user;
  update auth.users set banned_until = null where id = p_user;
  perform public.admin_audit_event('invite', 'auth.users', p_user, coalesce(nullif(btrim(p_reason), ''), 'Invited'),
                                   jsonb_build_object('delivery', p_delivery));
end;
$$;

-- Audit row for a password-reset email the Edge Function sent.
create or replace function public.admin_log_auth_action(p_user uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action <> 'password_reset' then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  perform public.admin_check_target(p_user, 'admin.users.edit', coalesce(nullif(btrim(p_reason), ''), 'Password reset requested'));
  perform public.admin_audit_event(p_action, 'auth.users', p_user,
                                   coalesce(nullif(btrim(p_reason), ''), 'Password reset requested'),
                                   jsonb_build_object('delivery', 'email'));
end;
$$;

-- ======================================================================
-- 6. Roles and positions (run as the caller: RLS and the p1b guard apply)
-- ======================================================================
-- 'Program Lead (Students)' -> 'program_lead_students_3f9a'
create or replace function public.admin_slug(p_name text)
returns text
language sql
volatile
set search_path = public
as $$
  select left(
    case when s ~ '^[a-z]' then s else 'x_' || s end, 40
  ) || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 4)
  from (select coalesce(nullif(btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '_', 'g'), '_'), ''), 'item') as s) t;
$$;

-- New custom role, optionally a copy of another role's permissions.
create or replace function public.admin_create_role(p_name text, p_description text default '', p_copy_from uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'a role needs a name' using errcode = '22023';
  end if;
  insert into public.roles (key, name, description, kind)
  values (public.admin_slug(p_name), btrim(p_name), coalesce(btrim(p_description), ''), 'custom')
  returning id into new_id;
  if p_copy_from is not null then
    insert into public.role_permissions (role_id, permission_key, scope)
    select new_id, rp.permission_key, rp.scope from public.role_permissions rp where rp.role_id = p_copy_from;
  end if;
  return new_id;
end;
$$;

create or replace function public.admin_assign_role(p_user uuid, p_role uuid, p_program text default null,
                                                    p_expires_at timestamptz default null, p_reason text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  if exists (select 1 from public.roles where id = p_role and (archived_at is not null or kind = 'legacy')) then
    raise exception 'archived and legacy roles cannot be assigned' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'the expiry date must be in the future' using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  insert into public.user_roles (user_id, role_id, program_key, expires_at)
  values (p_user, p_role, nullif(p_program, ''), p_expires_at)
  returning id into new_id;
  return new_id;
end;
$$;

-- Legacy rows follow profiles.role, Workforce access and program staff; they
-- are changed there, not here.
create or replace function public.admin_revoke_role(p_user_role uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  update public.user_roles set revoked_at = now(), revoked_by = auth.uid()
  where id = p_user_role and revoked_at is null and source = 'admin';
  if not found then
    raise exception 'that role assignment is not one an admin can remove' using errcode = 'P0002';
  end if;
end;
$$;

-- Positions are named once; the Haitian Creole and French names start as
-- the English one and can be translated later.
create or replace function public.admin_create_position(p_name text, p_description text default '')
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  if char_length(btrim(coalesce(p_name, ''))) = 0 then
    raise exception 'a position needs a name' using errcode = '22023';
  end if;
  insert into public.positions (key, name_en, name_ht, name_fr, description, sort_order)
  values (public.admin_slug(p_name), btrim(p_name), btrim(p_name), btrim(p_name), coalesce(btrim(p_description), ''),
          coalesce((select max(sort_order) from public.positions), 0) + 10)
  returning id into new_id;
  return new_id;
end;
$$;

-- Two statements so the one-primary index never sees two at once.
create or replace function public.admin_set_primary_position(p_user uuid, p_position uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.user_positions set is_primary = false where user_id = p_user and is_primary and position_id <> p_position;
  update public.user_positions set is_primary = true where user_id = p_user and position_id = p_position;
  if not found then
    raise exception 'that person does not hold this position' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_slug(text) from public, anon;
revoke all on function public.admin_users(uuid) from public, anon;
revoke all on function public.admin_set_user_active(uuid, boolean, text) from public, anon;
revoke all on function public.admin_revoke_sessions(uuid, text) from public, anon;
revoke all on function public.admin_record_invite(uuid, text, text) from public, anon;
revoke all on function public.admin_log_auth_action(uuid, text, text) from public, anon;
revoke all on function public.admin_create_role(text, text, uuid) from public, anon;
revoke all on function public.admin_assign_role(uuid, uuid, text, timestamptz, text) from public, anon;
revoke all on function public.admin_revoke_role(uuid, text) from public, anon;
revoke all on function public.admin_create_position(text, text) from public, anon;
revoke all on function public.admin_set_primary_position(uuid, uuid) from public, anon;
grant execute on function public.admin_slug(text) to authenticated;
grant execute on function public.admin_users(uuid) to authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean, text) to authenticated;
grant execute on function public.admin_revoke_sessions(uuid, text) to authenticated;
grant execute on function public.admin_record_invite(uuid, text, text) to authenticated;
grant execute on function public.admin_log_auth_action(uuid, text, text) to authenticated;
grant execute on function public.admin_create_role(text, text, uuid) to authenticated;
grant execute on function public.admin_assign_role(uuid, uuid, text, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke_role(uuid, text) to authenticated;
grant execute on function public.admin_create_position(text, text) to authenticated;
grant execute on function public.admin_set_primary_position(uuid, uuid) to authenticated;
