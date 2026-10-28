-- Checks for p6b_outbound_email (after p6a). Run AFTER the migrations, inside
-- the same transaction. Always ends by raising 'P6B_CHECKS_PASSED ...', so
-- nothing is committed; any failed check raises its own message first.
do $$
declare
  admin uuid := (select id from public.profiles where role = 'administrator' and active order by created_at limit 1);
  staff uuid := (select id from public.profiles where role = 'staff' and active order by created_at limit 1);
  cm uuid := (select id from public.profiles where role = 'case_manager' and active order by created_at limit 1);
  v_period uuid;
  v_report uuid;
  m public.outbound_messages;
  n int;
  queued_before bigint;
  msg text;
begin
  if admin is null or staff is null or cm is null then
    raise exception 'need an active administrator, staff member and case manager to run these checks';
  end if;
  perform public.ensure_reporting_periods();
  -- Reports can only start in a period that has begun (t4): use the latest
  -- such period, or add one for this rolled-back run.
  select id into v_period from public.reporting_periods
  where period_start <= current_date order by period_start desc limit 1;
  if v_period is null then
    insert into public.reporting_periods (schedule_id, period_start, period_end, due_at)
    select s.id, current_date - 7, current_date + 6, ((current_date + 7) + s.deadline_time) at time zone s.time_zone
    from public.reporting_schedules s where s.active order by s.created_at limit 1
    returning id into v_period;
  end if;
  insert into public.program_staff (user_id, program, program_role, active) values (cm, 'staff_reports', 'reviewer', true)
  on conflict (user_id, program) do update set program_role = 'reviewer', active = true;

  -- ---------------- nobody but the functions touches the queue ----------------
  if has_table_privilege('authenticated', 'public.outbound_messages', 'SELECT')
     or has_table_privilege('anon', 'public.outbound_messages', 'SELECT') then
    raise exception 'FAIL: clients can read the email queue';
  end if;
  if has_function_privilege('authenticated', 'public.claim_outbound_messages(int)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.complete_outbound_message(uuid, boolean, text, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enqueue_email(uuid, text, jsonb, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.invoke_send_outbound()', 'EXECUTE') then
    raise exception 'FAIL: a signed-in user can run a sending function';
  end if;
  if not has_function_privilege('service_role', 'public.claim_outbound_messages(int)', 'EXECUTE') then
    raise exception 'FAIL: the Edge Function cannot claim messages';
  end if;
  if not exists (select 1 from cron.job where jobname = 'send-outbound' and schedule = '*/5 * * * *') then
    raise exception 'FAIL: no send-outbound job';
  end if;

  -- ---------------- submit queues a content-free email to the reviewer ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.staff_reports (period_id, programs, activities, accomplishments, challenges, no_assistance_needed, next_goals)
  values (v_period, array['organization'], 'SECRET-ACTIVITY text', 'Acc', 'Chal', true, 'Goals') returning id into v_report;
  perform public.submit_staff_report(v_report);
  reset role;

  select * into m from public.outbound_messages where template = 'staff_report_submitted' and to_user_id = cm and payload ->> 'link' = '/staffreports/' || v_report;
  if m.id is null then raise exception 'FAIL: no email queued for the reviewer'; end if;
  if m.status <> 'queued' or m.payload::text like '%SECRET-ACTIVITY%' then
    raise exception 'FAIL: the reviewer email is not queued, or carries report content (%)', m.payload;
  end if;
  if exists (select 1 from public.outbound_messages where template = 'staff_report_submitted' and to_user_id in (staff, admin)) then
    raise exception 'FAIL: a non-reviewer was emailed';
  end if;

  -- ---------------- revision request: the comment stays in the app ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', cm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.request_staff_report_revision(v_report, 'SECRET-COMMENT please add numbers');
  reset role;
  select * into m from public.outbound_messages where template = 'staff_report_revision_requested' and to_user_id = staff;
  if m.id is null or m.payload::text like '%SECRET-COMMENT%' then
    raise exception 'FAIL: the author was not emailed, or the email carries the comment';
  end if;

  -- resubmitting queues a new email (new version), not a duplicate of the old one
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.submit_staff_report(v_report);
  reset role;
  select count(*) into n from public.outbound_messages where template = 'staff_report_submitted' and to_user_id = cm and payload ->> 'link' = '/staffreports/' || v_report;
  if n <> 2 then raise exception 'FAIL: expected one email per submitted version, got %', n; end if;

  -- ---------------- sending: claim, retry with backoff, fail after 5, sent on 2xx ----------------
  set local role service_role;
  select count(*) into n from public.claim_outbound_messages(100);
  if n < 3 then raise exception 'FAIL: claimed % messages, expected at least 3', n; end if;
  select count(*) into n from public.claim_outbound_messages(100);
  if n <> 0 then raise exception 'FAIL: a message was claimed twice'; end if;

  select * into m from public.outbound_messages where template = 'staff_report_revision_requested' and to_user_id = staff;
  perform public.complete_outbound_message(m.id, false, null, 'provider 500');
  select * into m from public.outbound_messages where id = m.id;
  if m.status <> 'queued' or m.next_attempt_at < now() + interval '4 minutes' or m.attempts <> 1 then
    raise exception 'FAIL: first failure did not back off 5 minutes (% % %)', m.status, m.next_attempt_at, m.attempts;
  end if;
  for i in 2..5 loop
    update public.outbound_messages set next_attempt_at = now() - interval '1 second' where id = m.id;
    perform * from public.claim_outbound_messages(100);
    perform public.complete_outbound_message(m.id, false, null, 'provider 500 again');
  end loop;
  select * into m from public.outbound_messages where id = m.id;
  if m.status <> 'failed' or m.attempts <> 5 then raise exception 'FAIL: not failed after 5 attempts (% %)', m.status, m.attempts; end if;

  select * into m from public.outbound_messages where template = 'staff_report_submitted' and to_user_id = cm and status = 'sending' limit 1;
  perform public.complete_outbound_message(m.id, true, 'resend-abc', null);
  select * into m from public.outbound_messages where id = m.id;
  if m.status <> 'sent' or m.provider_message_id <> 'resend-abc' or m.sent_at is null then
    raise exception 'FAIL: a 2xx did not mark the message sent';
  end if;
  -- a late report for a message no longer "sending" changes nothing
  perform public.complete_outbound_message(m.id, false, null, 'late');
  if (select status from public.outbound_messages where id = m.id) <> 'sent' then raise exception 'FAIL: a late result overwrote "sent"'; end if;
  reset role;

  -- ---------------- the trigger is idle until configured ----------------
  update public.outbound_messages set status = 'queued', next_attempt_at = now() - interval '1 minute' where status = 'sending';
  select count(*) into queued_before from net.http_request_queue;
  if not exists (select 1 from vault.decrypted_secrets where name = 'send_outbound_url') then
    perform public.invoke_send_outbound();
    if (select count(*) from net.http_request_queue) <> queued_before then
      raise exception 'FAIL: the trigger called out without being configured';
    end if;
  end if;

  -- ---------------- queue health ----------------
  perform set_config('request.jwt.claims', json_build_object('sub', staff, 'role', 'authenticated')::text, true);
  set local role authenticated;
  msg := null;
  begin perform * from public.outbound_queue_health(); exception when others then msg := sqlerrm; end;
  reset role;
  if msg is null then raise exception 'FAIL: staff read the queue health'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select failed into n from public.outbound_queue_health();
  reset role;
  if n < 1 then raise exception 'FAIL: queue health does not count the failed message'; end if;

  raise exception 'P6B_CHECKS_PASSED emails queued without content; claim, backoff, failure and sent behave; idle until configured';
end;
$$;
