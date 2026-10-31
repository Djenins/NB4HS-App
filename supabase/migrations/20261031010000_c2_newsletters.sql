-- c2 -- newsletters: one email to many clients, from the Communications
-- module. Builds on c1_communications (the outbound queue, consent checks,
-- the communications log).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-31 (version 20261031010000) with
-- the owner's approval, after a rolled-back dry run of
-- supabase/tests/c2_newsletters_check.sql passed on live; the checks passed
-- again against live afterwards.
--
-- What it adds:
--   * Permission communications.newsletters.send (sensitive: it reaches every
--     consenting client's email address), granted to legacy administrators.
--   * newsletters: a draft (subject, message, language, audience) that is
--     sent once. Staff edit drafts directly; only send_newsletter() and
--     cancel_newsletter() change the status.
--   * Who gets it: clients in the chosen audience (everyone, or one
--     program's participants) whose email address is valid and whose newest
--     consent for email + "program updates" is "granted". Nobody else, ever.
--     send_newsletter() queues one email per recipient in outbound_messages
--     and logs it in their communications log, all in one transaction. At
--     most 5,000 recipients per newsletter.
--   * Unsubscribe: every email carries its own link (/unsubscribe?t=...).
--     unsubscribe_newsletter() works without signing in, records a "revoked"
--     consent row (so no further newsletter or program-update email goes
--     to that client) and is rate-limited like the other public functions
--     (t6/t8).
--   * The organization's mailing address, which US law (CAN-SPAM) requires
--     in every bulk email, is the app setting `mailing_address`, set in the
--     Newsletters section by whoever manages System Settings. A newsletter
--     can't be sent until it's set.
--
-- Rollback: supabase/rollback/c2_newsletters_down.sql.

-- ======================================================================
-- 1. Permission
-- ======================================================================
insert into public.permissions (key, module_key, scoped, sensitivity, sort_order, description) values
  ('communications.newsletters.send', 'communications', false, 'sensitive', 6, 'Write and send newsletters to consenting clients');

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, 'communications.newsletters.send', null from public.roles r where r.key = 'legacy_administrator';

-- ======================================================================
-- 2. Mailing address setting
-- ======================================================================
create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_require('admin.settings.manage');
  if p_key = 'closing_time' then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'the closing time must look like 17:00' using errcode = '22023';
    end if;
  elsif p_key = 'mailing_address' then
    if jsonb_typeof(p_value) <> 'string' or char_length(btrim(p_value #>> '{}')) not between 10 and 300 then
      raise exception 'the mailing address must be 10 to 300 characters' using errcode = '22023';
    end if;
    p_value := to_jsonb(btrim(p_value #>> '{}'));
  else
    raise exception 'unknown setting %', p_key using errcode = '22023';
  end if;
  perform set_config('nb4hs.audit_reason', coalesce(btrim(p_reason), ''), true);
  insert into public.app_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by
  where app_settings.value is distinct from excluded.value;
end;
$$;

-- ======================================================================
-- 3. Newsletters and their recipients
-- ======================================================================
create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(btrim(subject)) between 1 and 150),
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  language text not null default 'en' check (language in ('en', 'ht', 'fr')),
  audience text not null default 'all' check (audience in ('all', 'case_management', 'workforce', 'students', 'food_distribution', 'snap')),
  status text not null default 'draft' check (status in ('draft', 'sent', 'cancelled')),
  recipient_count int not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index newsletters_created_idx on public.newsletters (created_at desc);
create trigger newsletters_set_updated_at before update on public.newsletters
  for each row execute function public.set_updated_at();
create trigger newsletters_stamp_actor before insert or update on public.newsletters
  for each row execute function public.stamp_actor_column('created_by');

alter table public.newsletters enable row level security;
create policy newsletters_select on public.newsletters for select to authenticated
  using ((select public.has_permission('communications.newsletters.send')));
create policy newsletters_insert on public.newsletters for insert to authenticated
  with check ((select public.has_permission('communications.newsletters.send')) and status = 'draft');
create policy newsletters_update on public.newsletters for update to authenticated
  using ((select public.has_permission('communications.newsletters.send')) and status = 'draft')
  with check ((select public.has_permission('communications.newsletters.send')) and status = 'draft');
create policy newsletters_delete on public.newsletters for delete to authenticated
  using ((select public.has_permission('communications.newsletters.send')) and status = 'draft');
revoke insert, update on public.newsletters from authenticated;
grant insert (subject, body, language, audience) on public.newsletters to authenticated;
grant update (subject, body, language, audience) on public.newsletters to authenticated;

create table public.newsletter_recipients (
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  outbound_message_id uuid references public.outbound_messages(id) on delete set null,
  -- Two random UUIDs' worth of hex: the unsubscribe link's only secret.
  unsubscribe_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  unsubscribed_at timestamptz,
  primary key (newsletter_id, client_id)
);
alter table public.newsletter_recipients enable row level security;
-- No policies: only the functions below read or write it.
revoke all on public.newsletter_recipients from anon, authenticated;

alter table public.outbound_messages drop constraint outbound_messages_template_check;
alter table public.outbound_messages add constraint outbound_messages_template_check check (template in (
  'staff_report_submitted', 'staff_report_revision_requested', 'staff_report_acknowledged', 'client_message', 'newsletter'));

-- ======================================================================
-- 4. Who receives it
-- ======================================================================
-- Clients in the audience with a valid email whose newest email +
-- program_updates consent is "granted". Internal.
create or replace function public.newsletter_audience_clients(p_audience text)
returns setof public.clients
language sql stable security definer set search_path = public
as $$
  select c.* from public.clients c
  where lower(btrim(coalesce(c.email, ''))) ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    and (select cc.status from public.contact_consents cc
         where cc.client_id = c.id and cc.channel = 'email' and cc.purpose = 'program_updates'
         order by cc.captured_at desc limit 1) = 'granted'
    and case p_audience
      when 'all' then true
      when 'case_management' then exists (select 1 from public.case_clients x where x.client_id = c.id)
      when 'workforce' then exists (select 1 from public.job_clients x where x.client_id = c.id)
      when 'students' then exists (select 1 from public.students x where x.client_id = c.id)
      when 'food_distribution' then exists (select 1 from public.food_clients x where x.client_id = c.id)
      when 'snap' then exists (select 1 from public.outreach_contacts x where x.client_id = c.id and x.program = 'snap')
      else false end
$$;
revoke all on function public.newsletter_audience_clients(text) from public, anon, authenticated;

create or replace function public.newsletter_audience_count(p_audience text)
returns int
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission('communications.newsletters.send') then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  return (select count(*)::int from public.newsletter_audience_clients(p_audience));
end;
$$;
revoke all on function public.newsletter_audience_count(text) from public, anon;
grant execute on function public.newsletter_audience_count(text) to authenticated;

-- ======================================================================
-- 5. Sending and stopping
-- ======================================================================
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
revoke all on function public.send_newsletter(uuid) from public, anon;
grant execute on function public.send_newsletter(uuid) to authenticated;

-- Stops whatever hasn't gone out yet. Emails already sent stay sent.
create or replace function public.cancel_newsletter(p_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  stopped int;
begin
  if not public.has_permission('communications.newsletters.send') then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  update public.outbound_messages m set status = 'cancelled'
  from public.newsletter_recipients r
  where r.newsletter_id = p_id and m.id = r.outbound_message_id and m.status = 'queued';
  get diagnostics stopped = row_count;
  update public.newsletters set status = 'cancelled' where id = p_id and status = 'sent';
  return stopped;
end;
$$;
revoke all on function public.cancel_newsletter(uuid) from public, anon;
grant execute on function public.cancel_newsletter(uuid) to authenticated;

-- Delivery counts per newsletter, for the list.
create or replace function public.newsletter_stats()
returns table (newsletter_id uuid, waiting int, sent int, failed int, cancelled int, unsubscribed int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_permission('communications.newsletters.send') then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  return query
    select r.newsletter_id,
      count(*) filter (where m.status in ('queued', 'sending'))::int,
      count(*) filter (where m.status = 'sent')::int,
      count(*) filter (where m.status = 'failed')::int,
      count(*) filter (where m.status = 'cancelled')::int,
      count(*) filter (where r.unsubscribed_at is not null)::int
    from public.newsletter_recipients r
    left join public.outbound_messages m on m.id = r.outbound_message_id
    group by r.newsletter_id;
end;
$$;
revoke all on function public.newsletter_stats() from public, anon;
grant execute on function public.newsletter_stats() to authenticated;

-- ======================================================================
-- 6. Unsubscribe (no sign-in)
-- ======================================================================
-- Returns the newsletter's language so the page can answer in it, or null
-- for an unknown link. Saying yes twice is harmless.
create or replace function public.unsubscribe_newsletter(p_token text)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  r public.newsletter_recipients;
  lang text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into r from public.newsletter_recipients where unsubscribe_token = p_token for update;
  if not found then
    return null;
  end if;
  select language into lang from public.newsletters where id = r.newsletter_id;
  if r.unsubscribed_at is null then
    update public.newsletter_recipients set unsubscribed_at = now()
    where newsletter_id = r.newsletter_id and client_id = r.client_id;
    if (select cc.status from public.contact_consents cc
        where cc.client_id = r.client_id and cc.channel = 'email' and cc.purpose = 'program_updates'
        order by cc.captured_at desc limit 1) is distinct from 'revoked' then
      insert into public.contact_consents (client_id, channel, purpose, status, method, captured_by)
      values (r.client_id, 'email', 'program_updates', 'revoked', 'electronic', null);
    end if;
  end if;
  return coalesce(lang, 'en');
end;
$$;
revoke all on function public.unsubscribe_newsletter(text) from public;
grant execute on function public.unsubscribe_newsletter(text) to anon, authenticated;

insert into public.api_rate_limits (rpc, per_hour) values ('unsubscribe_newsletter', 30);
