-- Undo k1_kiosk_devices: the kiosk lists open to every caller again (the
-- pre-k1 definitions, from stage0a/t3), phone student check-in and tablet
-- pairing gone. Paired tablets keep working, since nothing checks their key.

create or replace function public.kiosk_roster()
returns table (id uuid, first_name text, last_name text, class_key text)
language sql security definer set search_path = public
as $$
  select s.id, s.first_name, s.last_name, s.class_key
  from public.students s
  where s.active and s.class_key is not null;
$$;

create or replace function public.kiosk_visits(p_visit_date date)
returns table (id uuid, first_name text, last_name text, visit_date date, time_in timestamptz,
               time_out timestamptz, student_id uuid, class_name text)
language sql security definer set search_path = public
as $$
  select v.id,
         case when v.time_out is null then v.first_name end,
         case when v.time_out is null then v.last_name end,
         v.visit_date, v.time_in, v.time_out, v.student_id, v.class_name
  from public.visits v
  where v.time_out is null or (v.visit_date = p_visit_date and v.student_id is not null);
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

delete from public.api_rate_limits where rpc in ('kiosk_student_self_check_in', 'public_student_count');

drop function if exists public.public_student_count();
drop function if exists public.kiosk_student_self_check_in(text, text, text, date);
drop function if exists public.admin_kiosk_devices();
drop function if exists public.admin_revoke_kiosk_device(uuid);
drop function if exists public.admin_create_kiosk_device(text);
drop function if exists public.kiosk_lists_allowed();
drop function if exists public.kiosk_device_ok();
drop table if exists public.kiosk_devices;
