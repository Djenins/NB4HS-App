-- Stage 0 security hardening, part A of 2 -- ADDITIVE ONLY
-- (plans/snap-outreach-architecture.md §2). APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026061431).
--
-- Rollout order (each step is safe on its own):
--   1. apply this migration  -- new is_staff() helper + kiosk_* RPCs, new
--                               signups start inactive; nothing existing
--                               loses access, so the current app keeps working
--   2. deploy the app from this branch (kiosk switches to the RPCs)
--   3. apply part B (..._stage0b_tighten_policies.sql)
--
-- Self-signup can no longer mint working accounts: every new profile starts
-- inactive (has_role/is_admin/is_staff all require active), so a role
-- requested in signup metadata grants nothing until an administrator
-- reviews it and activates the account on the Users page.

-- ============ helper ============
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active = true);
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ============ signup ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'staff');
begin
  if requested not in ('administrator', 'staff', 'receptionist', 'case_manager', 'job_developer') then
    requested := 'staff';
  end if;
  insert into public.profiles (id, name, email, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, requested, false);
  return new;
end;
$$;

-- ============ kiosk RPCs ============
-- Who is checked in right now (names, so people can tap themselves out), plus
-- today's student check-ins *without* names (only to stop double check-ins).
-- No phone/email/address ever leaves this function.
create or replace function public.kiosk_visits(p_visit_date date)
returns table (id uuid, first_name text, last_name text, visit_date date, time_in timestamptz,
               time_out timestamptz, student_id uuid, class_name text)
language sql stable security definer set search_path = public
as $$
  select v.id,
         case when v.time_out is null then v.first_name end,
         case when v.time_out is null then v.last_name end,
         v.visit_date, v.time_in, v.time_out, v.student_id, v.class_name
  from public.visits v
  where v.time_out is null or (v.visit_date = p_visit_date and v.student_id is not null);
$$;

-- The class rosters the student kiosk shows: names only.
create or replace function public.kiosk_roster()
returns table (id uuid, first_name text, last_name text, class_key text)
language sql stable security definer set search_path = public
as $$
  select s.id, s.first_name, s.last_name, s.class_key
  from public.students s
  where s.active and s.class_key is not null;
$$;

create or replace function public.public_visit_count()
returns bigint
language sql stable security definer set search_path = public
as $$
  select count(*) from public.visits;
$$;

-- Visitor self check-in. Returns the caller's own row (needed for the
-- success screen); never accepts id/time_out/student_id from the client.
create or replace function public.kiosk_create_visit(p_visit jsonb)
returns public.visits
language plpgsql security definer set search_path = public
as $$
declare
  created public.visits;
begin
  insert into public.visits (first_name, last_name, phone, email, street, city, state, zip, service,
                             service_other, staff, staff_other, notes, visit_date, time_in, class_name)
  values (p_visit->>'first_name', p_visit->>'last_name', p_visit->>'phone', p_visit->>'email',
          p_visit->>'street', p_visit->>'city', coalesce(p_visit->>'state', 'RI'), p_visit->>'zip',
          p_visit->>'service', p_visit->>'service_other', p_visit->>'staff', p_visit->>'staff_other',
          p_visit->>'notes', coalesce((p_visit->>'visit_date')::date, current_date),
          coalesce((p_visit->>'time_in')::timestamptz, now()), p_visit->>'class_name')
  returning * into created;
  return created;
end;
$$;

-- Student tap-in. Contact details are copied server-side from `students`
-- (the kiosk no longer receives them); only the new visit id comes back.
-- The (student_id, visit_date) unique index still raises 23505 on a repeat.
create or replace function public.kiosk_student_check_in(p_student_id uuid, p_visit_date date)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  s public.students;
  c public.classes;
  new_id uuid;
begin
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

revoke all on function public.kiosk_visits(date) from public;
revoke all on function public.kiosk_roster() from public;
revoke all on function public.public_visit_count() from public;
revoke all on function public.kiosk_create_visit(jsonb) from public;
revoke all on function public.kiosk_student_check_in(uuid, date) from public;
grant execute on function public.kiosk_visits(date) to anon, authenticated;
grant execute on function public.kiosk_roster() to anon, authenticated;
grant execute on function public.public_visit_count() to anon, authenticated;
grant execute on function public.kiosk_create_visit(jsonb) to anon, authenticated;
grant execute on function public.kiosk_student_check_in(uuid, date) to anon, authenticated;

-- ============ advisor housekeeping ============
-- Student enrollment is a staff action (Students page), never the kiosk.
revoke execute on function public.create_student(jsonb, jsonb, uuid) from anon, public;
-- Trigger bodies don't need EXECUTE for the caller; nobody should call them as RPCs.
revoke execute on function public.notify_appointment_assignment() from anon, authenticated, public;
revoke execute on function public.prevent_self_role_escalation() from anon, authenticated, public;
