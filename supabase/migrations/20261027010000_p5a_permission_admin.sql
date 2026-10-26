-- Phase 5, part A -- permission administration (plans/unified-access-
-- architecture.md §6, §13 Phase 5).
-- NOT APPLIED. Dry-run only (supabase/tests/p5_admin_check.sql), waiting for
-- review.
--
-- What it adds, for the Detailed Permissions tab, the role editor, Programs &
-- Modules, the Access Audit Log and System Settings:
--   * Programs & Modules and the Access Audit Log switch on (implemented =
--     true), so admin.programs.manage and admin.audit.view take effect.
--   * Individual grants and denies, each with a reason and an optional expiry:
--       admin_add_override(), admin_revoke_override()
--   * Editing what a role allows, in one audited step with a reason:
--       admin_set_role_permissions()
--     and its impact preview, without saving:
--       preview_role_permissions()   who gains or loses what
--   * Turning a program, submodule or shared feature on or off:
--       admin_set_module_active()
--   * Organization settings kept on the server instead of each browser:
--       app_settings, admin_set_setting(). First setting: the auto check-out
--       closing time (today stored per browser).
--
-- These run as the caller, so the RLS policies and guard_access_change() from
-- p1b still apply on top of their own checks: no self-changes, no granting
-- what you don't hold, protected roles stay fixed, and the last active System
-- Administrator can't be locked out. Every change records its reason in
-- audit_events (nb4hs.audit_reason, as in p2a).
--
-- Behaviour changes for existing screens: none. Nothing reads app_settings
-- until the app ships with it, and the app falls back to the browser's saved
-- closing time while it is empty.
--
-- Also fixes a p1b bug: guard_access_change() made every override insert
-- from the app fail (section 1b).
--
-- Rollback (supabase/rollback/p5a_permission_admin_down.sql): drop the new
-- functions and app_settings, restore audit_values_table() to p1a's list and
-- guard_access_change() to p1b's,
-- and set admin.programs / admin.audit back to implemented = false.

-- ======================================================================
-- 1. Turn on Programs & Modules and the Access Audit Log
-- ======================================================================
update public.app_modules set implemented = true where key in ('admin.programs', 'admin.audit');

