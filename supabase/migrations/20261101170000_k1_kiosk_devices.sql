-- k1 -- only paired front-desk tablets see the kiosk name lists
-- (security audit 2026-11-01, finding 1: plans/security-audit-2026-11.md).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-11-01 (version 20261101170000) from
-- the SQL Editor, then recorded in the migration history; every object was
-- confirmed present on live afterwards. Tested on the local stack with
-- supabase/tests/k1_kiosk_devices_check.sql. Undo with
-- supabase/rollback/k1_kiosk_devices_down.sql.
--
-- Kiosk mode is "nobody signed in", and the anon key ships in the app, so
-- until now anyone on the internet could call kiosk_roster() (every active
-- student's name and class) and kiosk_visits() (everyone checked in and not
-- yet out), and check students in by the ids the roster handed back.
--
-- Now:
--   * An administrator pairs each front-desk tablet once from System
--     Settings. The tablet keeps a random device key and sends it on every
--     request as the x-kiosk-key header; only its SHA-256 is stored here.
--   * kiosk_roster, kiosk_visits and kiosk_student_check_in need a paired
--     tablet, or signed-in staff with front-desk check-in or check-out.
--   * A phone from the check-in poster stays unpaired and never sees a name:
--     visitors still use kiosk_create_visit (write-only; its date and time
--     are now held close to now for callers who aren't staff or a tablet),
--     students use kiosk_student_self_check_in (name plus the last four
--     digits of their phone), and the phone checks out only the visits it
--     made itself, by id (check_out_visit, unchanged: a visit id is a random
--     uuid nobody else is handed any more).

create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null
);
-- Nobody reads or writes the table directly: the functions below do.
alter table public.kiosk_devices enable row level security;
revoke all on public.kiosk_devices from public, anon, authenticated;

-- Is this request from a paired, unrevoked tablet? Reads the x-kiosk-key
-- header PostgREST hands every request. Records when the tablet was last
-- seen, at most every five minutes so its 30-second polls don't each write.
create or replace function public.kiosk_device_ok()
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  hdrs json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  k text := nullif(btrim(hdrs->>'x-kiosk-key'), '');
  d public.kiosk_devices;
begin
  if k is null or k !~ '^[0-9a-f]{64}$' then
    return false;
  end if;
  select * into d from public.kiosk_devices
  where key_hash = encode(extensions.digest(k, 'sha256'), 'hex') and revoked_at is null;
  if not found then
    return false;
  end if;
  if d.last_seen_at is null or d.last_seen_at < now() - interval '5 minutes' then
    update public.kiosk_devices set last_seen_at = now() where id = d.id;
  end if;
  return true;
end;
$$;
revoke all on function public.kiosk_device_ok() from public, anon, authenticated;

-- A paired tablet, or staff who check people in or out.
create or replace function public.kiosk_lists_allowed()
returns boolean
language sql security definer set search_path = public
as $$
  select public.kiosk_device_ok()
      or (auth.uid() is not null
          and (public.has_permission('front_desk.checkin') or public.has_permission('front_desk.checkout')));
$$;
revoke all on function public.kiosk_lists_allowed() from public, anon, authenticated;

create or replace function public.kiosk_roster()
returns table (id uuid, first_name text, last_name text, class_key text)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.kiosk_lists_allowed() then
    raise exception 'this device is not a paired kiosk' using errcode = '42501';
  end if;
  return query
  select s.id, s.first_name, s.last_name, s.class_key
  from public.students s
  where s.active and s.class_key is not null;
end;
$$;

create or replace function public.kiosk_visits(p_visit_date date)
returns table (id uuid, first_name text, last_name text, visit_date date, time_in timestamptz,
               time_out timestamptz, student_id uuid, class_name text)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.kiosk_lists_allowed() then
    raise exception 'this device is not a paired kiosk' using errcode = '42501';
  end if;
  return query
  select v.id,
         case when v.time_out is null then v.first_name end,
         case when v.time_out is null then v.last_name end,
         v.visit_date, v.time_in, v.time_out, v.student_id, v.class_name
  from public.visits v
  where v.time_out is null or (v.visit_date = p_visit_date and v.student_id is not null);
end;
$$;

create or replace function public.kiosk_student_check_in(p_student_id uuid, p_visit_date date)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  s public.students;
  c public.classes;
  new_id uuid;
