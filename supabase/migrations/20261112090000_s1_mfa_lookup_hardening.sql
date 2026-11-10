-- s1_mfa_lookup_hardening
--
-- Two fixes from plans/security-audit-2026-11.md:
--
--   #2  The public appointment lookup no longer returns the "reason" the
--       client typed. Last name plus phone is often known to family,
--       landlords or employers, and the reason can be sensitive.
--
--   #3  Two-step sign-in (TOTP) for staff, enforced by the database, not
--       just the app. While the setting `require_mfa` is true, a signed-in
--       session that hasn't passed its second step (JWT `aal` is not
--       `aal2`) gets:
--         - nothing through the REST API, RPCs included (api_pre_request);
--         - no rows from any public table or from storage, which also
--           covers realtime (a RESTRICTIVE policy on every RLS table).
--       Signed-out callers (kiosk, public forms) are not affected: the gate
--       only applies to the `authenticated` role.
--
--       The setting starts false, so this migration changes nothing until
--       an administrator turns it on. Order on live: apply this, deploy the
--       app (it asks every staff member to set up an authenticator app),
--       then turn the setting on.
--
--   Admins can clear a staff member's authenticator (lost phone) through the
--   admin-users Edge Function; it is audited as `mfa_reset`.
--
-- Rollback: supabase/rollback/s1_mfa_lookup_hardening_down.sql

-- ======================================================================
-- 1. Appointment lookup without the reason
-- ======================================================================
drop function public.lookup_client_appointments(text, text, text);
create function public.lookup_client_appointments(p_last_name text, p_email text, p_phone text)
returns table (appt_date date, appt_time text, meeting_with text, status text)
language sql
volatile
security definer
set search_path = public
as $$
  select appt_date, appt_time, meeting_with, status
  from public.appointments
  where trim(coalesce(p_last_name, '')) <> ''
    and lower(trim(last_name)) = lower(trim(p_last_name))
    and (
      (trim(coalesce(p_email, '')) <> '' and lower(email) = lower(trim(p_email)))
      or (trim(coalesce(p_phone, '')) <> '' and phone = trim(p_phone))
    )
  order by appt_date desc nulls last, appt_time desc nulls last
  limit 25;
$$;
revoke all on function public.lookup_client_appointments(text, text, text) from public;
grant execute on function public.lookup_client_appointments(text, text, text) to anon, authenticated;

-- ======================================================================
-- 2. The second-step check
-- ======================================================================
-- True when the caller may see data: not a signed-in user, MFA not
-- required yet, or the session has passed its second step.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
      or coalesce((select value = 'true'::jsonb from public.app_settings where key = 'require_mfa'), false) = false
      or coalesce(auth.jwt()->>'aal', '') = 'aal2';
$$;
revoke all on function public.mfa_ok() from public, anon;
grant execute on function public.mfa_ok() to authenticated;

-- Every public table with row-level security, and storage. RESTRICTIVE
-- policies are ANDed with the existing ones, so they only ever take away.
do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists mfa_required on public.%I', t.relname);
    execute format(
      'create policy mfa_required on public.%I as restrictive for all to authenticated '
      'using ((select public.mfa_ok())) with check ((select public.mfa_ok()))', t.relname);
  end loop;
end;
$$;
drop policy if exists mfa_required on storage.objects;
create policy mfa_required on storage.objects as restrictive for all to authenticated
  using ((select public.mfa_ok())) with check ((select public.mfa_ok()));

-- REST and RPC: refuse before anything runs. Security-definer functions
-- skip RLS, so the policies above don't cover them. Otherwise t8's hook.
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
  claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json;
  claims_role := coalesce(claims->>'role', 'anon');
  if claims_role = 'authenticated' and not public.mfa_ok() then
    raise exception 'Two-step sign-in required.' using errcode = 'PT401',
      hint = 'mfa_required';
  end if;
  if path is null or path not like '/rpc/%' then
    return;
  end if;
  fn := substr(path, 6);
  select per_hour into lim from public.api_rate_limits where rpc = fn;
  if lim is null then
    return;
  end if;
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

-- ======================================================================
-- 3. The setting (m1's admin_set_setting plus 'require_mfa')
-- ======================================================================
create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require('admin.settings.manage');
  if p_key = 'closing_time' then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'the closing time must look like 17:00' using errcode = '22023';
    end if;
  elsif p_key = 'mailing_address' then
    if jsonb_typeof(p_value) <> 'string' or char_length(btrim(p_value #>> '{}')) not between 10 and 300 then
      raise exception 'the mailing address must be 10 to 300 characters' using errcode = '22023';
    end if;
    p_value := to_jsonb(btrim(p_value #>> '{}'));
  elsif p_key = 'mileage_rate' then
    -- Dollars per mile, e.g. 0.70; at most 3 decimals.
    if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric < 0 or (p_value #>> '{}')::numeric > 5
       or (p_value #>> '{}')::numeric <> round((p_value #>> '{}')::numeric, 3) then
      raise exception 'the mileage rate must be between 0 and 5 dollars per mile, at most 3 decimals' using errcode = '22023';
    end if;
  elsif p_key = 'require_mfa' then
    if jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'require_mfa must be true or false' using errcode = '22023';
    end if;
    -- Turning it on from a session that hasn't passed two-step sign-in
    -- would lock that admin out mid-change.
    if p_value = 'true'::jsonb and coalesce(auth.jwt()->>'aal', '') <> 'aal2' then
      raise exception 'set up two-step sign-in on your own account first' using errcode = '42501';
    end if;
  else
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  insert into public.app_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
  where app_settings.value is distinct from excluded.value;
end;
$$;
revoke all on function public.admin_set_setting(text, jsonb, text) from public, anon;
grant execute on function public.admin_set_setting(text, jsonb, text) to authenticated;

-- ======================================================================
-- 4. Audited authenticator reset
-- ======================================================================
alter table public.audit_events drop constraint audit_events_action_check;
alter table public.audit_events add constraint audit_events_action_check
  check (action in ('insert', 'update', 'delete', 'invite', 'revoke_sessions', 'password_reset', 'mfa_reset'));

create or replace function public.admin_log_auth_action(p_user uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fallback text;
begin
  if p_action = 'password_reset' then
    fallback := 'Password reset requested';
  elsif p_action = 'mfa_reset' then
    fallback := 'Two-step sign-in reset';
  else
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  perform public.admin_check_target(p_user, 'admin.users.edit', coalesce(nullif(btrim(p_reason), ''), fallback));
  perform public.admin_audit_event(p_action, 'auth.users', p_user,
                                   coalesce(nullif(btrim(p_reason), ''), fallback),
                                   case when p_action = 'password_reset' then jsonb_build_object('delivery', 'email') else '{}'::jsonb end);
end;
$$;
revoke all on function public.admin_log_auth_action(uuid, text, text) from public, anon;
grant execute on function public.admin_log_auth_action(uuid, text, text) to authenticated;

-- ======================================================================
-- 5. Who has set up two-step sign-in (for the Settings switch)
-- ======================================================================
create or replace function public.admin_mfa_enrollment()
returns table (user_id uuid, name text, email text, enrolled boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_require('admin.settings.manage');
  return query
  select p.id, p.name, p.email,
         exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified')
  from public.profiles p
  where p.active
  order by p.name;
end;
$$;
revoke all on function public.admin_mfa_enrollment() from public, anon;
grant execute on function public.admin_mfa_enrollment() to authenticated;