-- ======================================================================
-- 1b. Fix: overrides could not be saved from the app
-- ======================================================================
-- p1b's guard_access_change() checked new.source on every access table, but
-- user_permission_overrides has no source column, so every override insert
-- from a signed-in client failed ("record new has no field source"). Same
-- function with that one check limited to the tables that have the column.
create or replace function public.guard_access_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target_user uuid;
  v_role_id uuid;
  v_protected boolean;
  missing text;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'roles' then
    if tg_op = 'DELETE' then
      raise exception 'roles are archived, not deleted' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.protected then
      raise exception 'built-in role % cannot be changed', old.key using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.kind <> old.kind or new.protected <> old.protected or new.key <> old.key) then
      raise exception 'a role''s key, kind and protection are fixed' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and (new.kind <> 'custom' or new.protected) then
      raise exception 'only custom roles can be created' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'role_permissions' then
    v_role_id := coalesce(new.role_id, old.role_id);
    select protected into v_protected from public.roles where id = v_role_id;
    if v_protected then
      raise exception 'built-in role permissions cannot be changed' using errcode = '42501';
    end if;
    if tg_op <> 'DELETE' and not public.is_system_admin(me) then
      if (select sensitivity from public.permissions where key = new.permission_key) = 'system' then
        raise exception 'only a System Administrator can add administration permissions' using errcode = '42501';
      end if;
      if not exists (
        select 1 from public.user_effective_permissions e
        where e.user_id = me and e.permission_key = new.permission_key
          and public.access_scope_rank(e.scope) >= public.access_scope_rank(new.scope)
      ) then
        raise exception 'you can only grant permissions you hold yourself (%)', new.permission_key using errcode = '42501';
      end if;
    end if;
    return coalesce(new, old);
  end if;

  -- user_roles, user_program_access, user_permission_overrides
  target_user := coalesce(new.user_id, old.user_id);
  if target_user = me then
    raise exception 'you cannot change your own access' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'access is revoked, not deleted' using errcode = '42501';
  end if;
  -- Only roles and program access have automatic (legacy) rows; overrides
  -- have no source column, and plpgsql can't read a column the row lacks.
  if tg_table_name in ('user_roles', 'user_program_access')
     and (to_jsonb(new) ->> 'source') = 'legacy_sync'
     and (tg_op = 'INSERT' or (to_jsonb(old) ->> 'source') <> 'legacy_sync') then
    raise exception 'legacy rows are maintained automatically' using errcode = '42501';
  end if;

  if not public.is_system_admin(me) then
    if tg_table_name = 'user_roles' and new.revoked_at is null then
      select string_agg(rp.permission_key, ', ') into missing
      from public.role_permissions rp
      join public.permissions p on p.key = rp.permission_key
      where rp.role_id = new.role_id
        and (p.sensitivity = 'system' or not exists (
          select 1 from public.user_effective_permissions e
          where e.user_id = me and e.permission_key = rp.permission_key
            and public.access_scope_rank(e.scope) >= public.access_scope_rank(rp.scope)
        ));
      if missing is not null then
        raise exception 'this role includes permissions you do not hold: %', missing using errcode = '42501';
      end if;
    elsif tg_table_name = 'user_permission_overrides' and new.effect = 'grant' and new.revoked_at is null then
      if (select sensitivity from public.permissions where key = new.permission_key) = 'system'
         or not exists (
           select 1 from public.user_effective_permissions e
           where e.user_id = me and e.permission_key = new.permission_key
             and public.access_scope_rank(e.scope) >= public.access_scope_rank(new.scope)
         ) then
        raise exception 'you can only grant permissions you hold yourself (%)', new.permission_key using errcode = '42501';
      end if;
    elsif tg_table_name = 'user_program_access' and new.revoked_at is null then
      if not exists (
        select 1 from public.user_program_access mine
        where mine.user_id = me and mine.program_key = new.program_key and mine.revoked_at is null
      ) then
        raise exception 'you can only grant access to programs you can access yourself' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ======================================================================
-- 2. Shared checks
-- ======================================================================
-- A reason of at least 3 characters, the same rule as overrides' column.
create or replace function public.admin_require_reason(p_reason text)
returns void
language plpgsql
immutable
set search_path = public
as $$
begin
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.admin_require_reason(text) from public, anon;
grant execute on function public.admin_require_reason(text) to authenticated;

