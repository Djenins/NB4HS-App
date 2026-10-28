-- Undo t2_report_time_label: the label goes back to p6b's version (which
-- prints no time zone).
begin;
create or replace function public.staff_report_time_label(p_at timestamptz)
returns text
language sql stable security definer set search_path = public
as $$
  select to_char(p_at at time zone tz, 'Dy, Mon FMDD, YYYY "at" FMHH12:MI AM') || ' ' ||
         to_char(p_at at time zone tz, 'TZ')
  from (select coalesce((select time_zone from public.reporting_schedules where active order by created_at limit 1), 'America/New_York') as tz) z
$$;
revoke all on function public.staff_report_time_label(timestamptz) from public, anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261028020000';
commit;
