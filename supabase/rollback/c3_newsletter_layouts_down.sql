-- Undo c3_newsletter_layouts. Layout newsletters already sent stay in the
-- queue with their layout in the payload (send-outbound then renders them
-- only if it still has the layouts); drafts keep their plain-text body.
-- The newsletter-images bucket stays: Supabase only lets the Storage API
-- delete files and buckets (deleting the rows would orphan the files). After
-- this script, nobody can upload to it; empty and delete it from the Storage
-- dashboard if you want it gone. Newsletters already delivered lose their
-- pictures when you do.
begin;
drop policy newsletter_images_delete on storage.objects;
drop policy newsletter_images_insert on storage.objects;
drop policy newsletter_images_select on storage.objects;

-- c2's send_newsletter().
create or replace function public.send_newsletter(p_id uuid)
returns public.newsletters
language plpgsql security definer set search_path = public
as $$
declare
  n public.newsletters;
  addr text;
  total int;
  c public.clients;
  token text;
  msg_id uuid;
begin
  if not public.has_permission('communications.newsletters.send') then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  select * into n from public.newsletters where id = p_id for update;
  if not found then
    raise exception 'newsletter not found' using errcode = 'P0002';
  end if;
  if n.status <> 'draft' then
    raise exception 'this newsletter has already been sent' using errcode = '23514', hint = 'already_sent';
  end if;
  select btrim(value #>> '{}') into addr from public.app_settings where key = 'mailing_address';
  if coalesce(addr, '') = '' then
    raise exception 'set the organization''s mailing address first' using errcode = '23514', hint = 'no_mailing_address';
  end if;
  select count(*) into total from public.newsletter_audience_clients(n.audience);
  if total = 0 then
    raise exception 'no client in this audience has agreed to program updates by email' using errcode = '23514', hint = 'no_recipients';
  end if;
  if total > 5000 then
    raise exception 'a newsletter can go to at most 5,000 clients' using errcode = '23514', hint = 'too_many';
  end if;

  for c in select * from public.newsletter_audience_clients(n.audience) loop
    insert into public.newsletter_recipients (newsletter_id, client_id) values (n.id, c.id)
    returning unsubscribe_token into token;
    insert into public.outbound_messages (channel, to_address, to_client_id, template, payload, dedupe_key, queued_by)
    values ('email', lower(btrim(c.email)), c.id, 'newsletter', jsonb_build_object(
      'subject', n.subject, 'body', n.body, 'language', n.language,
      'unsubscribe_token', token, 'mailing_address', addr, 'newsletter_id', n.id
    ), 'newsletter:' || n.id || ':' || c.id, auth.uid())
    returning id into msg_id;
    update public.newsletter_recipients set outbound_message_id = msg_id where newsletter_id = n.id and client_id = c.id;
    insert into public.communications (client_id, contact_date, method, direction, summary, follow_up_required, created_by, outbound_message_id)
    values (c.id, (now() at time zone 'America/New_York')::date, 'email', 'outbound', left('Newsletter: ' || n.subject, 2000), false, auth.uid(), msg_id);
  end loop;

  update public.newsletters set status = 'sent', recipient_count = total, sent_by = auth.uid(), sent_at = now()
  where id = n.id returning * into n;
  return n;
end;
$$;

revoke insert (layout, content), update (layout, content) on public.newsletters from authenticated;
alter table public.newsletters drop column content, drop column layout;

delete from supabase_migrations.schema_migrations where version = '20261031020000';
commit;
