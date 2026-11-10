-- Undo f2_food_programs_snap: back to f1's sign-up functions, and drop the
-- program, limit and SNAP columns (their answers are lost; SNAP contacts and
-- follow-up tasks already created stay).
drop function if exists public.food_signup_snap_referral(uuid, text);
alter table public.food_signups
  drop constraint if exists food_signups_snap_answers,
  drop column if exists snap_task_id,
  drop column if exists wants_snap_help,
  drop column if exists has_snap;
alter table public.food_signin_events
  drop column if exists signup_limit,
  drop column if exists program;

-- f1's versions:
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
