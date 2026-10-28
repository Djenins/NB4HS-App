-- Checks for t2_report_time_label. Run AFTER the migration; ends by raising
-- 'T2_CHECKS_PASSED', so nothing is committed.
do $$
declare v text;
begin
  v := public.staff_report_time_label(timestamptz '2026-11-02 17:00 America/New_York');
  if v <> 'Mon, Nov 2, 2026 at 5:00 PM EST' then raise exception 'FAIL: winter label is %', v; end if;
  v := public.staff_report_time_label(timestamptz '2026-07-02 17:00 America/New_York');
  if v <> 'Thu, Jul 2, 2026 at 5:00 PM EDT' then raise exception 'FAIL: summer label is %', v; end if;

  -- Another zone: the offset, with daylight saving.
  update public.reporting_schedules set time_zone = 'America/Los_Angeles' where active;
  if not found then
    insert into public.reporting_schedules (time_zone) values ('America/Los_Angeles');
  end if;
  v := public.staff_report_time_label(timestamptz '2026-11-02 17:00 America/Los_Angeles');
  if v <> 'Mon, Nov 2, 2026 at 5:00 PM UTC-08:00' then raise exception 'FAIL: other-zone label is %', v; end if;

  if has_function_privilege('authenticated', 'public.staff_report_time_label(timestamptz)', 'EXECUTE') then
    raise exception 'FAIL: the label function is callable by signed-in users';
  end if;
  raise exception 'T2_CHECKS_PASSED';
end $$;
