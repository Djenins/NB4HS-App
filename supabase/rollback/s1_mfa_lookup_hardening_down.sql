-- Undo s1_mfa_lookup_hardening. Run in one transaction with the
-- schema_migrations delete for 20261112090000.
--
-- Can't undo: audit rows with action 'mfa_reset' stay (audit_events is
-- append-only), so the constraint keeps that value. Factors staff enrolled
-- stay in auth.mfa_factors; Supabase ignores them once nothing checks aal.

-- Lookup: back to returning the reason (the pre-s1 shape).
drop function public.lookup_client_appointments(text, text, text);
create function public.lookup_client_appointments(p_last_name text, p_email text, p_phone text)
returns table (appt_date date, appt_time text, meeting_with text, status text, reason text)
language sql volatile security definer set search_path = public
as $$
  select appt_date, appt_time, meeting_with, status, reason
  from public.appointments
  where trim(coalesce(p_last_name, '')) <> ''
    and lower(trim(last_name)) = lower(trim(p_last_name))
    and ((trim(coalesce(p_email, '')) <> '' and lower(email) = lower(trim(p_email)))
      or (trim(coalesce(p_phone, '')) <> '' and phone = trim(p_phone)))
  order by appt_date desc nulls last, appt_time desc nulls last
  limit 25;
$$;
revoke all on function public.lookup_client_appointments(text, text, text) from public;
grant execute on function public.lookup_client_appointments(text, text, text) to anon, authenticated;

-- The gate: drop the policies, then put t8's hook back by re-running it.
do $$
declare t record;
begin
  for t in select schemaname, tablename from pg_policies where policyname = 'mfa_required' and schemaname in ('public', 'storage') loop
    execute format('drop policy mfa_required on %I.%I', t.schemaname, t.tablename);
  end loop;
end;
$$;
delete from public.app_settings where key = 'require_mfa';

-- t8's api_pre_request
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

-- m1's admin_set_setting
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

-- p2a's admin_log_auth_action
create or replace function public.admin_log_auth_action(p_user uuid, p_action text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action <> 'password_reset' then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  perform public.admin_check_target(p_user, 'admin.users.edit', coalesce(nullif(btrim(p_reason), ''), 'Password reset requested'));
  perform public.admin_audit_event(p_action, 'auth.users', p_user,
                                   coalesce(nullif(btrim(p_reason), ''), 'Password reset requested'),
                                   jsonb_build_object('delivery', 'email'));
end;
$$;

drop function public.mfa_ok();
drop function public.admin_mfa_enrollment();
