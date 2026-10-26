-- Phase 6, part B -- email copies of staff report notices, "R3"
-- (plans/staff-reporting-architecture.md §6; decision D9: Resend).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261027030000) after a
-- rolled-back dry run of supabase/tests/p6b_outbound_check.sql passed.
-- Afterwards p6b_outbound_check, p6a_reports_check and p1_access_check passed
-- against the live database. Builds on p6a. Email stays idle until the Vault
-- secrets and the send-outbound function's secrets are set.
--
-- How it works:
--   * The report RPCs queue an email in the same transaction as the in-app
--     notice (outbound_messages), so a submission is safe even if email never
--     works. Emails carry names, the period and a link -- never report
--     content, reviewer comments or participant details.
--       submitted            -> each reviewer
--       revision requested   -> the author (the comment stays in the app)
--       acknowledged         -> the author
--   * Every 5 minutes pg_cron asks the send-outbound Edge Function (through
--     pg_net) to send what's queued. The function claims rows with
--     claim_outbound_messages() (FOR UPDATE SKIP LOCKED), sends each through
--     the provider and reports back with complete_outbound_message():
--     "sent" only on the provider's 2xx (= accepted, never shown as
--     "delivered"); otherwise retried after 5 min, 15 min, 1 h, 6 h, then
--     "failed".
--   * Nothing is sent until you configure it: the cron call does nothing
--     until two Vault secrets exist (send_outbound_url, send_outbound_secret)
--     and the function holds RESEND_API_KEY. Until then messages stay
--     "queued" and the app says email is pending.
--   * outbound_queue_health() gives reporting admins the queue counts and
--     the last error, so a provider outage is visible.
--
-- Rollback (supabase/rollback/p6b_outbound_email_down.sql): unschedule the
-- job, restore p6a's three report RPCs, drop the new objects. pg_net stays
-- installed (harmless).

create extension if not exists pg_net with schema extensions;

-- ======================================================================
-- 1. The queue
-- ======================================================================
create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'email' check (channel = 'email'),
  to_user_id uuid references public.profiles(id) on delete set null,
  to_address text not null check (to_address ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  template text not null check (template in ('staff_report_submitted', 'staff_report_revision_requested', 'staff_report_acknowledged')),
  payload jsonb not null default '{}',
  dedupe_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'cancelled')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text check (char_length(last_error) <= 2000),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index outbound_messages_due_idx on public.outbound_messages (next_attempt_at) where status = 'queued';
create trigger outbound_messages_set_updated_at before update on public.outbound_messages
  for each row execute function public.set_updated_at();
alter table public.outbound_messages enable row level security;
-- No policies: only the functions below (and the service role) touch it.
revoke all on public.outbound_messages from anon, authenticated;

