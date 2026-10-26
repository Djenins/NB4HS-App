-- SNAP Outreach Stage 1 -- program-scoped staff roles + audit log
-- (plans/snap-outreach-architecture.md §4, §6). ADDITIVE ONLY: new tables,
-- functions and triggers; nothing existing changes. NOT YET APPLIED.
--
-- Decisions (2026-10-26): SNAP roles live in their own table, on top of each
-- person's existing profiles.role, so a case manager can also be an outreach
-- worker. A system administrator manages SNAP staff and settings, but gets
-- program data (case notes etc., from Stage 2) only if they also hold a
-- SNAP role -- has_program_role() deliberately does not short-circuit on
-- is_admin().
--
-- `program` is a CHECK-constrained text column so a later program (e.g. a
-- Medicaid outreach module) is one constraint change, not new tables.

-- ============ updated_at helper ============
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ============ program_staff ============
create table public.program_staff (
  user_id uuid not null references public.profiles(id) on delete cascade,
  program text not null check (program in ('snap')),
  program_role text not null check (program_role in ('worker', 'supervisor', 'program_admin')),
  active boolean not null default true,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, program)
);
create index program_staff_program_idx on public.program_staff (program, program_role) where active;
create trigger program_staff_set_updated_at before update on public.program_staff
  for each row execute function public.set_updated_at();

-- True when the caller is an active staff member with an active role in
-- `p_program` from `p_roles`. No is_admin() bypass, on purpose (see header).
create or replace function public.has_program_role(p_program text, p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.program_staff ps
    join public.profiles p on p.id = ps.user_id
    where ps.user_id = auth.uid() and ps.program = p_program and ps.active
      and ps.program_role = any(p_roles) and p.active
  );
$$;

-- Who may grant/revoke program roles: system administrators (technical
-- configuration) and the program's own program admins.
create or replace function public.can_manage_program(p_program text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin() or public.has_program_role(p_program, array['program_admin']);
$$;

revoke all on function public.has_program_role(text, text[]) from public, anon;
revoke all on function public.can_manage_program(text) from public, anon;
grant execute on function public.has_program_role(text, text[]) to authenticated;
grant execute on function public.can_manage_program(text) to authenticated;

alter table public.program_staff enable row level security;

-- Everyone sees their own membership (drives the sidebar); supervisors see
-- their program's team; managers see everything they can change.
create policy program_staff_select on public.program_staff for select to authenticated
  using (
    (user_id = auth.uid() and is_staff())
    or has_program_role(program, array['supervisor', 'program_admin'])
    or can_manage_program(program)
  );
create policy program_staff_insert on public.program_staff for insert to authenticated
  with check (can_manage_program(program));
create policy program_staff_update on public.program_staff for update to authenticated
  using (can_manage_program(program)) with check (can_manage_program(program));
create policy program_staff_delete on public.program_staff for delete to authenticated
  using (can_manage_program(program));

-- ============ audit_events ============
-- Append-only. Records *which* fields changed, never their values, so the
-- log itself never becomes a second copy of personal data.
create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id text,
  program text,
  changed_fields text[]
);
create index audit_events_record_idx on public.audit_events (table_name, record_id);
create index audit_events_occurred_idx on public.audit_events (occurred_at desc);
create index audit_events_program_idx on public.audit_events (program, occurred_at desc);

alter table public.audit_events enable row level security;
-- Readable by system administrators and the program's own admins. No
-- insert/update/delete policies: rows only arrive through audit_row_change().
create policy audit_events_select on public.audit_events for select to authenticated
  using (is_admin() or (program is not null and has_program_role(program, array['program_admin'])));

-- Generic row-change trigger. record_id is the row's `id`, falling back to
-- `user_id` for tables keyed that way (program_staff); program comes from
-- the row's own `program` column when it has one.
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  the_row jsonb := coalesce(new_row, old_row);
  fields text[];
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

  insert into public.audit_events (actor_id, action, table_name, record_id, program, changed_fields)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(the_row ->> 'id', the_row ->> 'user_id'), the_row ->> 'program', fields);
  return coalesce(new, old);
end;
$$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger program_staff_audit after insert or update or delete on public.program_staff
  for each row execute function public.audit_row_change();
