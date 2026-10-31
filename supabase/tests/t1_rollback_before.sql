-- t1 rollback integrity, part 1 of 3. Run on a database WITH t1 applied, in
-- one transaction (the final raise in part 3 rolls it all back):
--
--   grep -vE '^(begin|commit);$' supabase/rollback/t1_cross_program_tasks_down.sql > /tmp/t1_down.sql
--   psql "$DB" -X -q --single-transaction -v ON_ERROR_STOP=1 \
--     -f supabase/tests/t1_rollback_before.sql -f /tmp/t1_down.sql \
--     -f supabase/tests/t1_rollback_after_down.sql \
--     -f supabase/migrations/20261028010000_t1_cross_program_tasks.sql \
--     -f supabase/rollback/t1_reapply_restore_notices.sql \
--     -f supabase/tests/t1_rollback_after_reapply.sql
--
-- Creates SNAP tasks in every state, sends one reminder the t1 way, snapshots
-- the tasks (every column the old table had) with the reminders already sent,
-- and checks the rollback refuses to run while a task outside Outreach exists.
--
-- To re-apply t1 after its rollback, run the migration and
-- supabase/rollback/t1_reapply_restore_notices.sql in one transaction; the
-- command above does that as its last two files.
do $$
declare
  worker uuid := (select ps.user_id from public.program_staff ps where ps.program = 'snap' and ps.program_role = 'worker' and ps.active limit 1);
  v_client uuid;
  v_task uuid;
  msg text;
begin
  if worker is null then raise exception 'need a SNAP worker (supabase/seed.sql)'; end if;
  insert into public.clients (first_name, last_name) values ('T1R', 'Probe') returning id into v_client;
  insert into public.tasks (program, title, description, assigned_to, priority, due_date, client_id, created_by)
  values ('snap', 'T1R open', 'details', worker, 'high', public.snap_today(), v_client, worker);
  insert into public.tasks (program, title, assigned_to, due_date, status, completion_notes, created_by)
  values ('snap', 'T1R done', worker, current_date - 3, 'done', 'called back', worker);
  insert into public.tasks (program, title, assigned_to, status, created_by)
  values ('snap', 'T1R cancelled', null, 'cancelled', worker) returning id into v_task;
  insert into public.task_reminders_sent (task_id, due_date) values (v_task, current_date);

  -- A task outside Outreach blocks the rollback (program would be null).
  -- Tried in a sub-block so it never stays.
  begin
    insert into public.tasks (module, title, created_by) values ('case_management', 'T1R cm', worker);
    raise exception 'probe-only';
  exception when others then
    if sqlerrm <> 'probe-only' then raise; end if;
  end;
end $$;

-- A reminder sent under t1, after rollout: noon New York time today, the open
-- task is due and its assignee can open it. Neither the rollback nor a
-- re-apply may send it again.
do $$
declare
  noon timestamptz := (public.snap_today() + time '12:00') at time zone 'America/New_York';
  n int;
begin
  n := public.send_task_reminders(noon);
  if n < 1 or not exists (select 1 from public.task_notices_sent ns join public.tasks t
                          on ns.notice_key = 'due:' || t.id || ':' || t.assigned_to || ':' || t.due_date
                          where t.title = 'T1R open') then
    raise exception 'FAIL: setup: t1 did not remind the open task (sent %)', n;
  end if;
  if public.send_task_reminders(noon + interval '1 hour') <> 0 then
    raise exception 'FAIL: setup: t1 reminded twice within one rollout';
  end if;
end $$;
create temp table t1r_notices on commit drop as select notice_key, sent_at from public.task_notices_sent;

create temp table t1r_snapshot on commit drop as
select id, program, title, description, assigned_to, priority, due_date, status, completed_at, completion_notes,
       client_id, case_id, source, automation_key, created_by, created_at, updated_at
from public.tasks;
create temp table t1r_reminders on commit drop as select * from public.task_reminders_sent;
create temp table t1r_audit on commit drop as select count(*) as audit_rows from public.audit_events;

-- The refusal itself: with a Case Management task present, the rollback's
-- "program set not null" fails, so nothing half-applies.
savepoint t1r_refuse;
insert into public.tasks (module, title) values ('case_management', 'T1R blocks rollback');
do $$
begin
  begin
    alter table public.tasks alter column program set not null;
    raise exception 'FAIL: the rollback would have dropped a task outside Outreach';
  exception when not_null_violation then null;
  end;
end $$;
rollback to savepoint t1r_refuse;
