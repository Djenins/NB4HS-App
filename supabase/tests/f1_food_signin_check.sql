-- Checks for f1_food_signin_events. Run AFTER the migration; ends by raising
-- 'F1_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;
create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated',
    'email', 'dryrun-' || p_uid || '@example.invalid')::text, true);
end $f$;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  ev uuid;
  n int;
  j jsonb;
  s public.food_signups;
  sig text := 'data:image/png;base64,iVBORw0KGgo=';
  person jsonb := '{"first_name":"Dryrun","last_name":"Zzfood","phone":"(401) 555-0199","street":"12 Main Street","unit":"Apt. 2","city":"Providence","household_size":"3"}';
begin
  -- Address keys: same household however it's typed; different units differ.
  if public.food_address_key('12 Main Street, Apt. 2', '') <> public.food_address_key('12 MAIN ST', '#2') then raise exception 'address key: unit in street'; end if;
  if public.food_address_key('45 North Avenue', 'Unit 3B') <> public.food_address_key('45 n. ave', 'apt 3b') then raise exception 'address key: abbreviations'; end if;
  if public.food_address_key('12 Main St', '2') = public.food_address_key('12 Main St', '3') then raise exception 'address key: units should differ'; end if;

  perform pg_temp.as_user(admin);
  set local role authenticated;
  insert into public.food_signin_events (occasion, event_date) values ('thanksgiving', current_date) returning id into ev;
  reset role;

  -- Public sign-up.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_food_event(ev);
  if j->>'occasion' <> 'thanksgiving' then raise exception 'event heading wrong: %', j; end if;
  if public.public_food_event(gen_random_uuid()) is not null then raise exception 'unknown event should be null'; end if;
  j := public.public_food_signup(ev, person);
  if j->>'status' <> 'ok' then raise exception 'first sign-up: %', j; end if;
  -- Same person again (phone typed differently).
  j := public.public_food_signup(ev, person || '{"phone":"401.555.0199"}');
  if j->>'status' <> 'already' then raise exception 'repeat sign-up: %', j; end if;
  -- Someone else at the same address, typed differently.
  j := public.public_food_signup(ev, '{"first_name":"Other","last_name":"Zzfood","phone":"4015550198","street":"12 main st #2"}');
  if j->>'status' <> 'duplicate_address' then raise exception 'duplicate address: %', j; end if;
  -- Same building, different unit, is fine.
  j := public.public_food_signup(ev, '{"first_name":"Neighbor","last_name":"Zzfood","phone":"4015550197","street":"12 Main St","unit":"3"}');
  if j->>'status' <> 'ok' then raise exception 'other unit: %', j; end if;

  -- Can't read sign-ups back or call the staff functions.
  begin
    perform count(*) from public.food_signups;
    raise exception 'anon read food_signups';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.food_signup_pickup(gen_random_uuid(), sig, 'x');
    raise exception 'anon ran pickup';
  exception when insufficient_privilege then null;
  end;
  -- Bad input.
  begin
    perform public.public_food_signup(ev, '{"first_name":"A","last_name":"B","phone":"12","street":"1 X St"}');
    raise exception 'bad phone accepted';
  exception when invalid_parameter_value then null;
  end;
  reset role;

  -- The household was matched/created and linked.
  select count(*) into n from public.food_signups su join public.food_clients fc on fc.id = su.food_client_id
   where su.event_id = ev and fc.household_size = '3';
  if n <> 1 then raise exception 'household not linked (%)', n; end if;

  -- Closed: no more sign-ups.
  update public.food_signin_events set is_open = false where id = ev;
  set local role anon;
  j := public.public_food_signup(ev, '{"first_name":"Late","last_name":"Zzfood","phone":"4015550196","street":"99 Elm St"}');
  if j->>'status' <> 'closed' then raise exception 'closed event: %', j; end if;
  reset role;

  -- Staff: see both sign-ups, can't write the table directly, pick up via the function.
  perform pg_temp.as_user(admin);
  set local role authenticated;
  select count(*) into n from public.food_signups where event_id = ev;
  if n <> 2 then raise exception 'staff should see 2 sign-ups, saw %', n; end if;
  begin
    update public.food_signups set picked_up_at = now() where event_id = ev;
    raise exception 'staff updated food_signups directly';
  exception when insufficient_privilege then null;
  end;
  select * into s from public.food_signups where event_id = ev and first_name = 'Dryrun';
  s := public.food_signup_pickup(s.id, sig, 'Thanksgiving Food Distribution');
  if s.picked_up_at is null or s.distribution_id is null then raise exception 'pickup not recorded'; end if;
  if not exists (select 1 from public.food_distributions where id = s.distribution_id and food_client_id = s.food_client_id) then raise exception 'distribution not logged'; end if;
  begin
    perform public.food_signup_pickup(s.id, sig, 'x');
    raise exception 'double pickup accepted';
  exception when unique_violation then null;
  end;
  s := public.food_signup_undo_pickup(s.id);
  if s.picked_up_at is not null or s.signature is not null then raise exception 'undo failed'; end if;
  reset role;

  raise exception 'F1_CHECKS_PASSED';
end $$;
