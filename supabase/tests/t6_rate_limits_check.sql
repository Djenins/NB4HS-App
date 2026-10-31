-- Checks for t6_public_rate_limits. Run AFTER the migration; ends by raising
-- 'T6_CHECKS_PASSED', so nothing is committed. Simulates PostgREST's request
-- settings and calls api_pre_request() the way PostgREST does before each
-- request. (The HTTP path itself was tested through the local API: 429 past
-- the limit, 405 on GET, signed-in callers untouched.)
do $$
declare
  i int;
  msg text;
  state text;
  hardened boolean := to_regprocedure('public.api_rate_caller(json)') is not null;
begin
  if current_setting('request.path', true) is not null and current_setting('request.path', true) <> '' then
    raise exception 'run this outside an API request';
  end if;
  -- Shape.
  if (select count(*) from public.api_rate_limits) <> 13 then raise exception 'FAIL: expected 13 limited functions'; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.provolatile <> 'v'
               and p.proname in (select rpc from public.api_rate_limits)) then
    raise exception 'FAIL: a limited function is not VOLATILE (PostgREST would run it read-only)';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator'
                 and 'pgrst.db_pre_request=public.api_pre_request' = any (rolconfig)) then
    raise exception 'FAIL: PostgREST is not set to call api_pre_request()';
  end if;
  if has_table_privilege('anon', 'public.api_rate_hits', 'SELECT') or has_table_privilege('authenticated', 'public.api_rate_limits', 'UPDATE') then
    raise exception 'FAIL: the limit tables are reachable from the API';
  end if;

  update public.api_rate_limits set per_hour = 3 where rpc = 'request_appointment';
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.method', 'POST', true);
  perform set_config('request.path', '/rpc/request_appointment', true);
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7","x-forwarded-for":"10.0.0.1"}', true);

  -- Up to the limit: fine. One more: 429.
  for i in 1..3 loop perform public.api_pre_request(); end loop;
  begin perform public.api_pre_request(); state := null;
  exception when others then get stacked diagnostics state = returned_sqlstate; msg := sqlerrm; end;
  if state is distinct from 'PT429' then raise exception 'FAIL: the 4th call was not refused with PT429 (%)', state; end if;

  -- Another IP has its own count; cf-connecting-ip wins over x-forwarded-for.
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.8","x-forwarded-for":"198.51.100.7"}', true);
  perform public.api_pre_request();
  if not exists (select 1 from public.api_rate_hits where key = 'request_appointment:198.51.100.8') then
    raise exception 'FAIL: the caller IP was not taken from cf-connecting-ip';
  end if;
  -- Without Cloudflare's header: t6 took the first x-forwarded-for entry;
  -- t8 takes the last, the proxy's (t8_rate_limit_check.sql covers it).
  perform set_config('request.headers', '{"x-forwarded-for":"192.0.2.44, 10.0.0.1"}', true);
  perform public.api_pre_request();
  if not exists (select 1 from public.api_rate_hits where key = 'request_appointment:'
                 || case when hardened then '10.0.0.1' else '192.0.2.44' end) then
    raise exception 'FAIL: the x-forwarded-for fallback is wrong';
  end if;

  -- Old hits age out of the window.
  update public.api_rate_hits set at = now() - interval '2 hours' where key = 'request_appointment:198.51.100.7';
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', true);
  perform public.api_pre_request();
  if (select count(*) from public.api_rate_hits where key = 'request_appointment:198.51.100.7') <> 1 then
    raise exception 'FAIL: hits older than an hour were not cleared';
  end if;

  -- GET is refused for signed-out callers.
  perform set_config('request.method', 'GET', true);
  begin perform public.api_pre_request(); state := null;
  exception when others then get stacked diagnostics state = returned_sqlstate; end;
  if state is distinct from 'PT405' then raise exception 'FAIL: GET was not refused (%)', state; end if;

  -- Signed-in staff, tables and unlisted functions are untouched.
  perform set_config('request.method', 'POST', true);
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', true);
  update public.api_rate_hits set at = now() where key = 'request_appointment:198.51.100.7';
  insert into public.api_rate_hits (key) select 'request_appointment:198.51.100.7' from generate_series(1, 5);
  -- Since t8 only an active profile skips the count, so use a real one.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub',
    case when hardened then (select id from public.profiles where active limit 1)
         else '00000000-0000-0000-0000-000000000000'::uuid end)::text, true);
  if hardened and nullif(current_setting('request.jwt.claims')::json->>'sub', '') is null then
    raise exception 'run this on a database with at least one active account';
  end if;
  perform public.api_pre_request();
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.path', '/students', true);
  perform public.api_pre_request();
  perform set_config('request.path', '/rpc/not_limited', true);
  perform public.api_pre_request();

  perform set_config('request.path', '', true);
  raise exception 'T6_CHECKS_PASSED';
end $$;
