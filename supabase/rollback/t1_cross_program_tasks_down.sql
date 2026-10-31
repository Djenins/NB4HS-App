-- Undo t1_cross_program_tasks: the daily SNAP reminder job, the SNAP-only
-- task policies (as p3d left them) and the old columns come back. Fails if a
-- task exists outside Outreach (program is null), because the old table
-- can't hold it -- move or delete those first. Also fails if a task records
-- what it's about (subject_type/subject_id), since those columns go.
--
-- Reminders sent under t1 are not sent again:
-- * each "due" reminder is copied into task_reminders_sent, which the old
--   daily job checks, so it skips tasks t1 already reminded;
-- * task_notices_sent is kept as task_notices_sent_rolled_back, so a later
--   re-apply can restore it: run the t1 migration and
--   supabase/rollback/t1_reapply_restore_notices.sql in one transaction.
begin;
do $$
begin
  if exists (select 1 from public.tasks where subject_type is not null or subject_id is not null) then
    raise exception 't1 rollback refused: some tasks record a subject, which the old table cannot hold';
  end if;
end $$;
insert into public.task_reminders_sent (task_id, due_date, sent_at)
select t.id, split_part(n.notice_key, ':', 4)::date, n.sent_at
from public.task_notices_sent n
join public.tasks t on t.id = split_part(n.notice_key, ':', 2)::uuid
where n.notice_key like 'due:%'
  and not exists (select 1 from public.task_reminders_sent r
                  where r.task_id = t.id and r.due_date = split_part(n.notice_key, ':', 4)::date);
select cron.schedule('snap-task-reminders', '0 11 * * *', $$select public.snap_send_task_reminders()$$);
alter publication supabase_realtime drop table public.tasks;

drop function public.send_task_reminders(timestamptz);
alter table public.task_notices_sent rename to task_notices_sent_rolled_back;

drop policy tasks_select on public.tasks;
drop policy tasks_insert on public.tasks;
drop policy tasks_update on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_on_record('snap.tasks.view', program, assigned_to, created_by));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (created_by = auth.uid() and source = 'manual' and automation_key is null
              and public.can_on_record('snap.tasks.manage', program, assigned_to, null)
              and (case_id is null or exists (select 1 from public.assistance_cases c where c.id = tasks.case_id)));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_on_record('snap.tasks.manage', program, assigned_to, null))
  with check (public.can_on_record('snap.tasks.manage', program, assigned_to, null));
drop function public.can_on_task(text, text, text, uuid, uuid);

drop trigger tasks_module_rules on public.tasks;
drop function public.task_module_rules();
drop index public.tasks_subject_idx;
drop index public.tasks_module_due_idx;
alter table public.tasks
  alter column program set not null,
  drop constraint tasks_subject_pair,
  drop column subject_id,
  drop column subject_type,
  drop column module;

delete from supabase_migrations.schema_migrations where version = '20261028010000';
commit;
