-- Checks for f2_food_programs_snap. Run AFTER the migration; ends by raising
-- 'F2_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
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
  snap_worker uuid := pg_temp.dryrun_account('staff');
  ev uuid;
  ev_cdbg uuid;
  j jsonb;
  s public.food_signups;
  tk public.tasks;
  n int;
begin
  insert into public.program_staff (program, user_id, program_role, active) values ('snap', snap_worker, 'worker', true);
  insert into public.food_signin_events (occasion, event_date, signup_limit, created_by)
  values ('thanksgiving', date '2026-11-26', 3, admin) returning id into ev;
  insert into public.food_signin_events (occasion, program, created_by)
  values ('general', 'cdbg', admin) returning id into ev_cdbg;

  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_food_event(ev);
  if j->>'program' <> 'regular' or (j->>'is_full')::boolean then raise exception 'heading: %', j; end if;
  if public.public_food_event(ev_cdbg)->>'program' <> 'cdbg' then raise exception 'cdbg heading'; end if;

  -- Has SNAP.
  j := public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Has","phone":"4015550181","street":"1 Zz St","has_snap":"yes"}');
  if j->>'status' <> 'ok' then raise exception 'has snap: %', j; end if;
  -- No SNAP, wants to apply -> SNAP referral.
  j := public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Wants","phone":"4015550182","street":"2 Zz St","unit":"4","household_size":"5","has_snap":"no","wants_snap_help":"yes","lang":"ht"}');
  if j->>'status' <> 'ok' then raise exception 'wants snap: %', j; end if;
  -- "Want to apply" without "no SNAP" is inconsistent.
  begin
    perform public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Bad","phone":"4015550183","street":"3 Zz St","has_snap":"yes","wants_snap_help":"yes"}');
    raise exception 'inconsistent answers accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Bad","phone":"4015550183","street":"3 Zz St","has_snap":"maybe"}');
    raise exception 'bad answer accepted';
  exception when invalid_parameter_value then null;
  end;
  -- Third place: no, doesn't want to apply.
  j := public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Declines","phone":"4015550184","street":"4 Zz St","has_snap":"no","wants_snap_help":"no"}');
  if j->>'status' <> 'ok' then raise exception 'third: %', j; end if;
  -- Limit of 3 reached.
  j := public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Late","phone":"4015550185","street":"5 Zz St","has_snap":"yes"}');
  if j->>'status' <> 'full' then raise exception 'limit: %', j; end if;
  if not (public.public_food_event(ev)->>'is_full')::boolean then raise exception 'is_full not set'; end if;
  -- An existing sign-up still hears "already", not "full".
  j := public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Has","phone":"401-555-0181","street":"1 Zz St"}');
  if j->>'status' <> 'already' then raise exception 'already when full: %', j; end if;
  -- CDBG ignores SNAP answers.
  j := public.public_food_signup(ev_cdbg, '{"first_name":"Zzsnap","last_name":"Cdbg","phone":"4015550186","street":"6 Zz St","has_snap":"no","wants_snap_help":"yes"}');
  if j->>'status' <> 'ok' then raise exception 'cdbg: %', j; end if;
  -- anon can't call the referral directly.
  begin
    perform public.food_signup_snap_referral(gen_random_uuid(), 'en');
    raise exception 'anon ran referral';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select * into s from public.food_signups where event_id = ev and last_name = 'Has';
  if s.has_snap <> 'yes' or s.wants_snap_help <> '' or s.snap_task_id is not null then raise exception 'has-snap row: %', row_to_json(s); end if;
  select * into s from public.food_signups where event_id = ev_cdbg;
  if s.has_snap <> '' or s.snap_task_id is not null then raise exception 'cdbg stored snap answers'; end if;
  select count(*) into n from public.tasks where automation_key like 'food_signup_snap:%'
    and client_id in (select client_id from public.food_signups where event_id in (ev, ev_cdbg) and last_name <> 'Wants');
  if n <> 0 then raise exception 'unexpected referral tasks: %', n; end if;

  select * into s from public.food_signups where event_id = ev and last_name = 'Wants';
  if s.has_snap <> 'no' or s.wants_snap_help <> 'yes' or s.snap_task_id is null then raise exception 'wants row: %', row_to_json(s); end if;
  select * into tk from public.tasks where id = s.snap_task_id;
  if tk.program <> 'snap' or tk.status <> 'open' or tk.client_id <> s.client_id or tk.title <> 'SNAP eligibility follow-up: Zzsnap Wants'
     or tk.due_date is null or tk.description not like '%Thanksgiving food distribution on November 26, 2026%' then
    raise exception 'task: %', row_to_json(tk);
  end if;
  if not exists (select 1 from public.outreach_contacts where program = 'snap' and client_id = s.client_id
                 and follow_up_status = 'needed' and outreach_source = 'event' and preferred_language = 'ht') then
    raise exception 'snap contact missing';
  end if;
  if not exists (select 1 from public.notifications where user_id = snap_worker and type = 'snap_referral' and link = '/snap/tasks'
                 and message like 'Zzsnap Wants %') then
    raise exception 'snap team not notified';
  end if;
  if exists (select 1 from public.notifications where user_id = admin and type = 'snap_referral') then
    raise exception 'non-SNAP staff notified';
  end if;

  -- Staff can change the limit; the event reopens for sign-ups.
  update public.food_signin_events set signup_limit = 4 where id = ev;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  j := public.public_food_signup(ev, '{"first_name":"Zzsnap","last_name":"Late","phone":"4015550185","street":"5 Zz St","has_snap":"yes"}');
  if j->>'status' <> 'ok' then raise exception 'after raising limit: %', j; end if;
  reset role;

  raise exception 'F2_CHECKS_PASSED';
end $$;
