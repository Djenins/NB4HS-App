-- m1 -- staff mileage log (My Mileage).
-- NOT YET APPLIED to live. Tested on the local stack with
-- supabase/tests/m1_mileage_check.sql. Undo with
-- supabase/rollback/m1_mileage_log_down.sql.
--
-- Staff who drive their own car for work -- Outreach workers most of all --
-- log each trip (date, from, to, purpose, miles) and print a monthly
-- mileage sheet to sign and hand in for reimbursement.
--
--   * Every active staff member logs, edits and deletes their own trips.
--   * Administrators read everyone's trips (to check and print a sheet for
--     anyone). A program's supervisors and program admins read the trips of
--     the active members of their program (SNAP's supervisors see SNAP's
--     workers). Staff Reports is not a team in this sense and is left out.
--     Nobody edits someone else's log.
--   * The reimbursement rate per mile is an organization setting
--     (app_settings 'mileage_rate', saved through admin_set_setting).
--     Nothing stores a dollar amount per trip: the sheet multiplies the
--     month's miles by the rate in force when it is printed.
--   * Every change is audited (audit_row_change).
--
-- Behaviour changes for existing screens: none.

-- ======================================================================
-- 1. Trips
-- ======================================================================
create table public.mileage_trips (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_date date not null check (trip_date between date '2020-01-01' and date '2100-12-31'),
  start_location text not null check (char_length(btrim(start_location)) between 1 and 200),
  destination text not null check (char_length(btrim(destination)) between 1 and 200),
  purpose text not null check (char_length(btrim(purpose)) between 1 and 300),
  -- One-way miles as driven; round_trip doubles them on the sheet.
  miles numeric(6, 1) not null check (miles > 0 and miles <= 1000),
  round_trip boolean not null default false,
  odometer_start integer check (odometer_start is null or odometer_start between 0 and 9999999),
  odometer_end integer check (odometer_end is null or odometer_end between 0 and 9999999),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mileage_trips_odometer_order check (
    odometer_start is null or odometer_end is null or odometer_end >= odometer_start
  )
);
create index mileage_trips_staff_date_idx on public.mileage_trips (staff_id, trip_date desc);

create trigger mileage_trips_set_updated_at before update on public.mileage_trips
  for each row execute function public.set_updated_at();
create trigger mileage_trips_audit after insert or update or delete on public.mileage_trips
  for each row execute function public.audit_row_change();

-- A trip always belongs to the person who logged it.
create or replace function public.mileage_trips_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.staff_id is distinct from old.staff_id then
    raise exception 'a trip cannot move to another person' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger mileage_trips_guard before update on public.mileage_trips
  for each row execute function public.mileage_trips_guard();

alter table public.mileage_trips enable row level security;
revoke all on public.mileage_trips from public, anon;
grant select, insert, update, delete on public.mileage_trips to authenticated;

-- May the signed-in person read this person's mileage? Their own, an
-- administrator, or a lead of a program the person is an active member of.
create or replace function public.mileage_can_view(p_staff uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_staff() and (
    p_staff = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.program_staff lead
      join public.program_staff member on member.program = lead.program
      where lead.user_id = auth.uid() and lead.active
        and lead.program_role in ('supervisor', 'program_admin')
        and lead.program <> 'staff_reports'
        and member.user_id = p_staff and member.active
    )
  );
$$;
revoke all on function public.mileage_can_view(uuid) from public, anon;
grant execute on function public.mileage_can_view(uuid) to authenticated;

-- Whose mileage the signed-in person can open, besides their own: everyone
-- active for an administrator, their programs' members for a lead.
create or replace function public.mileage_team()
returns table (id uuid, name text, email text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.email
  from public.profiles p
  where p.active and p.id <> auth.uid() and public.mileage_can_view(p.id)
  order by p.name nulls last, p.email;
$$;
revoke all on function public.mileage_team() from public, anon;
grant execute on function public.mileage_team() to authenticated;

create policy mileage_trips_select on public.mileage_trips for select to authenticated
  using (public.mileage_can_view(staff_id));
create policy mileage_trips_insert on public.mileage_trips for insert to authenticated
  with check (public.is_staff() and staff_id = auth.uid());
create policy mileage_trips_update on public.mileage_trips for update to authenticated
  using (public.is_staff() and staff_id = auth.uid())
  with check (public.is_staff() and staff_id = auth.uid());
create policy mileage_trips_delete on public.mileage_trips for delete to authenticated
  using (public.is_staff() and staff_id = auth.uid());

-- ======================================================================
-- 2. The reimbursement rate (c2's admin_set_setting plus 'mileage_rate')
-- ======================================================================
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
  elsif p_key = 'mailing_address' then
    if jsonb_typeof(p_value) <> 'string' or char_length(btrim(p_value #>> '{}')) not between 10 and 300 then
      raise exception 'the mailing address must be 10 to 300 characters' using errcode = '22023';
    end if;
    p_value := to_jsonb(btrim(p_value #>> '{}'));
  elsif p_key = 'mileage_rate' then
    -- Dollars per mile, e.g. 0.70; at most 3 decimals.
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric < 0 or (p_value #>> '{}')::numeric > 5
       or (p_value #>> '{}')::numeric <> round((p_value #>> '{}')::numeric, 3) then
      raise exception 'the mileage rate must be between 0 and 5 dollars per mile, at most 3 decimals' using errcode = '22023';
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
revoke all on function public.admin_set_setting(text, jsonb, text) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb, text) to authenticated;
