-- Undo p5a_permission_admin. Nothing earlier depends on what it added.
begin;
drop function if exists public.admin_set_setting(text, jsonb, text);
drop table if exists public.app_settings;
drop function if exists public.admin_set_module_active(text, boolean, text);
drop function if exists public.preview_role_permissions(uuid, jsonb);
drop function if exists public.admin_set_role_permissions(uuid, jsonb, text);
drop function if exists public.admin_revoke_override(uuid, text);
drop function if exists public.admin_add_override(uuid, text, text, text, text, timestamptz, text);
drop function if exists public.admin_check_access_target(uuid, text);
drop function if exists public.admin_require_reason(text);

-- p1a's list.
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
    'teams', 'team_members'
  ]);
$$;

-- p1b's guard (with its override bug).
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
  if new.source = 'legacy_sync' and (tg_op = 'INSERT' or old.source <> 'legacy_sync') then
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

update public.app_modules set implemented = false where key in ('admin.programs', 'admin.audit');
delete from supabase_migrations.schema_migrations where version = '20261027010000';
commit;
