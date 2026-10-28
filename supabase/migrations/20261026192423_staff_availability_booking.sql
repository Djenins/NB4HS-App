-- Staff availability + client self-booking.
--
-- Every staff login keeps a weekly availability calendar (My Availability)
-- plus time off. Clients booking an appointment (kiosk / phone) pick a person
-- and see only that person's open 30-minute slots: weekly hours, minus time
-- off, minus appointments already on their calendar, minus times already
-- past. Picking a slot holds it as a 'requested' appointment the staff member
-- confirms, exactly like today's requests -- nobody else can take it meanwhile.
-- A person shows up on the booking form once they've added hours.
--
-- Times are Rhode Island local (America/New_York), stored the way
-- appointments already store them: appt_date date + appt_time 'HH:MM'.

-- ---------- weekly hours ----------
create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists staff_availability_profile_idx on public.staff_availability (profile_id, weekday);
alter table public.staff_availability enable row level security;
create policy staff_availability_select on public.staff_availability for select to authenticated using (is_staff());
create policy staff_availability_insert on public.staff_availability for insert to authenticated with check (profile_id = auth.uid() or is_admin());
create policy staff_availability_update on public.staff_availability for update to authenticated using (profile_id = auth.uid() or is_admin()) with check (profile_id = auth.uid() or is_admin());
create policy staff_availability_delete on public.staff_availability for delete to authenticated using (profile_id = auth.uid() or is_admin());

-- ---------- time off ----------
create table if not exists public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists staff_time_off_profile_idx on public.staff_time_off (profile_id, start_date);
alter table public.staff_time_off enable row level security;
create policy staff_time_off_select on public.staff_time_off for select to authenticated using (is_staff());
create policy staff_time_off_insert on public.staff_time_off for insert to authenticated with check (profile_id = auth.uid() or is_admin());
create policy staff_time_off_update on public.staff_time_off for update to authenticated using (profile_id = auth.uid() or is_admin()) with check (profile_id = auth.uid() or is_admin());
create policy staff_time_off_delete on public.staff_time_off for delete to authenticated using (profile_id = auth.uid() or is_admin());

-- ---------- appointments: who it's with, and no double booking ----------
alter table public.appointments add column if not exists staff_id uuid references public.profiles(id) on delete set null;
create unique index if not exists appointments_staff_slot_unique
  on public.appointments (staff_id, appt_date, appt_time)
  where staff_id is not null and status <> 'cancelled';

-- ---------- open slots ----------
create or replace function public.staff_open_slots(p_staff uuid, p_from date, p_days int)
returns table (slot_date date, slot_time text)
language sql stable security definer set search_path = public
as $$
  with prof as (
    select id, lower(email) as email from public.profiles where id = p_staff and active = true
  ),
  days as (
    select (p_from + g)::date as d from generate_series(0, least(greatest(coalesce(p_days, 1), 1), 62) - 1) g
  ),
  windows as (
    select days.d, a.start_time, a.end_time
    from days join public.staff_availability a
      on a.profile_id = p_staff and a.weekday = extract(dow from days.d)::int
  ),
  slots as (
    select w.d, gs::time as t
    from windows w,
      generate_series(w.d + w.start_time, w.d + w.end_time - interval '30 minutes', interval '30 minutes') gs
  )
  select distinct s.d, to_char(s.t, 'HH24:MI')
  from slots s, prof
  where (s.d + s.t) > (now() at time zone 'America/New_York')
    and not exists (
      select 1 from public.staff_time_off o
      where o.profile_id = p_staff and s.d between o.start_date and o.end_date
    )
    and not exists (
      select 1 from public.appointments ap
      where ap.appt_date = s.d and ap.appt_time = to_char(s.t, 'HH24:MI') and ap.status <> 'cancelled'
        and (ap.staff_id = p_staff or lower(ap.assigned_email) = prof.email)
    )
  order by 1, 2;
$$;
revoke all on function public.staff_open_slots(uuid, date, int) from public;
grant execute on function public.staff_open_slots(uuid, date, int) to anon, authenticated;

-- Who clients can book with: active logins that have added hours. Names and
-- roles only -- the same fields staff_directory already shows publicly.
create or replace function public.bookable_staff()
returns table (id uuid, name text, role text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.role
  from public.profiles p
  where p.active = true and exists (select 1 from public.staff_availability a where a.profile_id = p.id)
  order by p.name;
$$;
revoke all on function public.bookable_staff() from public;
grant execute on function public.bookable_staff() to anon, authenticated;

-- ---------- booking ----------
-- Public: validates every field, confirms the slot is still open, and holds
-- it as a 'requested' appointment (the unique index above settles a race
-- between two people picking the same slot). Raises 'slot_taken' if it's gone.
create or replace function public.book_staff_appointment(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_staff uuid := nullif(p->>'staff_id', '')::uuid;
  v_date date := nullif(p->>'date', '')::date;
  v_time text := btrim(coalesce(p->>'time', ''));
  v_first text := btrim(coalesce(p->>'first_name', ''));
  v_last text := btrim(coalesce(p->>'last_name', ''));
  v_phone text := nullif(btrim(coalesce(p->>'phone', '')), '');
  v_email text := nullif(lower(btrim(coalesce(p->>'email', ''))), '');
  v_reason text := nullif(btrim(coalesce(p->>'reason', '')), '');
  v_prof public.profiles;
begin
  if v_first = '' or v_last = '' or v_phone is null then raise exception 'missing required fields'; end if;
  if length(v_first) > 80 or length(v_last) > 80 or length(v_phone) > 30
     or length(coalesce(v_email, '')) > 200 or length(coalesce(v_reason, '')) > 1000 then
    raise exception 'field too long';
  end if;
  if v_staff is null or v_date is null or v_time !~ '^\d{2}:\d{2}$' then raise exception 'missing slot'; end if;

  select * into v_prof from public.profiles where id = v_staff and active = true;
  if not found then raise exception 'unknown staff'; end if;

  if not exists (select 1 from public.staff_open_slots(v_staff, v_date, 1) s where s.slot_date = v_date and s.slot_time = v_time) then
    raise exception 'slot_taken';
  end if;

  begin
    insert into public.appointments (first_name, last_name, phone, email, appt_date, appt_time, reason,
                                     assigned_email, meeting_with, status, source, staff_id)
    values (v_first, v_last, v_phone, v_email, v_date, v_time, v_reason, v_prof.email,
            case when v_prof.role in ('case_manager', 'job_developer') then v_prof.role else null end,
            'requested', 'client', v_staff);
  exception when unique_violation then
    raise exception 'slot_taken';
  end;
end;
$$;
revoke all on function public.book_staff_appointment(jsonb) from public;
grant execute on function public.book_staff_appointment(jsonb) to anon, authenticated;

alter publication supabase_realtime add table public.staff_availability, public.staff_time_off;
