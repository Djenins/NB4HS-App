-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Public appointment self-lookup: no client accounts exist in this app
-- (clients are plain rows, never Supabase Auth users), so rather than
-- opening appointments SELECT to anon entirely, this SECURITY DEFINER
-- function does a narrow, two-factor (last name + email OR phone) lookup
-- and returns only non-sensitive columns (no id, no assigned staff email).
-- Known trade-off: anyone who knows a client's last name + phone/email can
-- see their appointment date/time/status/reason -- acceptable for this
-- app's threat model (appointment requests are already anonymous inserts),
-- but not a substitute for real per-client auth if that's ever needed.
create or replace function public.lookup_client_appointments(p_last_name text, p_email text, p_phone text)
returns table(appt_date date, appt_time text, meeting_with text, status text, reason text)
language sql
security definer
set search_path = public
stable
as $$
  select appt_date, appt_time, meeting_with, status, reason
  from public.appointments
  where trim(coalesce(p_last_name, '')) <> ''
    and lower(trim(last_name)) = lower(trim(p_last_name))
    and (
      (trim(coalesce(p_email, '')) <> '' and lower(email) = lower(trim(p_email)))
      or
      (trim(coalesce(p_phone, '')) <> '' and phone = trim(p_phone))
    )
  order by appt_date desc nulls last, appt_time desc nulls last
  limit 25;
$$;

revoke all on function public.lookup_client_appointments(text, text, text) from public;
grant execute on function public.lookup_client_appointments(text, text, text) to anon, authenticated;
