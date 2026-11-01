-- Checks for c1_communications. Run AFTER the migration; ends by raising
-- 'C1_CHECKS_PASSED', so nothing is committed. Uses throwaway accounts.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

create or replace function pg_temp.act_as(p_user uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $f$;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  cm uuid := pg_temp.dryrun_account('case_manager');
  rec uuid := pg_temp.dryrun_account('receptionist');
  client uuid;
  nophone uuid;
  log_row public.communications;
  follow uuid;
  ann uuid;
  tpl uuid;
  n int;
  msg text;
  hint text;
begin
  insert into public.clients (first_name, last_name, email, phone) values ('Marie', 'C1', 'Marie.C1@Example.org', '(401) 555-0142') returning id into client;
  insert into public.clients (first_name, last_name) values ('No', 'Contact') returning id into nophone;

  -- Grants: who holds what.
  if not exists (select 1 from public.user_effective_permissions where user_id = cm and permission_key = 'communications.messages.send') then
    raise exception 'FAIL: case manager cannot send messages';
  end if;
  if exists (select 1 from public.user_effective_permissions where user_id = rec and permission_key in ('communications.view', 'communications.messages.send')) then
    raise exception 'FAIL: receptionist reaches the log or messaging';
  end if;
  if not exists (select 1 from public.user_effective_permissions where user_id = rec and permission_key = 'communications.announcements.view') then
    raise exception 'FAIL: receptionist cannot read announcements';
  end if;
  if public.normalize_phone('(401) 555-0142') <> '+14015550142' or public.normalize_phone('1-401-555-0142') <> '+14015550142'
     or public.normalize_phone('+509 3712 3456') <> '+50937123456' or public.normalize_phone('555-0142') is not null then
    raise exception 'FAIL: normalize_phone';
  end if;

  -- ---------- the log ----------
  perform pg_temp.act_as(cm);
  insert into public.communications (client_id, method, direction, summary, follow_up_required)
  values (client, 'phone', 'inbound', 'Asked about ESL classes', true) returning id into follow;
  msg := null;
  begin
    insert into public.communications (client_id, method, summary, follow_up_done_at) values (client, 'phone', 'forged', now());
  exception when others then msg := sqlerrm; end;
  if msg is null or msg not like 'permission denied%' then raise exception 'FAIL: inserted a done follow-up directly (%)', msg; end if;
  msg := null;
  begin update public.communications set summary = 'x' where id = follow; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: updated a log entry directly'; end if;
  log_row := public.set_communication_follow_up_done(follow, true);
  if log_row.follow_up_done_at is null or log_row.follow_up_done_by <> cm then raise exception 'FAIL: follow-up not closed by me'; end if;
  log_row := public.set_communication_follow_up_done(follow, false);
  if log_row.follow_up_done_at is not null or log_row.follow_up_done_by is not null then raise exception 'FAIL: follow-up not reopened'; end if;
  reset role;

  perform pg_temp.act_as(rec);
  msg := null;
  begin perform public.set_communication_follow_up_done(follow, true); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: receptionist closed a follow-up'; end if;
  msg := null;
  begin perform * from public.client_messages(); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: receptionist listed client messages'; end if;
  reset role;

  -- ---------- client messages ----------
  perform pg_temp.act_as(cm);
  -- No consent yet: refused.
  hint := null;
  begin perform public.send_client_message(client, 'sms', 'appointment_reminders', 'ht', null, 'Bonjou {first_name}');
  exception when others then get stacked diagnostics hint = pg_exception_hint; end;
  if hint is distinct from 'consent_required' then raise exception 'FAIL: sent without consent (%)', hint; end if;

  insert into public.contact_consents (client_id, channel, purpose, status, method)
  values (client, 'sms', 'appointment_reminders', 'granted', 'verbal');
  log_row := public.send_client_message(client, 'sms', 'appointment_reminders', 'ht', null, 'Bonjou {first_name}, randevou ou demen.');
  if log_row.method <> 'sms' or log_row.direction <> 'outbound' or log_row.outbound_message_id is null or log_row.created_by <> cm then
    raise exception 'FAIL: the send did not log itself';
  end if;
  if (select summary from public.communications where id = log_row.id) <> 'Bonjou Marie, randevou ou demen.' then
    raise exception 'FAIL: {first_name} not filled in';
  end if;
  select count(*) into n from public.client_messages(client) m where m.to_address = '+14015550142' and m.status = 'queued';
  if n <> 1 then raise exception 'FAIL: queued text not listed (%)', n; end if;
  -- Consent for one channel and purpose doesn't cover another.
  hint := null;
  begin perform public.send_client_message(client, 'email', 'appointment_reminders', 'en', 'Hi', 'Hello');
  exception when others then get stacked diagnostics hint = pg_exception_hint; end;
  if hint is distinct from 'consent_required' then raise exception 'FAIL: email sent on SMS consent'; end if;
  insert into public.contact_consents (client_id, channel, purpose, status, method)
  values (client, 'email', 'program_updates', 'granted', 'written');
  log_row := public.send_client_message(client, 'email', 'program_updates', 'en', 'News for {first_name}', 'Classes start Monday.');
  if not exists (select 1 from public.client_messages(client) m where m.channel = 'email' and m.to_address = 'marie.c1@example.org' and m.subject = 'News for Marie') then
    raise exception 'FAIL: email not queued to the lower-cased address';
  end if;
  -- Revoked consent wins.
  insert into public.contact_consents (client_id, channel, purpose, status, method, captured_at)
  values (client, 'email', 'program_updates', 'revoked', 'verbal', now() + interval '1 second');
  hint := null;
  begin perform public.send_client_message(client, 'email', 'program_updates', 'en', 'Again', 'Again');
  exception when others then get stacked diagnostics hint = pg_exception_hint; end;
  if hint is distinct from 'consent_required' then raise exception 'FAIL: sent after consent was revoked'; end if;
  -- No address.
  hint := null;
  begin perform public.send_client_message(nophone, 'sms', 'program_updates', 'en', null, 'Hi');
  exception when others then get stacked diagnostics hint = pg_exception_hint; end;
  if hint is distinct from 'no_address' then raise exception 'FAIL: no-address not refused (%)', hint; end if;
  -- Too long for a text.
  msg := null;
  begin perform public.send_client_message(client, 'sms', 'appointment_reminders', 'en', null, repeat('x', 481)); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: 481-character text accepted'; end if;
  -- The queue stays closed to staff; cancelling works for the sender.
  msg := null;
  begin perform 1 from public.outbound_messages; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: staff read outbound_messages directly'; end if;
  perform public.cancel_client_message((select m.id from public.client_messages(client) m where m.channel = 'sms' limit 1));
  if (select m.status from public.client_messages(client) m where m.channel = 'sms' limit 1) <> 'cancelled' then
    raise exception 'FAIL: cancel did nothing';
  end if;
  -- Templates: sending staff read, only managers write.
  msg := null;
  begin insert into public.message_templates (name, channel, purpose, language, body) values ('x', 'sms', 'program_updates', 'en', 'x');
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: case manager created a template'; end if;
  reset role;

  perform pg_temp.act_as(admin);
  insert into public.message_templates (name, channel, purpose, language, body)
  values ('Reminder', 'sms', 'appointment_reminders', 'ht', 'Bonjou {first_name}') returning id into tpl;
  msg := null;
  begin insert into public.message_templates (name, channel, purpose, language, subject, body) values ('Bad', 'sms', 'program_updates', 'en', 'subject', 'x');
  exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: a text template took a subject'; end if;
  reset role;
  perform pg_temp.act_as(cm);
  if not exists (select 1 from public.message_templates where id = tpl) then raise exception 'FAIL: case manager cannot read templates'; end if;
  reset role;

  -- The deployed Edge Function's call (p_limit only) still claims email only.
  select count(*) into n from public.claim_outbound_messages(20) m where m.channel <> 'email';
  if n <> 0 then raise exception 'FAIL: default claim took a text'; end if;
  update public.outbound_messages set status = 'queued' where status = 'sending';

  -- ---------- announcements ----------
  perform pg_temp.act_as(cm);
  msg := null;
  begin insert into public.staff_announcements (title, body) values ('x', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: case manager posted an announcement'; end if;
  reset role;

  perform pg_temp.act_as(admin);
  insert into public.staff_announcements (title, body, priority, created_by) values ('Office closed Friday', 'Staff training day.', 'important', cm)
  returning id into ann;
  if (select created_by from public.staff_announcements where id = ann) <> admin then raise exception 'FAIL: author not stamped'; end if;
  reset role;
  if not exists (select 1 from public.notifications where user_id = rec and type = 'staff_announcement' and link = '/communications/announcements') then
    raise exception 'FAIL: receptionist not notified';
  end if;
  if exists (select 1 from public.notifications where user_id = admin and type = 'staff_announcement') then
    raise exception 'FAIL: the author was notified';
  end if;

  perform pg_temp.act_as(rec);
  if not exists (select 1 from public.staff_announcements where id = ann) then raise exception 'FAIL: receptionist cannot read it'; end if;
  insert into public.staff_announcement_reads (announcement_id) values (ann);
  msg := null;
  begin insert into public.staff_announcement_reads (announcement_id, user_id) values (ann, cm); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: marked it read for someone else'; end if;
  update public.staff_announcements set title = 'changed' where id = ann;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: receptionist edited it'; end if;
  reset role;

  perform pg_temp.act_as(admin);
  update public.staff_announcements set archived_at = now() where id = ann;
  if (select archived_by from public.staff_announcements where id = ann) <> admin then raise exception 'FAIL: archived_by not stamped'; end if;
  msg := null;
  begin update public.staff_announcements set created_by = cm where id = ann; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: changed the author'; end if;
  reset role;

  raise exception 'C1_CHECKS_PASSED';
end $$;