-- The p2a account checks (admin_check_target: signed in with the permission,
-- not yourself, the account exists, a reason, and only a System
-- Administrator touches an administrator) for the functions below, which run
-- as the caller and so can't reach the internal helpers directly. It only
-- ever raises or returns nothing.
create or replace function public.admin_check_access_target(p_user uuid, p_reason text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_check_target(p_user, 'admin.permissions.assign', p_reason);
end;
$$;
revoke all on function public.admin_check_access_target(uuid, text) from public, anon;
grant execute on function public.admin_check_access_target(uuid, text) to authenticated;

-- ======================================================================
-- 3. Individual grants and denies
-- ======================================================================
-- Changing an administrator's access is a System Administrator's job, as for
-- the account actions in p2a.
create or replace function public.admin_add_override(p_user uuid, p_permission text, p_effect text,
                                                     p_scope text default null, p_program text default null,
                                                     p_expires_at timestamptz default null, p_reason text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_id uuid;
begin
  perform public.admin_check_access_target(p_user, p_reason);
  if p_effect not in ('grant', 'deny') then
    raise exception 'an override either grants or denies' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'the expiry date must be in the future' using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', btrim(p_reason), true);
  insert into public.user_permission_overrides (user_id, permission_key, effect, scope, program_key, reason, expires_at)
  values (p_user, p_permission, p_effect, nullif(p_scope, ''), nullif(p_program, ''), btrim(p_reason), p_expires_at)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_revoke_override(p_override uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target uuid;
begin
  select user_id into target from public.user_permission_overrides where id = p_override and revoked_at is null;
  if target is null then
    raise exception 'no such override' using errcode = 'P0002';
  end if;
  perform public.admin_check_access_target(target, p_reason);
  perform set_config('nb4hs.audit_reason', btrim(p_reason), true);
  update public.user_permission_overrides set revoked_at = now(), revoked_by = auth.uid()
  where id = p_override and revoked_at is null;
  if not found then
    raise exception 'you do not have permission to do this (admin.permissions.assign)' using errcode = '42501';
  end if;
end;
$$;

-- ======================================================================
-- 4. What a role allows
-- ======================================================================
-- p_permissions is the role's complete new list: [{"key": ..., "scope": ...}].
-- Rows not in it are removed, new ones added, changed scopes updated -- so the
-- audit log shows exactly what moved. Legacy roles mirror today's hard-coded
-- access and follow the account type; they aren't edited here.
create or replace function public.admin_set_role_permissions(p_role uuid, p_permissions jsonb, p_reason text default null)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_kind text;
  holders int;
begin
  -- RLS would quietly skip the removals for someone without it; say so instead.
  if not public.has_permission('admin.roles.manage') then
    raise exception 'you do not have permission to do this (admin.roles.manage)' using errcode = '42501';
  end if;
  perform public.admin_require_reason(p_reason);
  select kind into v_kind from public.roles where id = p_role;
  if v_kind is null then
    raise exception 'no such role' using errcode = 'P0002';
  end if;
  if v_kind = 'legacy' then
    raise exception 'legacy roles follow the account type and cannot be edited' using errcode = '42501';
  end if;
  if jsonb_typeof(p_permissions) <> 'array' then
    raise exception 'permissions must be a list' using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', btrim(p_reason), true);

  -- One row per key; the last one given wins.
  delete from public.role_permissions rp
  where rp.role_id = p_role
    and not exists (select 1 from jsonb_array_elements(p_permissions) x where x->>'key' = rp.permission_key);
  update public.role_permissions rp set scope = w.scope
  from (select distinct on (x->>'key') x->>'key' as permission_key, nullif(x->>'scope', '') as scope
        from jsonb_array_elements(p_permissions) with ordinality as e(x, n) order by x->>'key', n desc) w
  where rp.role_id = p_role and rp.permission_key = w.permission_key and rp.scope is distinct from w.scope;
  insert into public.role_permissions (role_id, permission_key, scope)
  select p_role, w.permission_key, w.scope
  from (select distinct on (x->>'key') x->>'key' as permission_key, nullif(x->>'scope', '') as scope
        from jsonb_array_elements(p_permissions) with ordinality as e(x, n) order by x->>'key', n desc) w
  where not exists (select 1 from public.role_permissions rp where rp.role_id = p_role and rp.permission_key = w.permission_key);

  select count(distinct user_id) into holders from public.user_roles
  where role_id = p_role and revoked_at is null and (expires_at is null or expires_at > now());
  return holders;
end;
$$;

-- Who would gain or lose what if a role's list became p_permissions, without
-- saving: the same before/save/roll-back approach as
-- preview_effective_permissions() in p1b. Only changed rows come back. It
-- makes the change as the caller, so a change the caller isn't allowed to make
-- fails here exactly as it would on save.
create or replace function public.preview_role_permissions(p_role uuid, p_permissions jsonb)
returns table (user_id uuid, permission_key text, program_key text, before_scope text, after_scope text, change text)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  before_rows jsonb;
  after_rows jsonb;
  holders uuid[];
begin
  if not public.has_permission('admin.roles.manage') then
    raise exception 'you do not have permission to do this (admin.roles.manage)' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct ur.user_id), '{}') into holders from public.user_roles ur
  where ur.role_id = p_role and ur.revoked_at is null and (ur.expires_at is null or ur.expires_at > now());

  select coalesce(jsonb_agg(jsonb_build_object('u', e.user_id, 'k', e.permission_key, 'p', e.program_key, 's', e.scope)), '[]')
    into before_rows from public.user_effective_permissions e where e.user_id = any (holders);

  begin
    perform public.admin_set_role_permissions(p_role, p_permissions, 'preview');
    select coalesce(jsonb_agg(jsonb_build_object('u', e.user_id, 'k', e.permission_key, 'p', e.program_key, 's', e.scope)), '[]')
      into after_rows from public.user_effective_permissions e where e.user_id = any (holders);
    raise exception 'nb4hs_preview_rollback';
  exception when raise_exception then
    if sqlerrm <> 'nb4hs_preview_rollback' then raise; end if;
  end;

  return query
    with b as (select (x->>'u')::uuid u, x->>'k' k, x->>'p' p, x->>'s' s from jsonb_array_elements(before_rows) x),
         a as (select (x->>'u')::uuid u, x->>'k' k, x->>'p' p, x->>'s' s from jsonb_array_elements(after_rows) x)
    select coalesce(a.u, b.u), coalesce(a.k, b.k), coalesce(a.p, b.p), b.s, a.s,
           case when b.k is null then 'added' when a.k is null then 'removed' else 'scope_changed' end
    from a full join b on a.u = b.u and a.k = b.k and a.p = b.p
    where b.k is null or a.k is null or a.s is distinct from b.s;
end;
$$;

-- ======================================================================
-- 5. Programs & Modules
-- ======================================================================
-- Switching a program, submodule or shared feature off takes its permissions
-- away from everyone until it's back on (compute_effective_permissions, rule
-- 2). Administration itself can't be switched off from here, and catalogue
-- entries without screens (implemented = false) stay as they are.
create or replace function public.admin_set_module_active(p_key text, p_active boolean, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  m record;
begin
  if not public.has_permission('admin.programs.manage') then
    raise exception 'you do not have permission to do this (admin.programs.manage)' using errcode = '42501';
  end if;
  perform public.admin_require_reason(p_reason);
  select key, kind, implemented, parent_key into m from public.app_modules where key = p_key;
  if m.key is null then
    raise exception 'no such module' using errcode = 'P0002';
  end if;
  if m.kind = 'admin' or p_key = 'admin' or p_key like 'admin.%' then
    raise exception 'Administration cannot be switched off' using errcode = '42501';
  end if;
  if not m.implemented then
    raise exception 'this module has no screens yet' using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', btrim(p_reason), true);
  update public.app_modules set active = p_active where key = p_key and active is distinct from p_active;
end;
$$;

-- ======================================================================
-- 6. Organization settings
-- ======================================================================
create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger app_settings_set_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();
alter table public.app_settings enable row level security;
-- Every staff member's browser needs them (the closing-time sweep runs
-- wherever the app is open); writes go through admin_set_setting().
create policy app_settings_select on public.app_settings for select to authenticated using (public.is_staff());
revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;
revoke all on public.app_settings from anon;

