-- f2 -- food distribution programs, a sign-up limit, and the SNAP questions.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-11-10 (version 20261112090000) after
-- a rolled-back dry run on live with supabase/tests/f2_food_programs_check.sql;
-- the f1 checks passed against live afterwards (rolled back, nothing kept).
-- Undo with supabase/rollback/f2_food_programs_snap_down.sql.
--
-- 1. Every distribution (food_signin_events) belongs to a program, and each
--    program has its own form:
--      regular  the form plus two SNAP questions
--      cdbg     the form as it was (CDBG-funded distributions)
--    Events that exist already become 'regular'. Another program is a new
--    value in the check below plus its entry in lib/foodSignInForm.js.
-- 2. signup_limit: online sign-up stops at this many sign-ups (null = no
--    limit). public_food_signup() answers {"status": "full"} once it's
--    reached; the event row is locked while counting, so two people can't
--    take the last place at once.
-- 3. The Regular form asks "Do you have SNAP?" and, only when the answer is
--    no, "Do you want to apply for SNAP?". A yes to the second goes to the
--    SNAP outreach team for an eligibility follow-up:
--      * the person becomes (or stays) an Outreach SNAP contact, marked
--        follow-up needed, source 'event';
--      * a follow-up task "SNAP eligibility follow-up: <name>" is created,
--        due in two days, assigned to the contact's worker if they have one;
--      * that worker -- or, with no worker, every active SNAP team member --
--        gets a notification linking to SNAP > Follow-ups.
--    The answers are stored on the sign-up (has_snap, wants_snap_help) and
--    the task on snap_task_id.
-- The server only checks that answers are valid and consistent; the page
-- makes them required.

alter table public.food_signin_events
  add column program text not null default 'regular' check (program in ('regular', 'cdbg')),
  add column signup_limit integer check (signup_limit is null or signup_limit between 1 and 10000);

alter table public.food_signups
  add column has_snap text not null default '' check (has_snap in ('', 'yes', 'no')),
  add column wants_snap_help text not null default '' check (wants_snap_help in ('', 'yes', 'no')),
  add column snap_task_id uuid references public.tasks (id) on delete set null,
  add constraint food_signups_snap_answers check (wants_snap_help = '' or has_snap = 'no');

-- The public page's heading, now with the program and whether it's full.
create or replace function public.public_food_event(p_id uuid)
returns jsonb
language sql volatile security definer set search_path = public
as $$
  select jsonb_build_object('occasion', e.occasion, 'custom_occasion', e.custom_occasion,
                            'event_date', e.event_date, 'location', e.location,
                            'lang', e.lang, 'is_open', e.is_open, 'program', e.program,
                            'is_full', e.signup_limit is not null
                                       and (select count(*) from public.food_signups s where s.event_id = e.id) >= e.signup_limit)
  from public.food_signin_events e where e.id = p_id;
$$;
revoke all on function public.public_food_event(uuid) from public;
grant execute on function public.public_food_event(uuid) to anon, authenticated;

