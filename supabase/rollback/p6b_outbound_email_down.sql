-- Undo p6b_outbound_email: stop the job, put the report RPCs back as p6a
-- (submit) and R1 (acknowledge, request revision) left them, and drop the
-- queue. Queued or sent email records are deleted with the table. pg_net
-- stays installed.
begin;
select cron.unschedule('send-outbound');

create or replace function public.submit_staff_report(p_report_id uuid)
returns public.staff_reports
language plpgsql security definer set search_path = public
as $$
declare
  r public.staff_reports;
  author text;
  missing text[] := '{}';
  positions jsonb;
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
  insert into public.notifications (user_id, type, title, message, link)
  select reviewer, 'staff_report_submitted', 'New biweekly report',
         'New biweekly report submitted by ' || author || ' for ' || public.staff_report_period_label(r.period_id) || '.',
         '/staffreports/' || r.id
  from public.staff_report_reviewer_ids() reviewer
  where reviewer <> r.staff_id;

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
  return r;
end;
$$;

drop function public.outbound_queue_health();
drop function public.invoke_send_outbound();
drop function public.complete_outbound_message(uuid, boolean, text, text);
drop function public.claim_outbound_messages(int);
drop function public.staff_report_time_label(timestamptz);
drop function public.enqueue_email(uuid, text, jsonb, text);
drop table public.outbound_messages;
delete from supabase_migrations.schema_migrations where version = '20261027030000';
commit;
