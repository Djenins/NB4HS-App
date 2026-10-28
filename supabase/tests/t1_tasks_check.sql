-- Checks for t1_cross_program_tasks. Run AFTER the migration. Always ends by
-- raising 'T1_CHECKS_PASSED', so nothing it writes is committed; any failed
-- check raises its own message first.
--
-- Needs a SNAP worker, a SNAP supervisor who is also a case manager, and an
-- account with no SNAP access (supabase/seed.sql has all three). SNAP task
-- access itself is covered by the policy parity run (p3d_probes, tables
-- 'tasks'); this covers what t1 adds.
do $$
declare
  worker uuid := (select ps.user_id from public.program_staff ps join public.profiles p on p.id = ps.user_id and p.active
                  where ps.program = 'snap' and ps.program_role = 'worker' and ps.active order by p.created_at limit 1);
  lead uuid := (select ps.user_id from public.program_staff ps join public.profiles p on p.id = ps.user_id and p.active and p.role = 'case_manager'
                where ps.program = 'snap' and ps.program_role = 'supervisor' and ps.active order by p.created_at limit 1);
  outsider uuid := (select p.id from public.profiles p where p.active and p.role = 'receptionist'
                    and not exists (select 1 from public.program_staff ps where ps.user_id = p.id) order by p.created_at limit 1);
  -- Mon Nov 2 2026, 15:00 in New York.
  v_now timestamptz := timestamptz '2026-11-02 15:00 America/New_York';
  v_today date := date '2026-11-02';
  v_client uuid;
  t_snap uuid;
  t_cm_mine uuid;
  t_cm_other uuid;
  t_overdue uuid;
  t_old uuid;
  t_outsider uuid;
  rec record;
  n int;
  msg text;
