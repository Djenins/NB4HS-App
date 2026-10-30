-- Checks for t8_rate_limit_hardening. Run AFTER the migration; ends by raising
-- 'T8_CHECKS_PASSED', so nothing is committed. Like the t6 check, it sets
-- PostgREST's request settings and calls api_pre_request() the way PostgREST
-- does. Concurrency is covered separately by t8_rate_limit_concurrency.sh,
-- which needs several connections.
do $$
declare
  state text;
  inactive_id uuid := gen_random_uuid();
  active_id uuid := gen_random_uuid();
begin
  if current_setting('request.path', true) is not null and current_setting('request.path', true) <> '' then
    raise exception 'run this outside an API request';
  end if;

  -- Shape.
  if not exists (select 1 from cron.job where jobname = 'api-rate-hits-cleanup'
                 and command like '%delete from public.api_rate_hits where at < now() - interval ''1 hour''%') then
    raise exception 'FAIL: no cleanup job for api_rate_hits';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'api_rate_hits_at_idx') then
    raise exception 'FAIL: no index on api_rate_hits.at';
  end if;
  if (select per_hour from public.api_rate_limits where rpc = 'kiosk_roster') < 3600
     or (select per_hour from public.api_rate_limits where rpc = 'kiosk_visits') < 3600 then
    raise exception 'FAIL: kiosk poll limits still fit only ten pages per site';
  end if;
  if has_function_privilege('anon', 'public.api_rate_caller(json)', 'EXECUTE') then
    raise exception 'FAIL: api_rate_caller is callable from the API';
  end if;

  -- Caller address.
  if public.api_rate_caller('{"cf-connecting-ip":"198.51.100.7","x-forwarded-for":"10.9.9.9"}') <> '198.51.100.7' then
    raise exception 'FAIL: cf-connecting-ip must win';
  end if;
  if public.api_rate_caller('{"x-forwarded-for":"6.6.6.6, 192.0.2.44"}') <> '192.0.2.44' then
    raise exception 'FAIL: without Cloudflare, the last x-forwarded-for hop (the proxy''s) must be used, not the client''s first entry';
  end if;
  if public.api_rate_caller('{"cf-connecting-ip":"2001:db8:aa:bb:1:2:3:4"}') <> public.api_rate_caller('{"cf-connecting-ip":"2001:db8:aa:bb:ffff::9"}')
     or public.api_rate_caller('{"cf-connecting-ip":"2001:db8:aa:bb:1:2:3:4"}') <> '2001:db8:aa:bb::/64' then
    raise exception 'FAIL: IPv6 callers in one /64 must share a count';
  end if;
  if public.api_rate_caller('{"cf-connecting-ip":"2001:db8:aa:bb::1"}') = public.api_rate_caller('{"cf-connecting-ip":"2001:db8:aa:cc::1"}') then
    raise exception 'FAIL: different /64s must not share a count';
  end if;
  if public.api_rate_caller('{}') <> 'unknown' or public.api_rate_caller('{"cf-connecting-ip":"not-an-ip"}') <> 'unknown' then
    raise exception 'FAIL: a missing or malformed address must fall into "unknown"';
  end if;

  -- Throwaway accounts: one inactive (a self-sign-up), one active.
  insert into auth.users (id, email, raw_user_meta_data) values
    (inactive_id, 't8-inactive-' || inactive_id || '@example.invalid', '{}'),
    (active_id, 't8-active-' || active_id || '@example.invalid', '{}');
  if (select active from public.profiles where id = inactive_id) then
    raise exception 'FAIL: a new sign-up should start inactive';
  end if;
  update public.profiles set role = 'staff', active = true, name = 'Dry run staff' where id = active_id;

  update public.api_rate_limits set per_hour = 2 where rpc = 'request_appointment';
  perform set_config('request.method', 'POST', true);
  perform set_config('request.path', '/rpc/request_appointment', true);
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.70"}', true);

  -- An inactive signed-in account is throttled like a signed-out caller.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', inactive_id)::text, true);
  perform public.api_pre_request();
  perform public.api_pre_request();
  begin perform public.api_pre_request(); state := null;
  exception when others then get stacked diagnostics state = returned_sqlstate; end;
  if state is distinct from 'PT429' then raise exception 'FAIL: an inactive account skipped the throttle (%)', state; end if;

  -- An active staff account and the service role are not, even from that IP.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', active_id)::text, true);
  perform public.api_pre_request();
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform public.api_pre_request();

  -- A signed-out caller from that IP is over the limit too (one shared count).
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.api_pre_request(); state := null;
  exception when others then get stacked diagnostics state = returned_sqlstate; end;
  if state is distinct from 'PT429' then raise exception 'FAIL: signed-out caller not refused (%)', state; end if;

  -- The cleanup job's statement removes rows from every key, not just the caller's.
  insert into public.api_rate_hits (key, at) values ('kiosk_roster:192.0.2.1', now() - interval '2 hours'),
                                                    ('kiosk_roster:192.0.2.2', now() - interval '61 minutes'),
                                                    ('kiosk_roster:192.0.2.3', now() - interval '5 minutes');
  delete from public.api_rate_hits where at < now() - interval '1 hour';
  if exists (select 1 from public.api_rate_hits where key in ('kiosk_roster:192.0.2.1', 'kiosk_roster:192.0.2.2'))
     or not exists (select 1 from public.api_rate_hits where key = 'kiosk_roster:192.0.2.3') then
    raise exception 'FAIL: the cleanup statement is wrong';
  end if;

  -- Unlisted paths are untouched.
  perform set_config('request.path', '/students', true);
  perform public.api_pre_request();

  perform set_config('request.path', '', true);
  raise exception 'T8_CHECKS_PASSED';
end $$;
