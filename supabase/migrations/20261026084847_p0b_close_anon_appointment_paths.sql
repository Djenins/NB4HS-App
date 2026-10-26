-- Phase 0, part B of 2 -- REMOVES the old anonymous appointment paths.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026084847), after
-- part A (20261026084229) and the frontend calling request_appointment() /
-- public_appointment_staff() (PR #34) were live. supabase/tests/
-- p0b_security_check.sql passed against the live database afterwards.
--
-- S3 appointments_insert was `with check (true)` for every role including
--    anon: any status, any source, and any assigned_email -- which also sent a
--    notification to whichever staff member that email belonged to. Clients
--    now go through request_appointment(); direct inserts need active staff.
-- S5 staff_directory exposed active case managers' and job developers' email
--    addresses to anon. The public picker now uses public_appointment_staff(),
--    which returns names and roles only.

drop policy appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.is_staff());

revoke all on public.staff_directory from anon;
