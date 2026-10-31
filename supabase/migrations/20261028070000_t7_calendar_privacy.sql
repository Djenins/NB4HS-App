-- t7 -- client names and notes on the calendar and in appointments are for
-- the staff member responsible and administrators (owner decision,
-- 2026-10-28; launch-audit-2026-10-28.md, live security check 2).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-28 (version 20261028070000) after a
-- rolled-back dry run on live and after the app that reads
-- calendar_events_between() was deployed (PR #66);
-- supabase/tests/t7_calendar_privacy_check.sql passed against live afterwards.
-- Undo with supabase/rollback/t7_calendar_privacy_down.sql.
--
-- Before: anyone with calendar.view (every staff role) read every client
-- appointment and every calendar event, names and notes included.
--
-- Client appointments (appointments):
--   read by their assignee (assigned_email or staff_id) and administrators
--   (calendar.events.manage_all); an UNASSIGNED request is also read by its
--   department -- case management staff (case_management.appointments.view)
--   for case_manager requests, workforce staff (workforce.participants.view)
--   for job_developer requests -- so someone can pick it up.
--   Changing and deleting are unchanged (assignee or administrators).
-- Staff calendar events (calendar_events):
--   everyone with calendar.view still sees every time block (type, title,
--   time, place, who added it) through calendar_events_between(); the person
--   and notes are blank unless you added the event or are an administrator.
--   The table itself is read by the creator and administrators only.
-- Event titles stay visible to all staff, so they shouldn't name clients.

-- ======================================================================
-- Client appointments
-- ======================================================================
drop policy appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using ((select public.has_permission('calendar.events.manage_all'))
         or ((select public.has_permission('calendar.view'))
             and (assigned_email = auth.email()
                  or staff_id = auth.uid()
                  or (assigned_email is null and staff_id is null
                      and ((meeting_with = 'case_manager' and (select public.has_permission('case_management.appointments.view')))
                           or (meeting_with = 'job_developer' and (select public.has_permission('workforce.participants.view'))))))));

-- ======================================================================
-- Staff calendar events
-- ======================================================================
drop policy calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select to authenticated
  using ((created_by = auth.uid() and (select public.has_permission('calendar.view')))
         or (select public.has_permission('calendar.events.manage_all')));

-- Every event in a date range for anyone who can view the calendar, with the
-- person and notes only for its creator and administrators.
create or replace function public.calendar_events_between(p_from date, p_to date)
returns setof public.calendar_events
language sql stable security definer set search_path = public
as $$
  select e.id, e.type, e.title,
         case when v.full then e.person_name end,
         case when v.full then e.notes end,
         e.event_date, e.start_time, e.end_time, e.availability, e.created_by, e.created_by_name, e.created_at, e.location
  from public.calendar_events e
  cross join lateral (select (e.created_by = auth.uid() or public.has_permission('calendar.events.manage_all')) as full) v
  where public.has_permission('calendar.view') and e.event_date between p_from and p_to
  order by e.event_date, e.start_time
$$;
revoke all on function public.calendar_events_between(date, date) from public, anon;
grant execute on function public.calendar_events_between(date, date) to authenticated;
