-- SNAP Outreach Stage 2b -- schedule the daily follow-up reminders.
-- NOT YET APPLIED. Enables pg_cron (free, built into Supabase; approved
-- 2026-10-26) and runs snap_send_task_reminders() every day at 11:00 UTC
-- (7:00 Eastern in summer, 6:00 in winter). The function is idempotent, so a
-- re-run never duplicates a reminder. cron.schedule with an existing job
-- name replaces that job, so this file is safe to re-apply.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule('snap-task-reminders', '0 11 * * *', $$select public.snap_send_task_reminders()$$);