begin
  if not public.kiosk_lists_allowed() then
    raise exception 'this device is not a paired kiosk' using errcode = '42501';
  end if;
  select * into s from public.students where id = p_student_id and active;
  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;
  select * into c from public.classes where key = s.class_key;
  insert into public.visits (first_name, last_name, phone, email, street, city, state, zip, service,
                             staff, visit_date, time_in, student_id, class_name)
  values (s.first_name, s.last_name, nullif(s.phone, ''), nullif(s.email, ''), nullif(s.street, ''),
          nullif(s.city, ''), coalesce(nullif(s.state, ''), 'RI'), nullif(s.zip, ''),
          coalesce(c.service, 'adult_education'), coalesce(c.staff, 'esl_instructor'),
          p_visit_date, now(), s.id, c.name)
  returning id into new_id;
  return new_id;
end;
$$;

-- Visitor check-in stays open to phones. For a caller who is neither a
-- paired tablet nor signed-in staff, the date and time are held within a day
-- of now (as public_register_case_client already does), so nobody can file
-- visits into past or future reports.
create or replace function public.kiosk_create_visit(p_visit jsonb)
returns public.visits
language plpgsql security definer set search_path = public
as $$
declare
  created public.visits;
  v_date date := coalesce((p_visit->>'visit_date')::date, current_date);
  v_time timestamptz := coalesce((p_visit->>'time_in')::timestamptz, now());
begin
  if not (public.kiosk_device_ok() or public.is_staff())
     and (abs(v_date - current_date) > 1 or abs(extract(epoch from (v_time - now()))) > 86400) then
    raise exception 'invalid check-in time' using errcode = '22008';
  end if;
  insert into public.visits (first_name, last_name, phone, email, street, city, state, zip, service,
                             service_other, staff, staff_other, notes, visit_date, time_in, class_name)
  values (p_visit->>'first_name', p_visit->>'last_name', p_visit->>'phone', p_visit->>'email',
          p_visit->>'street', p_visit->>'city', coalesce(p_visit->>'state', 'RI'), p_visit->>'zip',
          p_visit->>'service', p_visit->>'service_other', p_visit->>'staff', p_visit->>'staff_other',
          p_visit->>'notes', v_date, v_time, p_visit->>'class_name')
  returning * into created;
  return created;
end;
$$;

