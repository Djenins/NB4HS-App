-- Undo t7_calendar_privacy: every calendar.view holder reads every
-- appointment and calendar event again, as p3f left it.
begin;
drop function public.calendar_events_between(date, date);
drop policy calendar_events_select on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select to authenticated
  using ((select public.has_permission('calendar.view')));
drop policy appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using ((select public.has_permission('calendar.view')));
delete from supabase_migrations.schema_migrations where version = '20261028070000';
commit;