-- Queue one email to a person, at their sign-in address. Skips inactive
-- accounts and repeats of the same key. Internal: called by the report RPCs.
create or replace function public.enqueue_email(p_user uuid, p_template text, p_payload jsonb, p_dedupe_key text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  addr text;
begin
  select coalesce(nullif(btrim(u.email), ''), p.email) into addr
  from public.profiles p left join auth.users u on u.id = p.id
  where p.id = p_user and p.active;
  if addr is null then
    return;
  end if;
  insert into public.outbound_messages (to_user_id, to_address, template, payload, dedupe_key)
  values (p_user, lower(addr), p_template, p_payload, p_dedupe_key)
  on conflict (dedupe_key) do nothing;
end;
$$;
revoke all on function public.enqueue_email(uuid, text, jsonb, text) from public, anon, authenticated;

-- "Mon, Nov 16, 2026 at 5:00 PM EST" in the active schedule's zone.
create or replace function public.staff_report_time_label(p_at timestamptz)
returns text
language sql stable security definer set search_path = public
as $$
  select to_char(p_at at time zone tz, 'Dy, Mon FMDD, YYYY "at" FMHH12:MI AM') || ' ' ||
         to_char(p_at at time zone tz, 'TZ')
  from (select coalesce((select time_zone from public.reporting_schedules where active order by created_at limit 1), 'America/New_York') as tz) z
$$;
revoke all on function public.staff_report_time_label(timestamptz) from public, anon, authenticated;

-- ======================================================================
-- 2. The report RPCs queue their emails (p6a's versions plus one step each)
-- ======================================================================
create or replace function public.submit_staff_report(p_report_id uuid)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports;
  author text;
  missing text[] := '{}';
  positions jsonb;
  reviewer uuid;
begin
  select * into r from public.staff_reports where id = p_report_id for update;
  if not found or r.staff_id is distinct from auth.uid() or not public.is_staff() then
    raise exception 'report not found' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'revision_requested') then
    raise exception 'this report has already been submitted' using errcode = '23514';
  end if;

  if cardinality(r.programs) = 0 then missing := array_append(missing, 'programs'); end if;
  if btrim(r.activities) = '' then missing := array_append(missing, 'activities'); end if;
  if btrim(r.accomplishments) = '' then missing := array_append(missing, 'accomplishments'); end if;
  if btrim(r.challenges) = '' then missing := array_append(missing, 'challenges'); end if;
  if btrim(r.assistance_needed) = '' and not r.no_assistance_needed then missing := array_append(missing, 'assistance_needed'); end if;
  if btrim(r.next_goals) = '' then missing := array_append(missing, 'next_goals'); end if;
  if cardinality(missing) > 0 then
    raise exception 'missing required fields: %', array_to_string(missing, ', ') using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(p.name_en order by up.is_primary desc, p.sort_order), '[]') into positions
  from public.user_positions up join public.positions p on p.id = up.position_id
  where up.user_id = r.staff_id and up.ended_on is null;

  update public.staff_reports
  set status = 'submitted', version = r.version + 1, submitted_at = now(), submitted_by = auth.uid(),
      reviewed_by = null, reviewed_at = null
  where id = r.id
  returning * into r;

  insert into public.staff_report_versions (report_id, version, content, submitted_at, submitted_by)
  values (r.id, r.version, jsonb_build_object(
    'activities', r.activities, 'accomplishments', r.accomplishments, 'outcomes', r.outcomes,
    'challenges', r.challenges, 'assistance_needed', r.assistance_needed,
    'no_assistance_needed', r.no_assistance_needed, 'next_goals', r.next_goals, 'comments', r.comments,
    'programs', to_jsonb(r.programs), 'positions', positions
  ), r.submitted_at, auth.uid());
  insert into public.staff_report_reviews (report_id, actor_id, action, version)
  values (r.id, auth.uid(), 'submitted', r.version);

  select coalesce(nullif(btrim(name), ''), email) into author from public.profiles where id = r.staff_id;
  for reviewer in select x from public.staff_report_reviewer_ids() x where x <> r.staff_id loop
    insert into public.notifications (user_id, type, title, message, link)
    values (reviewer, 'staff_report_submitted', 'New biweekly report',
            'New biweekly report submitted by ' || author || ' for ' || public.staff_report_period_label(r.period_id) || '.',
            '/staffreports/' || r.id);
    perform public.enqueue_email(reviewer, 'staff_report_submitted', jsonb_build_object(
      'staff_name', author, 'period', public.staff_report_period_label(r.period_id),
      'submitted_at', public.staff_report_time_label(r.submitted_at), 'version', r.version,
      'link', '/staffreports/' || r.id
    ), 'submitted:' || r.id || ':' || r.version || ':' || reviewer);
  end loop;

  return r;
end;
$$;

create or replace function public.acknowledge_staff_report(p_report_id uuid, p_comment text default null)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports := public.staff_report_for_review(p_report_id);
begin
  if r.status not in ('submitted', 'under_review') then
    raise exception 'only a submitted report can be acknowledged' using errcode = '23514';
  end if;
  update public.staff_reports
  set status = 'acknowledged', reviewed_by = auth.uid(), reviewed_at = now(), acknowledged_at = now()
  where id = r.id returning * into r;
  insert into public.staff_report_reviews (report_id, actor_id, action, version, comment)
  values (r.id, auth.uid(), 'acknowledged', r.version, nullif(btrim(coalesce(p_comment, '')), ''));
  insert into public.notifications (user_id, type, title, message, link)
  values (r.staff_id, 'staff_report_acknowledged', 'Report acknowledged',
          'Your report for ' || public.staff_report_period_label(r.period_id) || ' was acknowledged.',
          '/myreports/' || r.id);
  perform public.enqueue_email(r.staff_id, 'staff_report_acknowledged', jsonb_build_object(
    'period', public.staff_report_period_label(r.period_id), 'link', '/myreports/' || r.id
  ), 'acknowledged:' || r.id || ':' || r.version);
  return r;
end;
$$;

