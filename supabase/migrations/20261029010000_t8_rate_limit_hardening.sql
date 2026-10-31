-- t8 -- harden the t6 throttle on the functions open without sign-in
-- (launch-readiness review, 2026-10-29).
-- NOT APPLIED to the hosted project. Tested on the local stack with
-- supabase/tests/t8_rate_limit_check.sql and
-- supabase/tests/t8_rate_limit_concurrency.sh. Undo with
-- supabase/rollback/t8_rate_limit_hardening_down.sql.
--
-- What t6 got wrong, each confirmed on the local stack before this fix:
-- 1. Concurrent calls raced. Each request counted, then inserted, with no
--    lock, so 20 calls at once against a limit of 5 all passed. Now each
--    caller key takes a transaction-scoped advisory lock before counting, so
--    calls from one IP to one function queue behind each other and the
--    limit is exact. (Calls from other IPs or to other functions don't wait.)
-- 2. Any signed-in JWT skipped the throttle, including a self-signed-up
--    account, which starts inactive and can do nothing else. Now only an
--    active profile (and the service role) skips it.
-- 3. Without Cloudflare's header, the first x-forwarded-for entry was used.
--    The client writes that entry, so it could pick a fresh "IP" per call.
--    Now the last entry is used: the one the proxy in front of PostgREST
--    appended. IPv6 callers are grouped by their /64, since one household
--    or phone usually holds a whole /64.
-- 4. Old rows were only deleted for the caller being counted, so keys that
--    never came back stayed forever. A pg_cron job now clears every row older
--    than the hour each 10 minutes, with an index on "at" for it.
-- 5. Kiosk polls: each signed-out kiosk tab polls kiosk_roster and
--    kiosk_visits every 30 s (120 calls an hour each). At 1,200 an hour,
--    ten open kiosk or phone check-in pages behind one site's Wi-Fi used up
--    the limit. Those two now allow 3,600 an hour (30 pages per IP). Both
--    return the same small list to every caller, so a higher limit gives
--    away nothing more.
--
-- Still true (documented in plans/launch-readiness-2026-10-29.md): a call
-- that fails is not counted, because its error rolls back the count with
-- everything else. Postgres has no way to keep that one row.

create index if not exists api_rate_hits_at_idx on public.api_rate_hits (at);

update public.api_rate_limits set per_hour = 3600 where rpc in ('kiosk_roster', 'kiosk_visits');

-- The caller's address as the throttle counts it. Exposed on its own so the
-- check can test it; nobody outside the database calls it.
create or replace function public.api_rate_caller(hdrs json)
returns text
language plpgsql immutable
set search_path = public
as $$
declare
  raw text := nullif(btrim(hdrs->>'cf-connecting-ip'), '');
  addr inet;
begin
  if raw is null then
    raw := nullif(btrim(regexp_replace(coalesce(hdrs->>'x-forwarded-for', ''), '^.*,', '')), '');
  end if;
  if raw is null then
    return 'unknown';
  end if;
  begin
    addr := raw::inet;
  exception when others then
    return 'unknown';
  end;
  if family(addr) = 6 then
    return network(set_masklen(addr, 64))::text;
  end if;
  return host(addr);
end;
$$;
revoke all on function public.api_rate_caller(json) from public, anon, authenticated;

create or replace function public.api_pre_request()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  path text := current_setting('request.path', true);
  claims json;
  claims_role text;
  fn text;
  lim int;
  k text;
  n int;
begin
  if path is null or path not like '/rpc/%' then
    return;
  end if;
  fn := substr(path, 6);
  select per_hour into lim from public.api_rate_limits where rpc = fn;
  if lim is null then
    return;
  end if;
  claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json;
  claims_role := coalesce(claims->>'role', 'anon');
  if claims_role = 'service_role' then
    return;
  end if;
  if claims_role = 'authenticated' and exists (
    select 1 from public.profiles where id = nullif(claims->>'sub', '')::uuid and active
  ) then
    return;
  end if;
  if coalesce(current_setting('request.method', true), '') <> 'POST' then
    raise exception 'Use POST for this function.' using errcode = 'PT405';
  end if;
  k := fn || ':' || public.api_rate_caller(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json);
  -- Held until the request's transaction ends, so the next call from this
  -- caller counts this one.
  perform pg_advisory_xact_lock(hashtextextended(k, 0));
  delete from public.api_rate_hits where key = k and at < now() - interval '1 hour';
  select count(*) into n from public.api_rate_hits where key = k;
  if n >= lim then
    raise exception 'Too many requests. Please wait a few minutes and try again.' using errcode = 'PT429';
  end if;
  insert into public.api_rate_hits (key) values (k);
end;
$$;
revoke all on function public.api_pre_request() from public;
grant execute on function public.api_pre_request() to anon, authenticated;

select cron.schedule('api-rate-hits-cleanup', '*/10 * * * *',
  $$delete from public.api_rate_hits where at < now() - interval '1 hour'$$);
