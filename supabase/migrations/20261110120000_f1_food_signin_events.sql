-- f1 -- sign-up ahead of a food distribution, sign-in on the day.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-11-10 (version 20261110120000) after
-- a rolled-back dry run on live, then recorded in the migration history;
-- supabase/tests/f1_food_signin_check.sql passed against live afterwards
-- (rolled back, nothing kept). Undo with
-- supabase/rollback/f1_food_signin_events_down.sql.
--
-- Staff create a distribution event (Thanksgiving, Christmas, ...) in Food
-- Distribution > Sign-in Forms. Its id -- a random uuid -- is the public
-- sign-up link / QR code (/food-signup/<id>).
--
-- 1. Sign-up (public, before the day): first and last name, phone, address
--    with apartment/unit, household size. The person is matched to the
--    master client record by name + phone (as /register does) or a new one
--    is made, and to their Food Distribution household (food_clients).
--    ONE SIGN-UP PER ADDRESS per event: the street and unit are normalised
--    (case, punctuation, "Street"/"St", "Apt 2"/"#2", ...) into address_key,
--    which is unique within the event.
-- 2. Sign-in (staff, on the day): staff find the person by name or phone,
--    they sign on the tablet, and food_signup_pickup() stores the signature,
--    marks the pickup and logs it in food_distributions, so reports count it.
--
--   food_signin_events  read            food_distribution.view, or participants.view
--                       create / change / remove
--                                       food_distribution.distributions.record, or participants.edit
--   food_signups        read            food_distribution.view, or participants.view
--                       remove          food_distribution.distributions.record, or participants.edit
--                       add             only through public_food_signup()
--                       pick up         only through food_signup_pickup() / food_signup_undo_pickup()

create table public.food_signin_events (
  id uuid primary key default gen_random_uuid(),
  occasion text not null default 'general'
    check (occasion in ('general', 'thanksgiving', 'christmas', 'easter', 'backToSchool', 'monthly', 'custom')),
  custom_occasion text not null default '' check (char_length(custom_occasion) <= 60),
  event_date date,
  location text not null default '' check (char_length(location) <= 80),
  lang text not null default 'en+ht' check (lang in ('en', 'ht', 'fr', 'en+ht', 'en+fr')),
  -- Whether the public sign-up link still takes sign-ups.
  is_open boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- "12 Main Street, Apt. 2" and "12 main st #2" are the same household.
-- Street and unit only: city and ZIP are often left out or spelled
-- differently, and one distribution serves one area.
create or replace function public.food_address_key(p_street text, p_unit text)
returns text
language plpgsql immutable set search_path = public
as $$
declare
  s text := lower(coalesce(p_street, ''));
  u text := lower(coalesce(p_unit, ''));
  m text[];
begin
  -- A unit typed into the street line ("12 Main St Apt 2") moves to the unit.
  m := regexp_match(s, '\s*(?:,\s*)?(?:apartment|apt|unit|suite|ste|#)\.?\s*#?\s*([a-z0-9-]+)\s*$');
  if m is not null and u = '' then
    u := m[1];
    s := regexp_replace(s, '\s*(?:,\s*)?(?:apartment|apt|unit|suite|ste|#)\.?\s*#?\s*([a-z0-9-]+)\s*$', '');
  end if;
  s := regexp_replace(s, '[^a-z0-9]+', ' ', 'g');
  s := ' ' || btrim(s) || ' ';
  s := replace(s, ' street ', ' st ');
  s := replace(s, ' avenue ', ' ave ');
  s := replace(s, ' av ', ' ave ');
  s := replace(s, ' road ', ' rd ');
  s := replace(s, ' drive ', ' dr ');
  s := replace(s, ' boulevard ', ' blvd ');
  s := replace(s, ' lane ', ' ln ');
  s := replace(s, ' court ', ' ct ');
  s := replace(s, ' place ', ' pl ');
  s := replace(s, ' terrace ', ' ter ');
  s := replace(s, ' parkway ', ' pkwy ');
  s := replace(s, ' highway ', ' hwy ');
  s := replace(s, ' circle ', ' cir ');
  s := replace(s, ' north ', ' n ');
  s := replace(s, ' south ', ' s ');
  s := replace(s, ' east ', ' e ');
  s := replace(s, ' west ', ' w ');
  s := regexp_replace(btrim(s), '\s+', ' ', 'g');
  u := regexp_replace(u, '(apartment|apt|unit|suite|ste|floor|fl|#|\.)', '', 'g');
  u := regexp_replace(u, '[^a-z0-9]+', '', 'g');
  if s = '' then return null; end if;
  return s || '|' || u;
end;
$$;

create table public.food_signups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.food_signin_events (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  food_client_id uuid references public.food_clients (id) on delete set null,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 80),
  last_name text not null check (char_length(btrim(last_name)) between 1 and 80),
  phone text not null check (char_length(phone) <= 30),
  street text not null check (char_length(btrim(street)) between 1 and 200),
  unit text not null default '' check (char_length(unit) <= 20),
  city text not null default '' check (char_length(city) <= 100),
  zip text not null default '' check (char_length(zip) <= 15),
  household_size text not null default '' check (household_size in ('', '1', '2', '3', '4', '5', '6+')),
  address_key text not null,
  signed_up_at timestamptz not null default now(),
  -- Filled in on the day by food_signup_pickup().
  picked_up_at timestamptz,
  picked_up_by uuid references auth.users (id) on delete set null,
  signature text check (signature is null or (signature like 'data:image/png;base64,%' and char_length(signature) <= 300000)),
  distribution_id uuid references public.food_distributions (id) on delete set null
);
create unique index food_signups_event_address_uniq on public.food_signups (event_id, address_key);
create unique index food_signups_event_client_uniq on public.food_signups (event_id, client_id) where client_id is not null;
create index food_signups_event_idx on public.food_signups (event_id, signed_up_at);

