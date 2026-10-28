-- t2 -- staff report emails showed "Mon, Nov 2, 2026 at 5:00 PM " with no
-- time zone: to_char(..., 'TZ') on a timestamp WITHOUT time zone is empty
-- (launch-audit-2026-10-28.md, staff reports item 5).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-28 (version 20261028020000) after
-- rolled-back dry runs on live passed: supabase/tests/t2_time_label_check.sql
-- and p6b_outbound_check.sql. The same checks passed against live afterwards.
-- Undo with supabase/rollback/t2_report_time_label_down.sql.
--
-- The zone label now comes from the offset at that moment, so it follows
-- daylight saving: EST / EDT for America/New_York (every schedule today),
-- "UTC-05:00"-style for any other zone. Nothing else changes.
create or replace function public.staff_report_time_label(p_at timestamptz)
returns text
language sql stable security definer set search_path = public
as $$
  select to_char(p_at at time zone tz, 'Dy, Mon FMDD, YYYY "at" FMHH12:MI AM') || ' ' ||
         case
           when tz = 'America/New_York' then case when off = interval '-4 hours' then 'EDT' else 'EST' end
           else 'UTC' || case when off < interval '0' then '-' else '+' end || to_char(abs(extract(epoch from off)) * interval '1 second', 'HH24:MI')
         end
  from (select tz, (p_at at time zone tz) - (p_at at time zone 'UTC') as off
        from (select coalesce((select time_zone from public.reporting_schedules where active order by created_at limit 1),
                              'America/New_York') as tz) z) o
$$;
revoke all on function public.staff_report_time_label(timestamptz) from public, anon, authenticated;