-- Student check-in from a phone: first and last name plus the last four
-- digits of the phone number on file. Answers with a status instead of
-- raising, because the rate limit only counts calls that succeed: a guess
-- that raised would roll its own count back and never be throttled.
--   {"status": "ok", "visit": {...}}  checked in; the phone keeps the visit
--                                      so it can check out later
--   {"status": "not_found"}           no single active student matches
--   {"status": "already"}             already checked in today
create or replace function public.kiosk_student_self_check_in(p_first_name text, p_last_name text,
                                                              p_phone_last4 text, p_visit_date date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_first text := lower(btrim(coalesce(p_first_name, '')));
  v_last text := lower(btrim(coalesce(p_last_name, '')));
  v_last4 text := regexp_replace(coalesce(p_phone_last4, ''), '[^0-9]', '', 'g');
  v_date date := coalesce(p_visit_date, current_date);
  v_ids uuid[];
  s public.students;
  c public.classes;
  v public.visits;
begin
  if v_first = '' or v_last = '' or length(v_last4) <> 4
     or length(v_first) > 80 or length(v_last) > 80 or abs(v_date - current_date) > 1 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select array_agg(st.id) into v_ids
  from public.students st
  where st.active and st.class_key is not null
    and lower(btrim(st.first_name)) = v_first
    and lower(btrim(st.last_name)) = v_last
    and right(regexp_replace(coalesce(st.phone, ''), '[^0-9]', '', 'g'), 4) = v_last4;
  if coalesce(array_length(v_ids, 1), 0) <> 1 then
    return jsonb_build_object('status', 'not_found');
  end if;
  select * into s from public.students where id = v_ids[1];
  if exists (select 1 from public.visits where student_id = s.id and visit_date = v_date) then
    return jsonb_build_object('status', 'already');
  end if;
  select * into c from public.classes where key = s.class_key;
  begin
    insert into public.visits (first_name, last_name, phone, email, street, city, state, zip, service,
                               staff, visit_date, time_in, student_id, class_name)
    values (s.first_name, s.last_name, nullif(s.phone, ''), nullif(s.email, ''), nullif(s.street, ''),
            nullif(s.city, ''), coalesce(nullif(s.state, ''), 'RI'), nullif(s.zip, ''),
            coalesce(c.service, 'adult_education'), coalesce(c.staff, 'esl_instructor'),
            v_date, now(), s.id, c.name)
    returning * into v;
  exception when unique_violation then
    return jsonb_build_object('status', 'already');
  end;
  return jsonb_build_object('status', 'ok', 'visit', jsonb_build_object(
    'id', v.id, 'first_name', v.first_name, 'last_name', v.last_name,
    'visit_date', v.visit_date, 'time_in', v.time_in, 'student_id', v.student_id, 'class_name', v.class_name));
end;
$$;
revoke all on function public.kiosk_student_self_check_in(text, text, text, date) from public;
grant execute on function public.kiosk_student_self_check_in(text, text, text, date) to anon, authenticated;

-- A class on the office Wi-Fi shares one address, so this allows a full
-- class; a stranger guessing four digits for one name gets 120 tries an hour.
insert into public.api_rate_limits (rpc, per_hour) values ('kiosk_student_self_check_in', 120)
on conflict (rpc) do update set per_hour = excluded.per_hour;

-- The welcome page's "Students Enrolled" figure used to be counted from the
-- whole roster, loaded by every signed-out browser. A bare count instead,
-- like public_visit_count().
create or replace function public.public_student_count()
returns bigint
language sql security definer set search_path = public
as $$
  select count(*) from public.students where active and class_key is not null;
$$;
revoke all on function public.public_student_count() from public;
grant execute on function public.public_student_count() to anon, authenticated;
insert into public.api_rate_limits (rpc, per_hour) values ('public_student_count', 600)
on conflict (rpc) do update set per_hour = excluded.per_hour;

-- ---- Pairing (System Settings, admin.settings.manage) ----

-- Pairs the device that calls it. Hands the key back exactly once; only its
-- hash is kept.
create or replace function public.admin_create_kiosk_device(p_name text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_key text := encode(extensions.gen_random_bytes(32), 'hex');
  v_name text := btrim(coalesce(p_name, ''));
  d public.kiosk_devices;
begin
  perform public.admin_require('admin.settings.manage');
  if char_length(v_name) not between 1 and 80 then
    raise exception 'give the tablet a name (up to 80 characters)' using errcode = '22023';
  end if;
  insert into public.kiosk_devices (name, key_hash, created_by)
  values (v_name, encode(extensions.digest(v_key, 'sha256'), 'hex'), auth.uid())
  returning * into d;
  insert into public.audit_events (actor_id, action, table_name, record_id, new_values, reason)
  values (auth.uid(), 'insert', 'kiosk_devices', d.id::text, jsonb_build_object('name', d.name), 'Paired a kiosk tablet');
  return jsonb_build_object('id', d.id, 'name', d.name, 'key', v_key);
end;
$$;
revoke all on function public.admin_create_kiosk_device(text) from public, anon;
grant execute on function public.admin_create_kiosk_device(text) to authenticated;

create or replace function public.admin_revoke_kiosk_device(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  d public.kiosk_devices;
begin
  perform public.admin_require('admin.settings.manage');
  update public.kiosk_devices set revoked_at = now(), revoked_by = auth.uid()
  where id = p_id and revoked_at is null
  returning * into d;
  if not found then
    raise exception 'no paired tablet with that id' using errcode = 'P0002';
  end if;
  insert into public.audit_events (actor_id, action, table_name, record_id, new_values, reason)
  values (auth.uid(), 'update', 'kiosk_devices', d.id::text, jsonb_build_object('name', d.name, 'revoked_at', d.revoked_at), 'Unpaired a kiosk tablet');
end;
$$;
revoke all on function public.admin_revoke_kiosk_device(uuid) from public, anon;
grant execute on function public.admin_revoke_kiosk_device(uuid) to authenticated;

create or replace function public.admin_kiosk_devices()
returns table (id uuid, name text, created_at timestamptz, created_by_name text,
               last_seen_at timestamptz, revoked_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.admin_require('admin.settings.manage');
  return query
  select d.id, d.name, d.created_at, p.name, d.last_seen_at, d.revoked_at
  from public.kiosk_devices d
  left join public.profiles p on p.id = d.created_by
  order by d.revoked_at is not null, d.created_at desc;
end;
$$;
revoke all on function public.admin_kiosk_devices() from public, anon;
grant execute on function public.admin_kiosk_devices() to authenticated;
