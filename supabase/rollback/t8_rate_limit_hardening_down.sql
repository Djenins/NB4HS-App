-- Undo t8_rate_limit_hardening: the throttle goes back to exactly t6.
begin;
select cron.unschedule('api-rate-hits-cleanup');
drop index if exists public.api_rate_hits_at_idx;
update public.api_rate_limits set per_hour = 1200 where rpc in ('kiosk_roster', 'kiosk_visits');
create or replace function public.api_pre_request()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  path text := current_setting('request.path', true);
  claims_role text;
  fn text;
  lim int;
  hdrs json;
  ip text;
  k text;
  n int;
begin
  if path is null or path not like '/rpc/%' then
    return;
  end if;
  claims_role := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', 'anon');
  if claims_role <> 'anon' then
    return;
  end if;
  fn := substr(path, 6);
  select per_hour into lim from public.api_rate_limits where rpc = fn;
  if lim is null then
    return;
  end if;
  if coalesce(current_setting('request.method', true), '') <> 'POST' then
    raise exception 'Use POST for this function.' using errcode = 'PT405';
  end if;
  hdrs := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip := coalesce(nullif(hdrs->>'cf-connecting-ip', ''), nullif(btrim(split_part(hdrs->>'x-forwarded-for', ',', 1)), ''), 'unknown');
  k := fn || ':' || ip;
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
drop function public.api_rate_caller(json);
delete from supabase_migrations.schema_migrations where version = '20261029010000';
commit;
