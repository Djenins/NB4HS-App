-- c1 -- the Communications module: one place for the client communications
-- log, messages sent to clients, and staff announcements.
-- NOT APPLIED to live. Needs a rolled-back dry run of
-- supabase/tests/c1_communications_check.sql against live, then the owner's
-- approval, like every migration (plans/goals.md).
--
-- What it adds:
--   * A shared module `communications` and five permissions:
--       communications.view                 the log across every client (sensitive)
--       communications.messages.send        email / text a client (sensitive)
--       communications.templates.manage     client message templates
--       communications.announcements.view   read staff announcements
--       communications.announcements.post   post, edit and archive them
--     Granted to the legacy account types that read the communications log
--     today (administrator, staff, case manager, job developer); every account
--     type reads announcements; administrators and Executive Oversight post.
--     Custom roles made in Administration get nothing until an admin adds it.
--   * Follow-ups on the existing `communications` log can be marked done
--     (set_communication_follow_up_done). Direct writes are limited to the
--     columns the app has always written, so nobody can fake a "done" or a
--     link to a sent message.
--   * Client messages go through the existing outbound_messages queue (p6b):
--     it now takes channel 'sms' as well as 'email' and a 'client_message'
--     template. send_client_message() refuses unless the client's newest
--     consent for that channel and purpose is "granted" (contact_consents),
--     queues the message and writes the log entry in the same transaction.
--     At most 60 messages per staff member per hour. Nothing leaves until a
--     provider is configured for that channel (send-outbound: Resend for
--     email, Twilio for SMS); until then messages wait as "queued".
--     claim_outbound_messages() gains a channel list so the Edge Function only
--     claims what it can send; its default (email only) keeps the deployed
--     function working unchanged.
--   * message_templates: reusable texts per channel, purpose and language
--     (en / ht / fr), with {first_name} filled in when sent.
--   * staff_announcements (+ per-person read marks). Posting one sends an
--     in-app notification to everyone who can read announcements.
--
-- Rollback: supabase/rollback/c1_communications_down.sql.

-- ======================================================================
-- 1. Module, permissions, grants
-- ======================================================================
insert into public.app_modules (key, parent_key, kind, name_en, name_ht, name_fr, sort_order, implemented, outreach_program) values
  ('communications', null, 'shared', 'Communications', 'Kominikasyon', 'Communications', 108, true, null);

insert into public.permissions (key, module_key, scoped, sensitivity, sort_order, description) values
  ('communications.view', 'communications', false, 'sensitive', 1, 'Communications log across every client'),
  ('communications.messages.send', 'communications', false, 'sensitive', 2, 'Send email and text messages to clients'),
  ('communications.templates.manage', 'communications', false, 'normal', 3, 'Manage client message templates'),
  ('communications.announcements.view', 'communications', false, 'normal', 4, 'Read staff announcements'),
  ('communications.announcements.post', 'communications', false, 'normal', 5, 'Post, edit and archive staff announcements');

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, v.permission_key, null
from (values
  ('legacy_administrator', 'communications.view'), ('legacy_administrator', 'communications.messages.send'),
  ('legacy_administrator', 'communications.templates.manage'),
  ('legacy_administrator', 'communications.announcements.view'), ('legacy_administrator', 'communications.announcements.post'),
  ('legacy_staff', 'communications.view'), ('legacy_staff', 'communications.messages.send'),
  ('legacy_staff', 'communications.announcements.view'),
  ('legacy_case_manager', 'communications.view'), ('legacy_case_manager', 'communications.messages.send'),
  ('legacy_case_manager', 'communications.announcements.view'),
  ('legacy_job_developer', 'communications.view'), ('legacy_job_developer', 'communications.messages.send'),
  ('legacy_job_developer', 'communications.announcements.view'),
  ('legacy_receptionist', 'communications.announcements.view'),
  ('executive_oversight', 'communications.announcements.view'), ('executive_oversight', 'communications.announcements.post')
) as v(role_key, permission_key)
join public.roles r on r.key = v.role_key;

-- ======================================================================
-- 2. The communications log: follow-ups that can be closed
-- ======================================================================
alter table public.communications
  add column follow_up_done_at timestamptz,
  add column follow_up_done_by uuid references public.profiles(id) on delete set null,
  add column outbound_message_id uuid references public.outbound_messages(id) on delete set null;
create index communications_contact_date_idx on public.communications (contact_date desc, created_at desc);
create index communications_open_follow_ups_idx on public.communications (contact_date)
  where follow_up_required and follow_up_done_at is null;

-- Staff insert the columns the log form has always written; the rest is set
-- only by the functions below. There is no update policy, as before.
revoke insert, update on public.communications from authenticated;
grant insert (client_id, contact_date, method, direction, summary, follow_up_required, created_by)
  on public.communications to authenticated;