create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function public.audit_row_change();

-- Settings and their shape, so a typo can't store something the app can't read.
create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require('admin.settings.manage');
  if p_key = 'closing_time' then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'the closing time must look like 17:00' using errcode = '22023';
    end if;
  else
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  insert into public.app_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
  where app_settings.value is distinct from excluded.value;
end;
$$;

-- Record full before/after values for app_settings too (nothing personal in it).
create or replace function public.audit_values_table(p_table text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_table = any (array[
    'profiles', 'workforce_role_access', 'program_staff',
    'app_modules', 'roles', 'role_permissions', 'user_roles', 'user_permission_overrides',
    'user_program_access', 'positions', 'user_positions', 'position_role_suggestions',
    'teams', 'team_members', 'app_settings'
  ]);
$$;

-- ======================================================================
-- 7. Grants
-- ======================================================================
revoke all on function public.admin_add_override(uuid, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.admin_revoke_override(uuid, text) from public, anon;
revoke all on function public.admin_set_role_permissions(uuid, jsonb, text) from public, anon;
revoke all on function public.preview_role_permissions(uuid, jsonb) from public, anon;
revoke all on function public.admin_set_module_active(text, boolean, text) from public, anon;
revoke all on function public.admin_set_setting(text, jsonb, text) from public, anon;
grant execute on function public.admin_add_override(uuid, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.admin_revoke_override(uuid, text) to authenticated;
grant execute on function public.admin_set_role_permissions(uuid, jsonb, text) to authenticated;
grant execute on function public.preview_role_permissions(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_module_active(text, boolean, text) to authenticated;
grant execute on function public.admin_set_setting(text, jsonb, text) to authenticated;
grant select on public.app_settings to authenticated;