create or replace function public.request_staff_report_revision(p_report_id uuid, p_comment text)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports := public.staff_report_for_review(p_report_id);
begin
  if btrim(coalesce(p_comment, '')) = '' then
    raise exception 'a comment is required to request a revision' using errcode = '23514';
  end if;
  if r.status not in ('submitted', 'under_review') then
    raise exception 'only a submitted report can be sent back' using errcode = '23514';
  end if;
  update public.staff_reports set status = 'revision_requested', reviewed_by = auth.uid(), reviewed_at = now()
  where id = r.id returning * into r;
  insert into public.staff_report_reviews (report_id, actor_id, action, version, comment)
  values (r.id, auth.uid(), 'revision_requested', r.version, btrim(p_comment));
  insert into public.notifications (user_id, type, title, message, link)
  values (r.staff_id, 'staff_report_revision_requested', 'Revision requested',
          'Your report for ' || public.staff_report_period_label(r.period_id) || ' needs a revision.',
          '/myreports/' || r.id);
  perform public.enqueue_email(r.staff_id, 'staff_report_revision_requested', jsonb_build_object(
    'period', public.staff_report_period_label(r.period_id), 'link', '/myreports/' || r.id
  ), 'revision:' || r.id || ':' || r.version);
  return r;
end;
$$;

-- ======================================================================
-- 3. Sending (for the send-outbound Edge Function, service role only)
-- ======================================================================
create or replace function public.claim_outbound_messages(p_limit int default 20)
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
      where status = 'queued' and next_attempt_at <= now()
      order by next_attempt_at
      limit greatest(1, least(coalesce(p_limit, 20), 100))
      for update skip locked
    )
    returning m.*;
end;
$$;

create or replace function public.complete_outbound_message(p_id uuid, p_ok boolean, p_provider_id text default null, p_error text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  backoff interval[] := array[interval '5 minutes', interval '15 minutes', interval '1 hour', interval '6 hours'];
  m public.outbound_messages;
begin
  select * into m from public.outbound_messages where id = p_id and status = 'sending' for update;
  if not found then
    return;
  end if;
  if p_ok then
    update public.outbound_messages
    set status = 'sent', sent_at = now(), provider_message_id = left(p_provider_id, 200), last_error = null
    where id = p_id;
  elsif m.attempts >= 5 then
    update public.outbound_messages set status = 'failed', last_error = left(coalesce(p_error, 'unknown error'), 2000) where id = p_id;
  else
    update public.outbound_messages
    set status = 'queued', next_attempt_at = now() + backoff[m.attempts], last_error = left(coalesce(p_error, 'unknown error'), 2000)
    where id = p_id;
  end if;
end;
$$;

revoke all on function public.claim_outbound_messages(int) from public, anon, authenticated;
revoke all on function public.complete_outbound_message(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_outbound_messages(int) to service_role;
grant execute on function public.complete_outbound_message(uuid, boolean, text, text) to service_role;

-- ======================================================================
-- 4. The 5-minute trigger, idle until configured
-- ======================================================================
-- Calls the Edge Function only when both Vault secrets exist:
--   send_outbound_url     https://<project>.supabase.co/functions/v1/send-outbound
--   send_outbound_secret  the same value as the function's CRON_SECRET
-- and only when something is waiting.
create or replace function public.invoke_send_outbound()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  fn_url text;
  fn_secret text;
begin
  if not exists (select 1 from public.outbound_messages where status = 'queued' and next_attempt_at <= now()) then
    return;
  end if;
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'send_outbound_url';
  select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'send_outbound_secret';
  if fn_url is null or fn_secret is null then
    return;
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || fn_secret),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.invoke_send_outbound() from public, anon, authenticated;

select cron.schedule('send-outbound', '*/5 * * * *', $$select public.invoke_send_outbound()$$);

-- ======================================================================
-- 5. Queue health, for whoever configures reporting
-- ======================================================================
create or replace function public.outbound_queue_health()
returns table (queued int, sending int, sent_7d int, failed int, oldest_queued_at timestamptz, last_error text, last_error_at timestamptz, configured boolean)
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_permission('staff_reports.schedule.manage') or public.has_permission('admin.settings.manage')) then
    raise exception 'you do not have permission to do this' using errcode = '42501';
  end if;
  return query
    select
      (select count(*)::int from public.outbound_messages where status = 'queued'),
      (select count(*)::int from public.outbound_messages where status = 'sending'),
      (select count(*)::int from public.outbound_messages where status = 'sent' and sent_at > now() - interval '7 days'),
      (select count(*)::int from public.outbound_messages where status = 'failed'),
      (select min(created_at) from public.outbound_messages where status = 'queued'),
      e.last_error, e.updated_at,
      exists (select 1 from vault.decrypted_secrets where name = 'send_outbound_url')
    from (select null::int) one
    left join lateral (
      select m.last_error, m.updated_at from public.outbound_messages m
      where m.last_error is not null order by m.updated_at desc limit 1
    ) e on true;
end;
$$;
revoke all on function public.outbound_queue_health() from public, anon;
grant execute on function public.outbound_queue_health() to authenticated;
