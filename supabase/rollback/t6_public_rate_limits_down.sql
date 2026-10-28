-- Undo t6_public_rate_limits: PostgREST stops calling the pre-request check,
-- and the limits and counts are dropped.
begin;
alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';
drop function public.api_pre_request();
drop table public.api_rate_hits;
drop table public.api_rate_limits;
alter function public.bookable_staff() stable;
alter function public.kiosk_roster() stable;
alter function public.kiosk_visits(date) stable;
alter function public.lookup_client_appointments(text,text,text) stable;
alter function public.public_appointment_staff() stable;
alter function public.public_visit_count() stable;
alter function public.staff_open_slots(uuid,date,integer) stable;
delete from supabase_migrations.schema_migrations where version = '20261028060000';
commit;
