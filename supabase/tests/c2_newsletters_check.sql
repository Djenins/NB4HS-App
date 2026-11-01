-- Checks for c2_newsletters. Run AFTER the migration (and c1); ends by
-- raising 'C2_CHECKS_PASSED', so nothing is committed. Uses throwaway
-- accounts and clients.
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
  yes_case uuid;   -- consented, in Case Management
  yes_food uuid;   -- consented, in Food Distribution only
  no_consent uuid; -- in Case Management, never asked
  revoked uuid;    -- agreed, then opted out
  bad_email uuid;  -- consented, no usable address
  base_all int;
  base_case int;
  nl public.newsletters;
  draft uuid;
  token text;
  lang text;
  n int;
  msg text;
  hint text;
begin
  insert into public.clients (first_name, last_name, email) values ('Yes', 'Case', 'yes.case@example.org') returning id into yes_case;
  insert into public.clients (first_name, last_name, email) values ('Yes', 'Food', 'Yes.Food@Example.org ') returning id into yes_food;
  insert into public.clients (first_name, last_name, email) values ('No', 'Consent', 'no.consent@example.org') returning id into no_consent;
  insert into public.clients (first_name, last_name, email) values ('Opted', 'Out', 'opted.out@example.org') returning id into revoked;
  insert into public.clients (first_name, last_name, email) values ('Bad', 'Email', 'not-an-email') returning id into bad_email;
  insert into public.case_clients (client_id, first_name, last_name) values (yes_case, 'Yes', 'Case'), (no_consent, 'No', 'Consent');
  insert into public.food_clients (client_id, first_name, last_name) values (yes_food, 'Yes', 'Food');
  insert into public.contact_consents (client_id, channel, purpose, status, method, captured_at) values
    (yes_case, 'email', 'program_updates', 'granted', 'written', now() - interval '1 day'),
    (yes_food, 'email', 'program_updates', 'granted', 'verbal', now() - interval '1 day'),
    (yes_food, 'sms', 'program_updates', 'revoked', 'verbal', now()),
    (revoked, 'email', 'program_updates', 'granted', 'verbal', now() - interval '2 days'),
    (revoked, 'email', 'program_updates', 'revoked', 'verbal', now() - interval '1 day'),
    (bad_email, 'email', 'program_updates', 'granted', 'verbal', now() - interval '1 day'),
    (no_consent, 'email', 'appointment_reminders', 'granted', 'verbal', now() - interval '1 day');

  -- Audience counts (others may exist on the database already, so compare deltas).
  delete from public.app_settings where key = 'mailing_address';
  if not exists (select 1 from public.newsletter_audience_clients('all') c where c.id = yes_case)
     or not exists (select 1 from public.newsletter_audience_clients('all') c where c.id = yes_food) then
    raise exception 'FAIL: consenting clients missing from the audience';
  end if;
  if exists (select 1 from public.newsletter_audience_clients('all') c where c.id in (no_consent, revoked, bad_email)) then
    raise exception 'FAIL: a client without consent or address is in the audience';
  end if;
  if exists (select 1 from public.newsletter_audience_clients('case_management') c where c.id = yes_food) then
    raise exception 'FAIL: the program audience took someone outside the program';
  end if;
  perform pg_temp.act_as(admin);
  base_all := public.newsletter_audience_count('all');
  base_case := public.newsletter_audience_count('case_management');
  reset role;

  -- A case manager can't see or write newsletters.
  perform pg_temp.act_as(cm);
  msg := null;
  begin insert into public.newsletters (subject, body) values ('x', 'x'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: case manager made a newsletter'; end if;
  msg := null;
  begin perform public.newsletter_audience_count('all'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: case manager counted the audience'; end if;
  reset role;

  -- Draft, then send.
  perform pg_temp.act_as(admin);
  insert into public.newsletters (subject, body, language, audience) values ('Fall classes', 'Classes start Monday.', 'fr', 'case_management')
  returning id into draft;
  msg := null;
  begin update public.newsletters set status = 'sent' where id = draft; exception when others then msg := sqlerrm; end;
  if msg is null or msg not like 'permission denied%' then raise exception 'FAIL: marked a draft sent directly (%)', msg; end if;
  hint := null;
  begin perform public.send_newsletter(draft); exception when others then get stacked diagnostics hint = pg_exception_hint; end;
  if hint is distinct from 'no_mailing_address' then raise exception 'FAIL: sent without a mailing address (%)', hint; end if;
  perform public.admin_set_setting('mailing_address', to_jsonb('  123 Main St, Providence, RI 02903  '::text));
  if (select value #>> '{}' from public.app_settings where key = 'mailing_address') <> '123 Main St, Providence, RI 02903' then
    raise exception 'FAIL: mailing address not trimmed';
  end if;
  msg := null;
  begin perform public.admin_set_setting('mailing_address', to_jsonb('short'::text)); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: accepted a 5-character address'; end if;
  perform public.admin_set_setting('closing_time', to_jsonb('17:00'::text));

  nl := public.send_newsletter(draft);
  if nl.status <> 'sent' or nl.recipient_count <> base_case or nl.sent_by <> admin then
    raise exception 'FAIL: send result % % (expected %)', nl.status, nl.recipient_count, base_case;
  end if;
  reset role;
  select count(*) into n from public.communications where outbound_message_id in
    (select outbound_message_id from public.newsletter_recipients where newsletter_id = draft) and summary = 'Newsletter: Fall classes';
  if n <> base_case then raise exception 'FAIL: % log entries for % recipients', n, base_case; end if;
  perform pg_temp.act_as(admin);
  if not exists (select 1 from public.newsletter_stats() s where s.newsletter_id = draft and s.waiting = base_case) then
    raise exception 'FAIL: stats';
  end if;
  hint := null;
  begin perform public.send_newsletter(draft); exception when others then get stacked diagnostics hint = pg_exception_hint; end;
  if hint is distinct from 'already_sent' then raise exception 'FAIL: sent twice'; end if;
  update public.newsletters set subject = 'changed' where id = draft;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: edited a sent newsletter'; end if;
  reset role;

  if (select payload->>'mailing_address' from public.outbound_messages m join public.newsletter_recipients r on r.outbound_message_id = m.id
      where r.newsletter_id = draft and r.client_id = yes_case) <> '123 Main St, Providence, RI 02903' then
    raise exception 'FAIL: the address isn''t in the queued email';
  end if;

  -- Unsubscribe, signed out.
  select unsubscribe_token into token from public.newsletter_recipients where newsletter_id = draft and client_id = yes_case;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  lang := public.unsubscribe_newsletter(token);
  if lang is distinct from 'fr' then raise exception 'FAIL: unsubscribe returned %', lang; end if;
  if public.unsubscribe_newsletter(token) is distinct from 'fr' then raise exception 'FAIL: second unsubscribe'; end if;
  if public.unsubscribe_newsletter(repeat('0', 64)) is not null or public.unsubscribe_newsletter('x') is not null then
    raise exception 'FAIL: unknown token answered';
  end if;
  msg := null;
  begin perform 1 from public.newsletter_recipients; exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: anon read recipients'; end if;
  reset role;
  select count(*) into n from public.contact_consents where client_id = yes_case and channel = 'email' and purpose = 'program_updates' and status = 'revoked';
  if n <> 1 then raise exception 'FAIL: % revoked rows after two unsubscribes', n; end if;

  perform pg_temp.act_as(admin);
  if public.newsletter_audience_count('all') <> base_all - 1 then raise exception 'FAIL: unsubscribed client still in the audience'; end if;
  if not exists (select 1 from public.newsletter_stats() s where s.newsletter_id = draft and s.unsubscribed = 1) then
    raise exception 'FAIL: unsubscribe not counted';
  end if;
  -- Cancel stops what's waiting.
  n := public.cancel_newsletter(draft);
  if n <> base_case or (select status from public.newsletters where id = draft) <> 'cancelled' then
    raise exception 'FAIL: cancel stopped % of %', n, base_case;
  end if;
  reset role;

  raise exception 'C2_CHECKS_PASSED';
end $$;
