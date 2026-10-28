-- Undo t1_cross_program_tasks: the daily SNAP reminder job, the SNAP-only
-- task policies (as p3d left them) and the old columns come back. Fails if a
-- task exists outside Outreach (program is null), because the old table
-- can't hold it -- move or delete those first. Reminders sent under t1 are
-- dropped with task_notices_sent; task_reminders_sent was never touched.
begin;
select cron.schedule('snap-task-reminders', '0 11 * * *', $$select public.snap_send_task_reminders()$$);
alter publication supabase_realtime drop table public.tasks;

drop function public.send_task_reminders(timestamptz);
drop table public.task_notices_sent;

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
