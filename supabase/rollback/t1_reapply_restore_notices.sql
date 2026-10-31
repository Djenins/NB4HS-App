-- Re-applying t1 after its rollback: run this right after the t1 migration,
-- in the same transaction, so the hourly job never runs in between:
--
--   begin;
--   \i supabase/migrations/20261028010000_t1_cross_program_tasks.sql
--   \i supabase/rollback/t1_reapply_restore_notices.sql
--   insert into supabase_migrations.schema_migrations (version, name) values ('20261028010000', 't1_cross_program_tasks');
--   commit;
--
-- The migration carries over what the old daily job sent while t1 was rolled
-- back (task_reminders_sent). This brings back what t1 itself had sent before
-- the rollback, overdue nudges included, which the old table can't record.
insert into public.task_notices_sent (notice_key, sent_at)
select notice_key, sent_at from public.task_notices_sent_rolled_back
on conflict (notice_key) do nothing;
drop table public.task_notices_sent_rolled_back;
