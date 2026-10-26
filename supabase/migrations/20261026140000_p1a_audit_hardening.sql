-- Phase 1, part A -- audit log hardening (plans/unified-access-architecture.md
-- §5, §10; audit finding S11). NOT YET APPLIED. Additive; changes no access
-- rule anyone relies on.
--
-- * audit_events is append-only for every role, including the table owner's
--   API roles: UPDATE/DELETE/TRUNCATE privileges are revoked from anon,
--   authenticated and service_role, and a trigger refuses them for anyone
--   else. Rows are only ever written by audit_row_change() (SECURITY DEFINER).
-- * New columns: subject_user_id (whose access changed), old_values /
--   new_values (only for administration tables -- staff accounts, roles,
--   permissions, program access -- never for participant tables, which keep
--   recording field names only), and reason (from the session setting
--   nb4hs.audit_reason, which admin RPCs set for high-risk changes).
-- * profiles and workforce_role_access are now audited, so role, email and
--   activation changes leave a trace. Phase 1 part B attaches the same
--   trigger to every new access table.

alter table public.audit_events
  add column subject_user_id uuid references public.profiles(id) on delete set null,
  add column old_values jsonb,
  add column new_values jsonb,
  add column reason text check (reason is null or char_length(reason) <= 1000);
create index audit_events_subject_idx on public.audit_events (subject_user_id, occurred_at desc) where subject_user_id is not null;
create index audit_events_table_idx on public.audit_events (table_name, occurred_at desc);

-- Tables whose full before/after values are recorded. Everything else keeps
-- the field-names-only rule, so participant data never lands in the log.
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

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  the_row jsonb := coalesce(new_row, old_row);
  fields text[];
  with_values boolean := public.audit_values_table(tg_table_name);
  subject uuid;
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into fields
    from jsonb_each(new_row) n
    where n.key not in ('updated_at') and n.value is distinct from old_row -> n.key;
    if fields is null then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    select array_agg(key order by key) into fields from jsonb_object_keys(new_row) key;
  end if;

  if with_values then
    subject := coalesce(
      (the_row ->> 'user_id')::uuid,
      case when tg_table_name = 'profiles' then (the_row ->> 'id')::uuid end
    );
  end if;

  insert into public.audit_events (actor_id, action, table_name, record_id, program, changed_fields,
                                   subject_user_id, old_values, new_values, reason)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(the_row ->> 'id', the_row ->> 'user_id', the_row ->> 'key', the_row ->> 'role_id', the_row ->> 'role'),
          coalesce(the_row ->> 'program', case when tg_table_name = 'programs' then the_row ->> 'key' end),
          fields,
          subject,
          case when with_values then old_row end,
          case when with_values then new_row end,
          nullif(current_setting('nb4hs.audit_reason', true), ''));
  return coalesce(new, old);
end;
$$;

-- ============ append-only ============
revoke update, delete, truncate on public.audit_events from anon, authenticated, service_role, public;
revoke insert on public.audit_events from anon, authenticated, public;

create or replace function public.audit_events_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_events is append-only' using errcode = '42501';
end;
$$;
revoke all on function public.audit_events_append_only() from public, anon, authenticated;
create trigger audit_events_no_update_delete before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();
create trigger audit_events_no_truncate before truncate on public.audit_events
  for each statement execute function public.audit_events_append_only();

-- ============ newly audited tables ============
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
create trigger workforce_role_access_audit after insert or update or delete on public.workforce_role_access
  for each row execute function public.audit_row_change();

-- Readers: administrators as before; Phase 1 part B adds the admin.audit.view
-- permission and the subject's own history.
