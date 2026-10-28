-- New clients can register themselves for Case Management (public /register
-- page: a link / QR code on their own phone, or the front-desk kiosk) instead
-- of waiting for staff to type them in. Staff then complete the full intake
-- form with them, so a self-registered client is flagged `needs_intake` until
-- a case manager marks it done.
--
-- At the front-desk kiosk the same registration also checks the person in
-- (a `visits` row for Case Management, like "I'm a Visitor" would), so they
-- show up in today's visitors and can check out -- one form, both records.

alter table public.case_clients add column if not exists source text not null default 'staff';
alter table public.case_clients drop constraint if exists case_clients_source_check;
alter table public.case_clients add constraint case_clients_source_check check (source in ('staff', 'self'));
alter table public.case_clients add column if not exists needs_intake boolean not null default false;
-- The language the client chose on the form (en / ht / fr, same codes as LANGS in
-- src/lib/constants.js), so staff know which language to contact them in.
alter table public.case_clients add column if not exists preferred_language text;
alter table public.case_clients drop constraint if exists case_clients_preferred_language_check;
alter table public.case_clients add constraint case_clients_preferred_language_check check (preferred_language is null or preferred_language in ('en', 'ht', 'fr'));

-- Anonymous callers can't read or write clients/case_clients (RLS is
-- staff-only), so the public form goes through this one security-definer
-- function. It validates everything itself, only ever inserts, and returns
-- nothing -- so it can't be used to look up whether someone is a client.
create or replace function public.public_register_case_client(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first text := btrim(coalesce(p->>'first_name', ''));
  v_last text := btrim(coalesce(p->>'last_name', ''));
  v_phone text := nullif(btrim(coalesce(p->>'phone', '')), '');
  v_email text := nullif(lower(btrim(coalesce(p->>'email', ''))), '');
  v_street text := nullif(btrim(coalesce(p->>'street', '')), '');
  v_city text := nullif(btrim(coalesce(p->>'city', '')), '');
  v_zip text := nullif(btrim(coalesce(p->>'zip', '')), '');
  v_status text := nullif(btrim(coalesce(p->>'immigration_status', '')), '');
  v_lang text := nullif(btrim(coalesce(p->>'preferred_language', '')), '');
  v_check_in boolean := coalesce((p->>'check_in')::boolean, false);
  v_visit_date date;
  v_time_in timestamptz;
  v_dob date;
  v_services text[];
  v_digits text;
  v_client_id uuid;
begin
  if v_first = '' or v_last = '' then raise exception 'first and last name are required'; end if;
  if v_phone is null then raise exception 'phone is required'; end if;
  if length(v_first) > 80 or length(v_last) > 80 or length(v_phone) > 30
     or length(coalesce(v_email, '')) > 200 or length(coalesce(v_street, '')) > 200
     or length(coalesce(v_city, '')) > 100 or length(coalesce(v_zip, '')) > 15 then
    raise exception 'field too long';
  end if;
  v_digits := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if length(v_digits) < 7 or length(v_digits) > 15 then raise exception 'invalid phone'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;

  if nullif(p->>'dob', '') is not null then
    v_dob := (p->>'dob')::date;
    if v_dob > current_date or v_dob < date '1900-01-01' then raise exception 'invalid date of birth'; end if;
  end if;

  -- Same keys as IMMIGRATION_STATUSES / CASE_SERVICES in src/lib/constants.js.
  if v_status is not null and v_status not in ('tps', 'humanitarian_parole', 'permanent_resident', 'citizen', 'no_legal_status', 'pending_case') then
    v_status := null;
  end if;
  if v_lang is not null and v_lang not in ('en', 'ht', 'fr') then v_lang := null; end if;
  if v_check_in then
    -- The kiosk sends its own local date/time (as kiosk_create_visit callers
    -- do) so an evening sign-up isn't filed under tomorrow's UTC date; only
    -- accept values close to now.
    v_visit_date := coalesce(nullif(p->>'visit_date', '')::date, current_date);
    v_time_in := coalesce(nullif(p->>'time_in', '')::timestamptz, now());
    if abs(v_visit_date - current_date) > 1 or abs(extract(epoch from (v_time_in - now()))) > 86400 then
      raise exception 'invalid check-in time';
    end if;
  end if;
  select coalesce(array_agg(distinct s), '{}') into v_services
  from jsonb_array_elements_text(coalesce(p->'services', '[]'::jsonb)) s
  where s in ('referrals', 'benefits', 'childcare', 'education', 'employment', 'housing', 'immigration', 'primary_care', 'transportation', 'insurance');

  -- Reuse the master client record when the same person is already on file
  -- (same name and same phone number), as staff would via the duplicate check.
  select c.id into v_client_id
  from public.clients c
  where lower(btrim(c.first_name)) = lower(v_first)
    and lower(btrim(c.last_name)) = lower(v_last)
    and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = v_digits
  order by c.created_at
  limit 1;

  if v_client_id is null then
    insert into public.clients (first_name, last_name, phone, email, dob, street, city, zip, intake_date)
    values (v_first, v_last, v_phone, v_email, v_dob, v_street, v_city, v_zip, current_date)
    returning id into v_client_id;
  end if;

  if exists (select 1 from public.case_clients where client_id = v_client_id) then
    -- Already a Case Management client: just ask staff to follow up.
    update public.case_clients set needs_intake = true, preferred_language = coalesce(v_lang, preferred_language) where client_id = v_client_id;
  else
    insert into public.case_clients (client_id, first_name, last_name, phone, email, street, city, zip, intake_date, immigration_status, dob, services, source, needs_intake, preferred_language)
    values (v_client_id, v_first, v_last, v_phone, v_email, v_street, v_city, v_zip, current_date, v_status, v_dob, v_services, 'self', true, v_lang);
  end if;

  if v_check_in then
    insert into public.visits (first_name, last_name, phone, email, street, city, state, zip, service, staff, notes, visit_date, time_in)
    values (v_first, v_last, v_phone, v_email, v_street, v_city, 'RI', v_zip, 'case_manager', 'case_manager',
            'New client registration (kiosk)', v_visit_date, v_time_in);
  end if;
end;
$$;

revoke execute on function public.public_register_case_client(jsonb) from public;
grant execute on function public.public_register_case_client(jsonb) to anon, authenticated;