create or replace function public.set_communication_follow_up_done(p_id uuid, p_done boolean default true)
returns public.communications
language plpgsql security definer set search_path = public
as $$
declare
  r public.communications;
begin
  if not (public.has_org('participants.notes.create') and public.has_org('participants.notes.view')) then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  update public.communications
  set follow_up_done_at = case when p_done then now() end,
      follow_up_done_by = case when p_done then auth.uid() end
  where id = p_id and follow_up_required
  returning * into r;
  if not found then
    raise exception 'follow-up not found' using errcode = 'P0002';
  end if;
  return r;
end;
$$;
revoke all on function public.set_communication_follow_up_done(uuid, boolean) from public, anon;
grant execute on function public.set_communication_follow_up_done(uuid, boolean) to authenticated;

-- ======================================================================
-- 3. Client messages
-- ======================================================================
alter table public.outbound_messages drop constraint outbound_messages_channel_check;
alter table public.outbound_messages add constraint outbound_messages_channel_check check (channel in ('email', 'sms'));
alter table public.outbound_messages drop constraint outbound_messages_to_address_check;
alter table public.outbound_messages add constraint outbound_messages_to_address_check check (
  (channel = 'email' and to_address ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
  or (channel = 'sms' and to_address ~ '^\+[1-9][0-9]{7,14}$'));
alter table public.outbound_messages drop constraint outbound_messages_template_check;
alter table public.outbound_messages add constraint outbound_messages_template_check check (template in (
  'staff_report_submitted', 'staff_report_revision_requested', 'staff_report_acknowledged', 'client_message'));
alter table public.outbound_messages
  add column to_client_id uuid references public.clients(id) on delete set null,
  add column queued_by uuid references public.profiles(id) on delete set null;
create index outbound_messages_client_idx on public.outbound_messages (to_client_id, created_at desc) where to_client_id is not null;
create index outbound_messages_queued_by_idx on public.outbound_messages (queued_by, created_at desc) where queued_by is not null;

-- Only channels the Edge Function can send are claimed. The default keeps
-- the deployed function (which passes only p_limit) on email.
drop function public.claim_outbound_messages(int);
create function public.claim_outbound_messages(p_limit int default 20, p_channels text[] default array['email'])
returns setof public.outbound_messages
language plpgsql security definer set search_path = public
as $$
begin
  -- A send that never reported back (function crash) is retried after 15 minutes.
  update public.outbound_messages set status = 'queued'
  where status = 'sending' and updated_at < now() - interval '15 minutes';

  return query
    update public.outbound_messages m
    set status = 'sending', attempts = m.attempts + 1
    where m.id in (
      select id from public.outbound_messages
      where status = 'queued' and next_attempt_at <= now() and channel = any(coalesce(p_channels, array['email']))
      order by next_attempt_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
    )
    returning m.*;
end;
$$;
revoke all on function public.claim_outbound_messages(int, text[]) from public, anon, authenticated;
grant execute on function public.claim_outbound_messages(int, text[]) to service_role;

-- "+14015551234" from what staff typed: 10 US digits, 1 + 10 digits, or an
-- international number written with a leading +. Null when it isn't one.
create or replace function public.normalize_phone(p_phone text)
returns text
language sql immutable set search_path = public
as $$
  select case
    when d ~ '^[0-9]{10}$' and not intl then '+1' || d
    when d ~ '^1[0-9]{10}$' and not intl then '+' || d
    when intl and d ~ '^[1-9][0-9]{7,14}$' then '+' || d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as d,
               btrim(coalesce(p_phone, '')) like '+%' as intl) x
$$;

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  channel text not null check (channel in ('email', 'sms')),
  purpose text not null check (purpose in ('program_updates', 'appointment_reminders')),
  language text not null check (language in ('en', 'ht', 'fr')),
  subject text check (subject is null or char_length(subject) <= 150),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channel = 'email' or subject is null),
  check (channel = 'email' or char_length(body) <= 480)
);
create trigger message_templates_set_updated_at before update on public.message_templates
  for each row execute function public.set_updated_at();
create trigger message_templates_stamp_actor before insert or update on public.message_templates
  for each row execute function public.stamp_actor_column('created_by');
alter table public.message_templates enable row level security;
create policy message_templates_select on public.message_templates for select to authenticated
  using ((select public.has_permission('communications.messages.send'))
      or (select public.has_permission('communications.templates.manage')));
create policy message_templates_insert on public.message_templates for insert to authenticated
  with check ((select public.has_permission('communications.templates.manage')));
create policy message_templates_update on public.message_templates for update to authenticated
  using ((select public.has_permission('communications.templates.manage')))
  with check ((select public.has_permission('communications.templates.manage')));
-- No delete: a template is switched off (active = false).