alter table public.food_signin_events enable row level security;
alter table public.food_signups enable row level security;
revoke all on public.food_signin_events, public.food_signups from anon;
-- Pickups only go through the functions below.
revoke insert, update on public.food_signups from authenticated;

create policy food_signin_events_select on public.food_signin_events for select to authenticated
  using ((select public.has_permission_at('food_distribution.view', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.view', 'program')));
create policy food_signin_events_insert on public.food_signin_events for insert to authenticated
  with check ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy food_signin_events_update on public.food_signin_events for update to authenticated
  using ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.edit', 'program')))
  with check ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy food_signin_events_delete on public.food_signin_events for delete to authenticated
  using ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.edit', 'program')));

create policy food_signups_select on public.food_signups for select to authenticated
  using ((select public.has_permission_at('food_distribution.view', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.view', 'program')));
create policy food_signups_delete on public.food_signups for delete to authenticated
  using ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.edit', 'program')));

-- The public page's heading: what's printed at the top of the paper form.
-- Null for an unknown id. Volatile so the rate limit can record the call.
create or replace function public.public_food_event(p_id uuid)
returns jsonb
language sql volatile security definer set search_path = public
as $$
  select jsonb_build_object('occasion', e.occasion, 'custom_occasion', e.custom_occasion,
                            'event_date', e.event_date, 'location', e.location,
                            'lang', e.lang, 'is_open', e.is_open)
  from public.food_signin_events e where e.id = p_id;
$$;
revoke all on function public.public_food_event(uuid) from public;
grant execute on function public.public_food_event(uuid) to anon, authenticated;

-- Sign up for an open event. Answers with a status instead of raising for
-- the expected outcomes (the rate limit only counts calls that succeed):
--   {"status": "ok"}                 signed up
--   {"status": "already"}            this person (name + phone) already is
--   {"status": "duplicate_address"}  another sign-up has this address
--   {"status": "closed"}             sign-up is closed (or no such event)
-- Bad input raises 22023. Nothing is created unless the sign-up is.
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
  v_digits text := regexp_replace(coalesce(p->>'phone', ''), '[^0-9]', '', 'g');
  v_key text;
  v_client_id uuid;
  v_food_id uuid;
begin
  if not exists (select 1 from public.food_signin_events where id = p_event and is_open) then
    return jsonb_build_object('status', 'closed');
  end if;
  if v_first = '' or v_last = '' or v_street = '' or length(v_digits) < 7 or length(v_digits) > 15
     or char_length(v_first) > 80 or char_length(v_last) > 80 or char_length(v_phone) > 30
     or char_length(v_street) > 200 or char_length(v_unit) > 20 or char_length(v_city) > 100
     or char_length(v_zip) > 15 or v_size not in ('', '1', '2', '3', '4', '5', '6+') then
    raise exception 'invalid sign-up' using errcode = '22023';
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
                                     household_size, address_key)
    values (p_event, v_client_id, v_food_id, v_first, v_last, v_phone, v_street, v_unit, v_city, v_zip, v_size, v_key);
  exception when unique_violation then
    -- Someone else got there in the same instant; undo this block's inserts.
    if exists (select 1 from public.food_signups where event_id = p_event and client_id = v_client_id) then
      return jsonb_build_object('status', 'already');
    end if;
    return jsonb_build_object('status', 'duplicate_address');
  end;
  return jsonb_build_object('status', 'ok');
end;
$$;
revoke all on function public.public_food_signup(uuid, jsonb) from public;
grant execute on function public.public_food_signup(uuid, jsonb) to anon, authenticated;

create or replace function public.food_signup_can_record()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution')
         or public.has_permission_at('participants.edit', 'program');
$$;
revoke all on function public.food_signup_can_record() from public, anon;
grant execute on function public.food_signup_can_record() to authenticated;

-- On the day: the client signed on the tablet. Stores the signature, marks
-- the pickup and logs it as a distribution for their household. p_items is
-- what goes in the pickup log's "Items given" (the form's title).
create or replace function public.food_signup_pickup(p_signup uuid, p_signature text, p_items text)
returns public.food_signups
language plpgsql security definer set search_path = public
as $$
declare
  s public.food_signups;
  v_dist uuid;
begin
  if not public.food_signup_can_record() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' or char_length(p_signature) > 300000 then
    raise exception 'invalid signature' using errcode = '22023';
  end if;
  select * into s from public.food_signups where id = p_signup for update;
  if not found then raise exception 'no such sign-up' using errcode = 'P0002'; end if;
  if s.picked_up_at is not null then raise exception 'already picked up' using errcode = '23505'; end if;
  if s.food_client_id is not null then
    insert into public.food_distributions (food_client_id, visit_date, items)
    values (s.food_client_id, current_date, left(coalesce(nullif(btrim(p_items), ''), 'Food distribution'), 200))
    returning id into v_dist;
  end if;
  update public.food_signups
     set picked_up_at = now(), picked_up_by = auth.uid(), signature = p_signature, distribution_id = v_dist
   where id = p_signup
  returning * into s;
  return s;
end;
$$;
revoke all on function public.food_signup_pickup(uuid, text, text) from public, anon;
grant execute on function public.food_signup_pickup(uuid, text, text) to authenticated;

-- Undo a pickup marked by mistake: removes the logged distribution too.
create or replace function public.food_signup_undo_pickup(p_signup uuid)
returns public.food_signups
language plpgsql security definer set search_path = public
as $$
declare
  s public.food_signups;
begin
  if not public.food_signup_can_record() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into s from public.food_signups where id = p_signup for update;
  if not found then raise exception 'no such sign-up' using errcode = 'P0002'; end if;
  if s.distribution_id is not null then delete from public.food_distributions where id = s.distribution_id; end if;
  update public.food_signups
     set picked_up_at = null, picked_up_by = null, signature = null, distribution_id = null
   where id = p_signup
  returning * into s;
  return s;
end;
$$;
revoke all on function public.food_signup_undo_pickup(uuid) from public, anon;
grant execute on function public.food_signup_undo_pickup(uuid) to authenticated;

-- A sign-up drive on one office Wi-Fi (or one tablet) shares an IP, so
-- these are generous; a script flooding one event is still cut off.
insert into public.api_rate_limits (rpc, per_hour) values
  ('public_food_event', 1200), ('public_food_signup', 300)
on conflict (rpc) do update set per_hour = excluded.per_hour;

-- Staff screens refresh as sign-ups and pickups happen.
alter publication supabase_realtime add table public.food_signups;
