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
  sig text := 'data:image/png;base64,iVBORw0KGgo=';
begin
  -- Staff create an event.
  perform pg_temp.as_user(admin);
  set local role authenticated;
  insert into public.food_signin_events (occasion, event_date) values ('thanksgiving', current_date) returning id into ev;
  reset role;

  -- Anyone can read the heading and sign in.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_food_event(ev);
  if j->>'occasion' <> 'thanksgiving' or (j->>'is_open')::boolean is not true then raise exception 'event heading wrong: %', j; end if;
  if public.public_food_event(gen_random_uuid()) is not null then raise exception 'unknown event should be null'; end if;
  perform public.public_food_signin(ev, jsonb_build_object('name', 'Marie Jean', 'address', '1 Main St', 'phone', '401-555-0100', 'signature', sig));

  -- ... but can't read sign-ins back or write the tables directly.
  begin
    perform count(*) from public.food_signins;
    raise exception 'anon read food_signins';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.food_signins (event_id, name, signature) values (ev, 'x', sig);
    raise exception 'anon inserted food_signins';
  exception when insufficient_privilege then null;
  end;

  -- Bad input is refused.
  begin
    perform public.public_food_signin(ev, jsonb_build_object('name', '', 'signature', sig));
    raise exception 'empty name accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.public_food_signin(ev, jsonb_build_object('name', 'A', 'signature', 'javascript:alert(1)'));
    raise exception 'bad signature accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.public_food_signin(ev, jsonb_build_object('name', 'A', 'phone', 'call me', 'signature', sig));
    raise exception 'bad phone accepted';
  exception when invalid_parameter_value then null;
  end;
  reset role;

  -- Closed events take no more sign-ins.
  update public.food_signin_events set is_open = false where id = ev;
  set local role anon;
  begin
    perform public.public_food_signin(ev, jsonb_build_object('name', 'Late', 'signature', sig));
    raise exception 'closed event accepted a sign-in';
  exception when no_data_found then null;
  end;
  reset role;

  -- Staff see the one sign-in.
  perform pg_temp.as_user(admin);
  set local role authenticated;
  select count(*) into n from public.food_signins where event_id = ev;
  if n <> 1 then raise exception 'staff should see 1 sign-in, saw %', n; end if;
  reset role;

  raise exception 'F1_CHECKS_PASSED';
end $$;
