-- t6 -- throttle the functions anyone can call without signing in (owner
-- decision, 2026-10-28; launch-audit-2026-10-28.md, live security check 3,
-- S13 in goals.md).
-- NOT APPLIED to the hosted project yet. Tested on the local stack with
-- supabase/tests/t6_rate_limits_check.sql and through the API. Undo with
-- supabase/rollback/t6_public_rate_limits_down.sql.
--
-- PostgREST calls api_pre_request() before every API request
-- (pgrst.db_pre_request). For a signed-out caller of one of the functions in
-- api_rate_limits it counts calls per function and caller IP over the last
-- hour and answers HTTP 429 past the limit. Signed-in staff, tables and every
-- other function are untouched. These functions are POST-only for signed-out
-- callers (the app always POSTs), so a GET can't skip the count.
--
-- Limits are rows, so an administrator can tune one without a migration:
--   update public.api_rate_limits set per_hour = 60 where rpc = 'request_appointment';
-- The kiosk shares one IP and polls kiosk_roster / kiosk_visits every 30 s
-- per device, so those limits are generous.
--
-- The caller IP is Cloudflare's cf-connecting-ip, which Supabase's edge sets,
-- falling back to the first x-forwarded-for entry.
--
-- A call that fails (bad input) isn't counted: the error rolls back the count
-- with everything else. Every call that succeeds -- including a lookup that
-- finds nothing -- is.

create table public.api_rate_limits (
  rpc text primary key,
  per_hour int not null check (per_hour > 0)
);
insert into public.api_rate_limits (rpc, per_hour) values
  ('kiosk_roster', 1200), ('kiosk_visits', 1200), ('public_visit_count', 600),
  ('kiosk_create_visit', 300), ('kiosk_student_check_in', 300), ('check_out_visit', 300),
  ('staff_open_slots', 600), ('bookable_staff', 300), ('public_appointment_staff', 300),
  ('lookup_client_appointments', 60),
  ('request_appointment', 30), ('book_staff_appointment', 30), ('public_register_case_client', 30);

create table public.api_rate_hits (
  key text not null,
  at timestamptz not null default now()
);
create index api_rate_hits_key_at_idx on public.api_rate_hits (key, at);

alter table public.api_rate_limits enable row level security;
alter table public.api_rate_hits enable row level security;
-- No policies: only api_pre_request() (security definer) touches them.
revoke all on public.api_rate_limits, public.api_rate_hits from anon, authenticated;

-- PostgREST runs a STABLE function's call in a read-only transaction, where
-- the check below can't record it. These seven only read; marking them
-- VOLATILE changes nothing they return, and PostgREST then also refuses GET.
alter function public.bookable_staff() volatile;
alter function public.kiosk_roster() volatile;
alter function public.kiosk_visits(date) volatile;
alter function public.lookup_client_appointments(text,text,text) volatile;
alter function public.public_appointment_staff() volatile;
alter function public.public_visit_count() volatile;
alter function public.staff_open_slots(uuid,date,integer) volatile;

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

alter role authenticator set pgrst.db_pre_request = 'public.api_pre_request';
notify pgrst, 'reload config';
