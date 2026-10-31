-- Checks for c4_newsletter_blocks. Run AFTER the migration (and c1-c3);
-- ends by raising 'C4_CHECKS_PASSED', so nothing is committed.
create or replace function pg_temp.dryrun_account(p_role text) returns uuid language plpgsql as $f$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'dryrun-' || uid || '@example.invalid', '{}');
  update public.profiles set role = p_role, active = true, name = 'Dry run ' || p_role where id = uid;
  return uid;
end $f$;

do $$
declare
  admin uuid := pg_temp.dryrun_account('administrator');
  client uuid;
  draft uuid;
  payload jsonb;
  msg text;
begin
  insert into public.clients (first_name, last_name, email) values ('Block', 'Builder', 'block.builder@example.org') returning id into client;
  insert into public.contact_consents (client_id, channel, purpose, status, method, captured_at)
  values (client, 'email', 'program_updates', 'granted', 'written', now() - interval '1 day');
  insert into public.app_settings (key, value) values ('mailing_address', to_jsonb('123 Main St, Providence, RI 02903'::text))
  on conflict (key) do update set value = excluded.value;

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.newsletters (subject, body, layout, content)
  values ('Blocks', 'Your title', 'custom', '{"blocks":[{"id":"b1","type":"title","text":"Your title"},{"id":"b2","type":"link","label":"Go","url":"https://x.org"}]}')
  returning id into draft;
  msg := null;
  begin insert into public.newsletters (subject, body, layout) values ('x', 'x', 'canvas'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: unknown layout accepted'; end if;
  perform public.send_newsletter(draft);
  reset role;

  select m.payload into payload from public.outbound_messages m
    join public.newsletter_recipients r on r.outbound_message_id = m.id
    where r.newsletter_id = draft and r.client_id = client;
  if payload->>'layout' <> 'custom' or jsonb_array_length(payload->'content'->'blocks') <> 2 then
    raise exception 'FAIL: blocks not in the queued email (%)', payload;
  end if;

  raise exception 'C4_CHECKS_PASSED';
end $$;
