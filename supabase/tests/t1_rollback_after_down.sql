-- t1 rollback integrity, part 2 of 3 (after the rollback script). See part 1.
do $$
declare n int;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks'
             and column_name in ('module', 'subject_type', 'subject_id')) then
    raise exception 'FAIL: t1 columns survived the rollback';
  end if;
  if to_regclass('public.task_notices_sent') is not null or to_regprocedure('public.can_on_task(text, text, text, uuid, uuid)') is not null then
    raise exception 'FAIL: t1 objects survived the rollback';
  end if;
  if (select schedule || ' ' || command from cron.job where jobname = 'snap-task-reminders')
     is distinct from '0 11 * * * select public.snap_send_task_reminders()' then
    raise exception 'FAIL: the daily reminder job is not back';
  end if;
  select count(*) into n from (
    (select * from t1r_snapshot except
     select id, program, title, description, assigned_to, priority, due_date, status, completed_at, completion_notes,
            client_id, case_id, source, automation_key, created_by, created_at, updated_at from public.tasks)
    union all
    (select id, program, title, description, assigned_to, priority, due_date, status, completed_at, completion_notes,
            client_id, case_id, source, automation_key, created_by, created_at, updated_at from public.tasks
     except select * from t1r_snapshot)) d;
  if n <> 0 then raise exception 'FAIL: % task rows differ after the rollback', n; end if;
  if exists (select * from t1r_reminders except select * from public.task_reminders_sent) then
    raise exception 'FAIL: task_reminders_sent lost rows';
  end if;
  if (select count(*) from public.audit_events) <> (select audit_rows from t1r_audit) then
    raise exception 'FAIL: the rollback wrote audit rows (it should not touch task data)';
  end if;
end $$;
