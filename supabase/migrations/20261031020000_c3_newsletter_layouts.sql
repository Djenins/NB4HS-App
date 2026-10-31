-- c3 -- newsletter layouts: a newsletter can be built from one of seven
-- email layouts (single column, F-pattern, zig zag, multi column, inverted
-- pyramid, hybrid, double column) instead of plain text. Builds on c2.
-- NOT APPLIED to live. Needs a rolled-back dry run of
-- supabase/tests/c3_newsletter_layouts_check.sql against live, then the
-- owner's approval, like every migration (plans/goals.md).
--
-- What it adds:
--   * newsletters.layout ('plain' as before, or a layout key) and
--     newsletters.content (the layout's blocks: hero image, headline, intro,
--     button, sub-heading, sections). `body` stays required: the app stores
--     the plain-text version there, which is also the email's text part.
--     send_newsletter() now copies layout and content into each queued email;
--     send-outbound renders them (supabase/functions/send-outbound/
--     newsletterLayout.js, the same file the editor previews with).
--   * A public storage bucket, newsletter-images, for pictures in newsletters.
--     Emails can only show images at a public address, so these files are
--     readable by anyone with the link -- never put client photos or
--     documents in it. Only people who may send newsletters upload or remove
--     files; 2 MB at most; PNG, JPEG, GIF or WebP.
--
-- Rollback: supabase/rollback/c3_newsletter_layouts_down.sql.

-- ======================================================================
-- 1. Layout and content on newsletters
-- ======================================================================
alter table public.newsletters
  add column layout text not null default 'plain'
    check (layout in ('plain', 'single', 'f_pattern', 'zigzag', 'multi', 'pyramid', 'hybrid', 'double')),
  add column content jsonb
    check (content is null or (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 60000));
grant insert (layout, content) on public.newsletters to authenticated;
grant update (layout, content) on public.newsletters to authenticated;

-- c2's send_newsletter(), with layout and content in each queued email.
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
      'layout', n.layout, 'content', coalesce(n.content, '{}'::jsonb),
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

-- ======================================================================
-- 2. Newsletter images (public)
-- ======================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('newsletter-images', 'newsletter-images', true, 2097152, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve files by URL without a policy; these govern the API.
create policy newsletter_images_select on storage.objects for select to authenticated
  using (bucket_id = 'newsletter-images' and (select public.has_permission('communications.newsletters.send')));
create policy newsletter_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'newsletter-images' and (select public.has_permission('communications.newsletters.send')));
create policy newsletter_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'newsletter-images' and (select public.has_permission('communications.newsletters.send')));
