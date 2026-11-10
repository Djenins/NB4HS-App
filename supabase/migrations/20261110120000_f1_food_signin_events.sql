-- f1 -- online sign-in for food distributions.
-- NOT YET APPLIED to live. Tested on the local stack with
-- supabase/tests/f1_food_signin_check.sql. Undo with
-- supabase/rollback/f1_food_signin_events_down.sql.
--
-- Staff create a sign-in event for a distribution (Thanksgiving, Christmas,
-- ...) from Food Distribution > Sign-in Forms. Its id -- a random uuid --
-- is the public link / QR code (/food-signin/<id>), where clients type their
-- name, address and phone and sign with a finger. Staff see the list and
-- print it as a filled sign-in sheet.
--
-- Anyone with the link can read the event's title fields and add a sign-in
-- while it's open; nobody signed out can read a sign-in back. Both public
-- functions are throttled per caller IP (api_rate_limits, t6).
--
--   food_signin_events  read            food_distribution.view, or participants.view
--                       create / change / remove
--                                       food_distribution.distributions.record, or participants.edit
--   food_signins        read            food_distribution.view, or participants.view
--                       remove          food_distribution.distributions.record, or participants.edit
--                       add             only through public_food_signin()

create table public.food_signin_events (
  id uuid primary key default gen_random_uuid(),
  occasion text not null default 'general'
    check (occasion in ('general', 'thanksgiving', 'christmas', 'easter', 'backToSchool', 'monthly', 'custom')),
  custom_occasion text not null default '' check (char_length(custom_occasion) <= 60),
  event_date date,
  location text not null default '' check (char_length(location) <= 80),
  lang text not null default 'en+ht' check (lang in ('en', 'ht', 'fr', 'en+ht', 'en+fr')),
  is_open boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.food_signins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.food_signin_events (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text not null default '' check (char_length(address) <= 200),
  phone text not null default '' check (char_length(phone) <= 30),
  -- The drawn signature as a PNG data URL (SignaturePad.toDataURL()).
  signature text not null check (signature like 'data:image/png;base64,%' and char_length(signature) <= 300000),
  created_at timestamptz not null default now()
);
create index food_signins_event_idx on public.food_signins (event_id, created_at);

alter table public.food_signin_events enable row level security;
alter table public.food_signins enable row level security;
revoke all on public.food_signin_events, public.food_signins from anon;

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

create policy food_signins_select on public.food_signins for select to authenticated
  using ((select public.has_permission_at('food_distribution.view', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.view', 'program')));
create policy food_signins_delete on public.food_signins for delete to authenticated
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

-- Add one sign-in to an open event. Returns nothing a caller could use to
-- read the list back.
create or replace function public.public_food_signin(p_event uuid, p jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p->>'name', ''));
  v_address text := btrim(coalesce(p->>'address', ''));
  v_phone text := btrim(coalesce(p->>'phone', ''));
  v_sig text := coalesce(p->>'signature', '');
begin
  if not exists (select 1 from public.food_signin_events where id = p_event and is_open) then
    raise exception 'this sign-in is closed' using errcode = 'P0002';
  end if;
  if v_name = '' or char_length(v_name) > 120 or char_length(v_address) > 200
     or (v_phone <> '' and v_phone !~ '^[0-9()+.\s-]{7,20}$')
     or v_sig not like 'data:image/png;base64,%' or char_length(v_sig) > 300000 then
    raise exception 'invalid sign-in' using errcode = '22023';
  end if;
  insert into public.food_signins (event_id, name, address, phone, signature)
  values (p_event, v_name, v_address, v_phone, v_sig);
end;
$$;
revoke all on function public.public_food_signin(uuid, jsonb) from public;
grant execute on function public.public_food_signin(uuid, jsonb) to anon, authenticated;

-- A distribution line on one office Wi-Fi (or one tablet) shares an IP, so
-- these are generous; a script flooding one event is still cut off.
insert into public.api_rate_limits (rpc, per_hour) values
  ('public_food_event', 1200), ('public_food_signin', 400)
on conflict (rpc) do update set per_hour = excluded.per_hour;

-- Staff screens refresh when a sign-in arrives.
alter publication supabase_realtime add table public.food_signins;