begin
  if worker is null or lead is null or outsider is null then
    raise exception 'need a SNAP worker, a SNAP supervisor who is a case manager, and a receptionist with no program role';
  end if;
  insert into public.clients (first_name, last_name) values ('T1', 'Probe') returning id into v_client;

  -- ---------------- shape ----------------
  if exists (select 1 from public.tasks where module is null) then
    raise exception 'FAIL: a task has no module';
  end if;
  if has_function_privilege('authenticated', 'public.send_task_reminders(timestamptz)', 'EXECUTE')
     or has_function_privilege('anon', 'public.can_on_task(text, text, text, uuid, uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.can_on_task(text, text, text, uuid, uuid)', 'EXECUTE') then
    raise exception 'FAIL: a function is callable by the wrong role';
  end if;
  if exists (select 1 from pg_policies where tablename = 'task_notices_sent') then
    raise exception 'FAIL: task_notices_sent has a policy';
  end if;
  if (select schedule || ' ' || command from cron.job where jobname = 'snap-task-reminders')
     is distinct from '5 * * * * select public.send_task_reminders()' then
    raise exception 'FAIL: the reminder job is not the hourly send_task_reminders()';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    raise exception 'FAIL: tasks is not in supabase_realtime';
  end if;

  -- ---------------- module rules ----------------
  insert into public.tasks (program, title, assigned_to, due_date, client_id, created_by)
  values ('snap', 'T1 snap', worker, v_today, v_client, worker) returning id into t_snap;
  if (select module from public.tasks where id = t_snap) <> 'snap' then
    raise exception 'FAIL: a SNAP task did not get module snap';
  end if;
  insert into public.tasks (module, title, assigned_to, due_date, created_by, subject_type, subject_id)
  values ('case_management', 'T1 cm mine', lead, v_today, lead, 'case_client', gen_random_uuid()) returning id into t_cm_mine;
  if (select program from public.tasks where id = t_cm_mine) is not null then
    raise exception 'FAIL: a Case Management task kept the snap program default';
  end if;
  insert into public.tasks (module, title, assigned_to, due_date, created_by)
  values ('case_management', 'T1 cm other', worker, v_today, worker) returning id into t_cm_other;

  msg := null;
  begin
    insert into public.tasks (program, module, title) values (null, null, 'T1 nowhere');
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a task with no module or program was accepted'; end if;
  msg := null;
  begin
    update public.tasks set module = 'case_management' where id = t_snap;
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a task moved to another module'; end if;
  msg := null;
  begin
    insert into public.tasks (module, title, subject_type) values ('case_management', 'T1 half subject', 'placement');
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: subject_type without subject_id was accepted'; end if;

  -- ---------------- access outside Outreach ----------------
  -- No '<module>.tasks.*' permission exists outside SNAP, so nobody sees
  -- these -- not even their assignee or a System Administrator.
  perform set_config('request.jwt.claims', json_build_object('sub', lead, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.tasks where id in (t_cm_mine, t_cm_other)) then
    raise exception 'FAIL: a Case Management task is visible with no task permission';
  end if;
  msg := null;
  begin
    insert into public.tasks (module, title, assigned_to, created_by) values ('case_management', 'T1 denied', lead, lead);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: created a Case Management task with no task permission'; end if;
  reset role;

  -- Turning it on later: the keys plus a grant ('assigned' scope).
  insert into public.permissions (key, module_key, scoped, sort_order, description) values
    ('case_management.tasks.view', 'case_management', true, 90, 'T1 probe'),
    ('case_management.tasks.manage', 'case_management', true, 91, 'T1 probe');
  insert into public.role_permissions (role_id, permission_key, scope)
  select r.id, k, 'assigned' from public.roles r
  cross join unnest(array['case_management.tasks.view', 'case_management.tasks.manage']) k
  where r.key = 'legacy_case_manager';

  perform set_config('request.jwt.claims', json_build_object('sub', lead, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if not exists (select 1 from public.tasks where id = t_cm_mine) then
    raise exception 'FAIL: the case manager cannot see their own Case Management task after the grant';
  end if;
  if exists (select 1 from public.tasks where id = t_cm_other) then
    raise exception 'FAIL: assigned scope shows a Case Management task assigned to someone else';
  end if;
  update public.tasks set status = 'done' where id = t_cm_mine;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the case manager could not complete their Case Management task'; end if;
  update public.tasks set status = 'open' where id = t_cm_mine;
  insert into public.tasks (module, title, assigned_to, created_by) values ('case_management', 'T1 allowed', lead, lead);
  msg := null;
  begin
    insert into public.tasks (module, title, assigned_to, created_by) values ('case_management', 'T1 for someone else', worker, lead);
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: assigned scope created a task for someone else'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', worker, 'role', 'authenticated')::text, true);
  set local role authenticated;
  if exists (select 1 from public.tasks where id = t_cm_other) then
    raise exception 'FAIL: a SNAP worker who is not a case manager sees a Case Management task';
  end if;
  if not exists (select 1 from public.tasks where id = t_snap) then
    raise exception 'FAIL: the SNAP worker cannot see their own SNAP task';
  end if;
  reset role;

  -- ---------------- reminders ----------------
  delete from public.notifications where user_id in (worker, lead, outsider);
  insert into public.tasks (program, title, assigned_to, due_date, created_by)
  values ('snap', 'T1 overdue', worker, v_today - 1, worker) returning id into t_overdue;
  insert into public.tasks (program, title, assigned_to, due_date, created_by)
  values ('snap', 'T1 long overdue', worker, v_today - 2, worker) returning id into t_old;
  insert into public.tasks (program, title, assigned_to, due_date, created_by)
  values ('snap', 'T1 outsider', outsider, v_today, lead) returning id into t_outsider;

  if public.send_task_reminders(timestamptz '2026-11-02 03:00 America/New_York') <> 0 then
    raise exception 'FAIL: reminders went out at 3 a.m.';
  end if;

  -- Due today: t_snap (worker) and t_cm_mine (lead, now permitted). Overdue
  -- by a day: t_overdue. Not t_old (two days), not t_outsider (no access),
  -- not t_cm_other (the worker holds no Case Management task permission).
  n := public.send_task_reminders(v_now);
  if n <> 3 then raise exception 'FAIL: expected 3 reminders, sent %', n; end if;
  select * into rec from public.notifications where user_id = worker and type = 'snap_task_due';
  if rec.link is distinct from '/snap/tasks' or rec.message not like 'T1 snap — 2026-11-02' then
    raise exception 'FAIL: SNAP reminder is wrong: % / %', rec.link, rec.message;
  end if;
  if (select count(*) from public.notifications where user_id = worker and type = 'task_overdue' and message like 'T1 overdue%') <> 1 then
    raise exception 'FAIL: no overdue nudge';
  end if;
  if (select link from public.notifications where user_id = lead and message like 'T1 cm mine%') is not null then
    raise exception 'FAIL: a Case Management reminder got a link';
  end if;
  if exists (select 1 from public.notifications where user_id = outsider) then
    raise exception 'FAIL: reminded someone who cannot open the task';
  end if;

  if public.send_task_reminders(v_now + interval '1 hour') <> 0 then
    raise exception 'FAIL: the next hour sent reminders again';
  end if;

  -- Reassigned: the new assignee is reminded once.
  update public.tasks set assigned_to = lead where id = t_snap;
  -- (send first: an exists() in the same statement wouldn't see its insert)
  n := public.send_task_reminders(v_now + interval '2 hours');
  if n <> 1 or not exists (select 1 from public.notifications where user_id = lead and message like 'T1 snap%') then
    raise exception 'FAIL: the new assignee was not reminded';
  end if;
  -- Re-dated: reminded again for the new date.
  update public.tasks set due_date = v_today + 1 where id = t_snap;
  if public.send_task_reminders(v_now + interval '3 hours') <> 1 then
    raise exception 'FAIL: a re-dated task was not reminded';
  end if;
  -- Done: no reminder.
  update public.tasks set status = 'done', due_date = v_today where id = t_snap;
  if public.send_task_reminders(v_now + interval '4 hours') <> 0 then
    raise exception 'FAIL: reminded a finished task';
  end if;

  raise exception 'T1_CHECKS_PASSED';
end $$;
