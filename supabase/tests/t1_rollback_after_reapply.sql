-- t1 rollback integrity, part 3 of 3 (after re-applying t1). See part 1.
do $$
declare n int;
begin
  select count(*) into n from (
    (select * from t1r_snapshot except
     select id, program, title, description, assigned_to, priority, due_date, status, completed_at, completion_notes,
            client_id, case_id, source, automation_key, created_by, created_at, updated_at from public.tasks)
    union all
    (select id, program, title, description, assigned_to, priority, due_date, status, completed_at, completion_notes,
            client_id, case_id, source, automation_key, created_by, created_at, updated_at from public.tasks
     except select * from t1r_snapshot)) d;
  if n <> 0 then raise exception 'FAIL: % task rows differ after re-applying t1 (updated_at must not move)', n; end if;
  if exists (select 1 from public.tasks where module is distinct from 'snap') then
    raise exception 'FAIL: a re-applied task did not get module snap';
  end if;
  if (select count(*) from public.audit_events) <> (select audit_rows from t1r_audit) then
    raise exception 'FAIL: the backfill wrote audit rows';
  end if;
  -- Every reminder t1 sent before the rollback is known again, so the
  -- re-applied job sends nothing twice (overdue nudges included).
  if exists (select notice_key, sent_at from t1r_notices
             except select notice_key, sent_at from public.task_notices_sent) then
    raise exception 'FAIL: reminders sent before the rollback were forgotten by the re-apply';
  end if;
  if to_regclass('public.task_notices_sent_rolled_back') is not null then
    raise exception 'FAIL: the rolled-back copy was left behind';
  end if;
  if public.send_task_reminders((public.snap_today() + time '12:00') at time zone 'America/New_York') <> 0 then
    raise exception 'FAIL: the re-applied job re-sent a reminder';
  end if;
  raise exception 'T1_ROLLBACK_PASSED % tasks unchanged through rollback and re-apply', (select count(*) from t1r_snapshot);
end $$;
