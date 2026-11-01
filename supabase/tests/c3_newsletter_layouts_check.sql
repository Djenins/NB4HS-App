-- Checks for c3_newsletter_layouts. Run AFTER the migration (and c1, c2);
-- ends by raising 'C3_CHECKS_PASSED', so nothing is committed.
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
  client uuid;
  draft uuid;
  payload jsonb;
  msg text;
begin
  insert into public.clients (first_name, last_name, email) values ('Lay', 'Out', 'lay.out@example.org') returning id into client;
  insert into public.contact_consents (client_id, channel, purpose, status, method, captured_at)
  values (client, 'email', 'program_updates', 'granted', 'written', now() - interval '1 day');
  insert into public.app_settings (key, value) values ('mailing_address', to_jsonb('123 Main St, Providence, RI 02903'::text))
  on conflict (key) do update set value = excluded.value;

  perform pg_temp.act_as(admin);
  insert into public.newsletters (subject, body, layout, content)
  values ('Fall', 'Fall classes', 'zigzag', '{"headline":"Fall classes","sections":[{"title":"ESL"}]}')
  returning id into draft;
  msg := null;
  begin insert into public.newsletters (subject, body, layout) values ('x', 'x', 'carousel'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: unknown layout accepted'; end if;
  msg := null;
  begin insert into public.newsletters (subject, body, content) values ('x', 'x', '[1,2]'); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: non-object content accepted'; end if;
  msg := null;
  begin insert into public.newsletters (subject, body, content) values ('x', 'x', jsonb_build_object('intro', repeat('x', 60001))); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: oversized content accepted'; end if;
  update public.newsletters set layout = 'multi' where id = draft;
  perform public.send_newsletter(draft);
  reset role;

  select m.payload into payload from public.outbound_messages m
    join public.newsletter_recipients r on r.outbound_message_id = m.id
    where r.newsletter_id = draft and r.client_id = client;
  if payload->>'layout' <> 'multi' or payload->'content'->>'headline' <> 'Fall classes' then
    raise exception 'FAIL: layout/content not in the queued email (%)', payload;
  end if;

  -- Image bucket: public, limited, writable only by newsletter senders.
  if not exists (select 1 from storage.buckets where id = 'newsletter-images' and public and file_size_limit = 2097152) then
    raise exception 'FAIL: bucket';
  end if;
  perform pg_temp.act_as(cm);
  msg := null;
  begin insert into storage.objects (bucket_id, name, owner) values ('newsletter-images', 'c3-check.png', cm); exception when others then msg := sqlerrm; end;
  if msg is null then raise exception 'FAIL: case manager uploaded a newsletter image'; end if;
  reset role;
  perform pg_temp.act_as(admin);
  insert into storage.objects (bucket_id, name, owner) values ('newsletter-images', 'c3-check.png', admin);
  reset role;

  raise exception 'C3_CHECKS_PASSED';
end $$;
