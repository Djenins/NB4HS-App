-- Checks for f2_food_signup_short_codes. Run AFTER the migration; ends by
-- raising 'F2_CHECKS_PASSED', so nothing is committed. Uses a throwaway account.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  ev uuid;
  code text;
  j jsonb;
begin
  if exists (select 1 from public.food_signin_events where short_code is null) then raise exception 'event without a code'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.food_signin_events (occasion) values ('christmas') returning id, short_code into ev, code;
  reset role;
  if code !~ '^[2-9a-hjkmnp-z]{5}$' then raise exception 'bad code: %', code; end if;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_food_event_code(code);
  if (j->>'id')::uuid <> ev or j->>'occasion' <> 'christmas' then raise exception 'lookup wrong: %', j; end if;
  j := public.public_food_event_code(' ' || upper(code) || ' ');
  if (j->>'id')::uuid <> ev then raise exception 'lookup should ignore case and spaces'; end if;
  if public.public_food_event_code('zzzzz') is not null and code <> 'zzzzz' then raise exception 'unknown code found an event'; end if;
  begin
    perform 1 from public.food_signin_events;
    raise exception 'anon read the events table';
  exception when insufficient_privilege then null;
  end;
  reset role;

  begin
    update public.food_signin_events set short_code = 'BAD!' where id = ev;
    raise exception 'bad code accepted';
  exception when check_violation then null;
  end;

  raise exception 'F2_CHECKS_PASSED';
end $$;