-- A "yes, I want to apply for SNAP" from a sign-up: hand it to the SNAP
-- outreach team. Returns the follow-up task's id.
create or replace function public.food_signup_snap_referral(p_signup uuid, p_lang text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  s public.food_signups;
  ev public.food_signin_events;
  v_contact public.outreach_contacts;
  v_task uuid;
  v_name text;
  v_title text;
begin
  select * into s from public.food_signups where id = p_signup;
  if not found or s.client_id is null then return null; end if;
  select * into ev from public.food_signin_events where id = s.event_id;
  v_name := btrim(s.first_name || ' ' || s.last_name);
  v_title := case ev.occasion
               when 'custom' then nullif(btrim(ev.custom_occasion), '')
               when 'general' then null
               when 'backToSchool' then 'Back-to-School'
               else initcap(ev.occasion)
             end;

  insert into public.outreach_contacts (program, client_id, preferred_language, outreach_source, follow_up_status)
  values ('snap', s.client_id, case when p_lang in ('en', 'ht', 'fr') then p_lang end, 'event', 'needed')
  on conflict (program, client_id) do update
    set status = 'active',
        follow_up_status = case when outreach_contacts.follow_up_status = 'scheduled' then 'scheduled' else 'needed' end
  returning * into v_contact;

  insert into public.tasks (program, title, description, assigned_to, due_date, client_id, source, automation_key,
                            subject_type, subject_id)
  values ('snap',
          left('SNAP eligibility follow-up: ' || v_name, 200),
          left('Signed up for the ' || coalesce(v_title || ' ', '') || 'food distribution'
               || case when ev.event_date is not null then ' on ' || to_char(ev.event_date, 'FMMonth FMDD, YYYY') else '' end
               || ' and asked to apply for SNAP. Phone: ' || s.phone
               || '. Address: ' || concat_ws(', ', s.street, nullif(s.unit, ''), nullif(btrim(s.city || ' ' || s.zip), ''))
               || coalesce('. Household size: ' || nullif(s.household_size, ''), '') || '.', 1000),
          v_contact.assigned_to,
          (now() at time zone 'America/New_York')::date + 2,
          s.client_id, 'automation', 'food_signup_snap:' || s.id,
          'food_signup', s.id)
  on conflict (automation_key) do nothing
  returning id into v_task;
  if v_task is null then
    select id into v_task from public.tasks where automation_key = 'food_signup_snap:' || s.id;
    return v_task;
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  select p.id, 'snap_referral', 'SNAP follow-up needed',
         left(v_name || ' signed up for a food distribution and wants to apply for SNAP.', 300), '/snap/tasks'
  from public.profiles p
  where p.active
    and (p.id = v_contact.assigned_to
         or (v_contact.assigned_to is null
             and exists (select 1 from public.program_staff ps
                         where ps.user_id = p.id and ps.program = 'snap' and ps.active)));
  return v_task;
end;
$$;
revoke all on function public.food_signup_snap_referral(uuid, text) from public, anon, authenticated;

-- Sign up for an open event. Statuses as in f1, plus:
--   {"status": "full"}  the event's sign-up limit is reached
-- p may carry has_snap / wants_snap_help ('yes' | 'no') and lang (the
-- page's language, kept as the SNAP contact's preferred language).
create or replace function public.public_food_signup(p_event uuid, p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_first text := btrim(coalesce(p->>'first_name', ''));
  v_last text := btrim(coalesce(p->>'last_name', ''));
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_street text := btrim(coalesce(p->>'street', ''));
  v_unit text := btrim(coalesce(p->>'unit', ''));
  v_city text := btrim(coalesce(p->>'city', ''));
  v_zip text := btrim(coalesce(p->>'zip', ''));
  v_size text := btrim(coalesce(p->>'household_size', ''));
  v_has_snap text := btrim(coalesce(p->>'has_snap', ''));
  v_wants text := btrim(coalesce(p->>'wants_snap_help', ''));
  v_digits text := regexp_replace(coalesce(p->>'phone', ''), '[^0-9]', '', 'g');
  v_key text;
  v_client_id uuid;
  v_food_id uuid;
  v_signup uuid;
  ev public.food_signin_events;
begin
  -- Locked so the limit is counted one sign-up at a time.
  select * into ev from public.food_signin_events where id = p_event for update;
  if not found or not ev.is_open then
    return jsonb_build_object('status', 'closed');
  end if;
  if v_first = '' or v_last = '' or v_street = '' or length(v_digits) < 7 or length(v_digits) > 15
     or char_length(v_first) > 80 or char_length(v_last) > 80 or char_length(v_phone) > 30
     or char_length(v_street) > 200 or char_length(v_unit) > 20 or char_length(v_city) > 100
     or char_length(v_zip) > 15 or v_size not in ('', '1', '2', '3', '4', '5', '6+')
     or v_has_snap not in ('', 'yes', 'no') or v_wants not in ('', 'yes', 'no')
     or (v_wants <> '' and v_has_snap <> 'no') then
    raise exception 'invalid sign-up' using errcode = '22023';
  end if;
  -- Only the Regular form asks about SNAP.
  if ev.program <> 'regular' then
    v_has_snap := '';
    v_wants := '';
  end if;
  v_key := public.food_address_key(v_street, v_unit);
  if v_key is null then raise exception 'invalid sign-up' using errcode = '22023'; end if;

  -- The same person already on file: same name and phone number.
  select c.id into v_client_id
  from public.clients c
  where lower(btrim(c.first_name)) = lower(v_first)
    and lower(btrim(c.last_name)) = lower(v_last)
    and regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') = v_digits
  order by c.created_at
  limit 1;

  if v_client_id is not null and exists (select 1 from public.food_signups where event_id = p_event and client_id = v_client_id) then
    return jsonb_build_object('status', 'already');
  end if;
  if exists (select 1 from public.food_signups where event_id = p_event and address_key = v_key) then
    return jsonb_build_object('status', 'duplicate_address');
  end if;
  if ev.signup_limit is not null
     and (select count(*) from public.food_signups where event_id = p_event) >= ev.signup_limit then
    return jsonb_build_object('status', 'full');
  end if;

  begin
    if v_client_id is null then
      insert into public.clients (first_name, last_name, phone, street, city, zip, intake_date)
      values (v_first, v_last, v_phone, nullif(concat_ws(' ', v_street, nullif(v_unit, '')), ''), nullif(v_city, ''), nullif(v_zip, ''), current_date)
      returning id into v_client_id;
    end if;
    select id into v_food_id from public.food_clients where client_id = v_client_id order by created_at limit 1;
    if v_food_id is null then
      insert into public.food_clients (client_id, first_name, last_name, phone, street, city, zip, intake_date, household_size)
      values (v_client_id, v_first, v_last, v_phone, concat_ws(' ', v_street, nullif(v_unit, '')), nullif(v_city, ''), nullif(v_zip, ''),
              current_date, nullif(v_size, ''))
      returning id into v_food_id;
    end if;
    insert into public.food_signups (event_id, client_id, food_client_id, first_name, last_name, phone, street, unit, city, zip,
                                     household_size, address_key, has_snap, wants_snap_help)
    values (p_event, v_client_id, v_food_id, v_first, v_last, v_phone, v_street, v_unit, v_city, v_zip, v_size, v_key,
            v_has_snap, v_wants)
    returning id into v_signup;
  exception when unique_violation then
    -- Someone else got there in the same instant; undo this block's inserts.
    if exists (select 1 from public.food_signups where event_id = p_event and client_id = v_client_id) then
      return jsonb_build_object('status', 'already');
    end if;
    return jsonb_build_object('status', 'duplicate_address');
  end;

  if v_wants = 'yes' then
    update public.food_signups
       set snap_task_id = public.food_signup_snap_referral(v_signup, p->>'lang')
     where id = v_signup;
  end if;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.public_food_signup(uuid, jsonb) from public;
grant execute on function public.public_food_signup(uuid, jsonb) to anon, authenticated;