-- Whoever sends messages reads and records consent too (SNAP's own policies stay).
create policy contact_consents_select_communications on public.contact_consents for select to authenticated
  using ((select public.has_permission('communications.messages.send')));
create policy contact_consents_insert_communications on public.contact_consents for insert to authenticated
  with check (captured_by = auth.uid() and (select public.has_permission('communications.messages.send')));

-- Queue one message to a client and log it. Refuses without a valid address,
-- without granted consent for that channel and purpose, or over the hourly cap.
create or replace function public.send_client_message(
  p_client_id uuid, p_channel text, p_purpose text, p_language text,
  p_subject text, p_body text, p_template_id uuid default null
)
returns public.communications
language plpgsql security definer set search_path = public
as $$
declare
  c public.clients;
  addr text;
  subj text := '';
  msg text;
  consent text;
  msg_id uuid;
  r public.communications;
begin
  if not (public.has_permission('communications.messages.send') and public.has_org('participants.notes.create')) then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  if p_channel is null or p_channel not in ('email', 'sms') then
    raise exception 'unknown channel' using errcode = '22023';
  end if;
  if p_purpose is null or p_purpose not in ('program_updates', 'appointment_reminders') then
    raise exception 'unknown purpose' using errcode = '22023';
  end if;
  if p_language is null or p_language not in ('en', 'ht', 'fr') then
    raise exception 'unknown language' using errcode = '22023';
  end if;

  select * into c from public.clients where id = p_client_id;
  if not found then
    raise exception 'client not found' using errcode = 'P0002';
  end if;

  msg := btrim(replace(coalesce(p_body, ''), '{first_name}', btrim(coalesce(c.first_name, ''))));
  if msg = '' then
    raise exception 'a message is required' using errcode = '23514';
  end if;
  if char_length(msg) > 2000 or (p_channel = 'sms' and char_length(msg) > 480) then
    raise exception 'the message is too long' using errcode = '23514';
  end if;

  if p_channel = 'email' then
    subj := btrim(replace(coalesce(p_subject, ''), '{first_name}', btrim(coalesce(c.first_name, ''))));
    if subj = '' or char_length(subj) > 150 then
      raise exception 'a subject of up to 150 characters is required' using errcode = '23514';
    end if;
    addr := lower(btrim(coalesce(c.email, '')));
    if addr !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
      raise exception 'this client has no valid email address' using errcode = '23514', hint = 'no_address';
    end if;
  else
    addr := public.normalize_phone(c.phone);
    if addr is null then
      raise exception 'this client has no valid mobile number' using errcode = '23514', hint = 'no_address';
    end if;
  end if;

  select status into consent from public.contact_consents
  where client_id = c.id and channel = p_channel and purpose = p_purpose
  order by captured_at desc limit 1;
  if consent is distinct from 'granted' then
    raise exception 'this client has not agreed to receive these messages' using errcode = '42501', hint = 'consent_required';
  end if;

  if (select count(*) from public.outbound_messages
      where queued_by = auth.uid() and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'too many messages in the last hour; try again later' using errcode = '54000', hint = 'rate_limited';
  end if;

  insert into public.outbound_messages (channel, to_address, to_client_id, template, payload, dedupe_key, queued_by)
  values (p_channel, addr, c.id, 'client_message', jsonb_build_object(
    'subject', subj, 'body', msg, 'language', p_language, 'purpose', p_purpose, 'template_id', p_template_id
  ), 'client:' || gen_random_uuid(), auth.uid())
  returning id into msg_id;

  insert into public.communications (client_id, contact_date, method, direction, summary, follow_up_required, created_by, outbound_message_id)
  values (c.id, (now() at time zone 'America/New_York')::date, p_channel, 'outbound',
          left(case when subj <> '' then subj || E'\n\n' else '' end || msg, 2000), false, auth.uid(), msg_id)
  returning * into r;
  return r;
end;
$$;
revoke all on function public.send_client_message(uuid, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.send_client_message(uuid, text, text, text, text, text, uuid) to authenticated;

-- Messages sent to clients (the queue itself stays closed to staff).
create or replace function public.client_messages(p_client_id uuid default null, p_limit int default 200)
returns table (id uuid, client_id uuid, channel text, to_address text, subject text, body text, status text,
               attempts int, last_error text, sent_at timestamptz, created_at timestamptz, queued_by uuid, queued_by_name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not ((public.has_permission('communications.view') or public.has_permission('communications.messages.send'))
          and public.has_org('participants.notes.view')) then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  return query
    select m.id, m.to_client_id, m.channel, m.to_address, m.payload->>'subject', m.payload->>'body', m.status,
           m.attempts, m.last_error, m.sent_at, m.created_at, m.queued_by, coalesce(nullif(btrim(p.name), ''), p.email)
    from public.outbound_messages m
    left join public.profiles p on p.id = m.queued_by
    where m.template = 'client_message' and (p_client_id is null or m.to_client_id = p_client_id)
    order by m.created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 500));
end;
$$;
revoke all on function public.client_messages(uuid, int) from public, anon;
grant execute on function public.client_messages(uuid, int) to authenticated;

-- Stop a message that hasn't gone out yet: the sender, or whoever manages templates.
create or replace function public.cancel_client_message(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.outbound_messages
  set status = 'cancelled'
  where id = p_id and template = 'client_message' and status = 'queued'
    and ((queued_by = auth.uid() and public.has_permission('communications.messages.send'))
         or public.has_permission('communications.templates.manage'));
  if not found then
    raise exception 'only a waiting message you sent can be cancelled' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.cancel_client_message(uuid) from public, anon;
grant execute on function public.cancel_client_message(uuid) to authenticated;

-- Is anything stuck? Counts per channel, for the Messages section.
create or replace function public.client_messaging_health()
returns table (channel text, queued int, oldest_queued_at timestamptz, failed_7d int, sent_7d int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not (public.has_permission('communications.view') or public.has_permission('communications.messages.send')) then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  return query
    select ch,
      (select count(*)::int from public.outbound_messages m where m.template = 'client_message' and m.channel = ch and m.status in ('queued', 'sending')),
      (select min(m.created_at) from public.outbound_messages m where m.template = 'client_message' and m.channel = ch and m.status = 'queued'),
      (select count(*)::int from public.outbound_messages m where m.template = 'client_message' and m.channel = ch and m.status = 'failed' and m.updated_at > now() - interval '7 days'),
      (select count(*)::int from public.outbound_messages m where m.template = 'client_message' and m.channel = ch and m.status = 'sent' and m.sent_at > now() - interval '7 days')
    from unnest(array['email', 'sms']) ch;
end;
$$;
revoke all on function public.client_messaging_health() from public, anon;
grant execute on function public.client_messaging_health() to authenticated;

-- ======================================================================
-- 4. Staff announcements
-- ======================================================================
create table public.staff_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  priority text not null default 'normal' check (priority in ('normal', 'important')),
  pinned boolean not null default false,
  expires_on date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index staff_announcements_current_idx on public.staff_announcements (created_at desc) where archived_at is null;
create trigger staff_announcements_set_updated_at before update on public.staff_announcements
  for each row execute function public.set_updated_at();
create trigger staff_announcements_stamp_actor before insert or update on public.staff_announcements
  for each row execute function public.stamp_actor_column('created_by');

-- archived_by follows archived_at: the person who archived it, or nobody.
create or replace function public.stamp_announcement_archive()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.archived_at is null then
    new.archived_by := null;
  elsif tg_op = 'INSERT' or old.archived_at is null then
    new.archived_by := auth.uid();
  else
    new.archived_by := old.archived_by;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_announcement_archive() from public, anon, authenticated;
create trigger staff_announcements_stamp_archive before insert or update on public.staff_announcements
  for each row execute function public.stamp_announcement_archive();

alter table public.staff_announcements enable row level security;
create policy staff_announcements_select on public.staff_announcements for select to authenticated
  using ((select public.has_permission('communications.announcements.view'))
      or (select public.has_permission('communications.announcements.post')));
create policy staff_announcements_insert on public.staff_announcements for insert to authenticated
  with check ((select public.has_permission('communications.announcements.post')));
create policy staff_announcements_update on public.staff_announcements for update to authenticated
  using ((select public.has_permission('communications.announcements.post')))
  with check ((select public.has_permission('communications.announcements.post')));
-- No delete: announcements are archived.
revoke update on public.staff_announcements from authenticated;
grant update (title, body, priority, pinned, expires_on, archived_at) on public.staff_announcements to authenticated;

create table public.staff_announcement_reads (
  announcement_id uuid not null references public.staff_announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
alter table public.staff_announcement_reads enable row level security;
create policy staff_announcement_reads_select on public.staff_announcement_reads for select to authenticated
  using (user_id = auth.uid());
create policy staff_announcement_reads_insert on public.staff_announcement_reads for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.staff_announcements a where a.id = announcement_id));

-- Everyone who can read announcements (except the author) gets an in-app notice.
create or replace function public.notify_staff_announcement()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, link)
  select distinct p.id, 'staff_announcement',
         case when new.priority = 'important' then 'Important announcement' else 'New announcement' end,
         left(new.title, 120), '/communications/announcements'
  from public.profiles p
  join public.user_effective_permissions e on e.user_id = p.id and e.permission_key = 'communications.announcements.view'
  where p.active and p.id is distinct from new.created_by;
  return new;
end;
$$;
revoke all on function public.notify_staff_announcement() from public, anon, authenticated;
create trigger staff_announcements_notify after insert on public.staff_announcements
  for each row execute function public.notify_staff_announcement();

alter publication supabase_realtime add table public.staff_announcements;
