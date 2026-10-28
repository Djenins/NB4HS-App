-- t4 -- staff report rules decided by the owner on 2026-10-28, plus two
-- fixes found in the launch audit (launch-audit-2026-10-28.md, staff
-- reports items 2, 3, 4, 6, 7).
-- NOT APPLIED to the hosted project. Live dry run 2026-10-28 (rolled back): t4 check
-- and p6a/b/c passed. Tested on the local stack with
-- supabase/tests/t4_staff_report_rules_check.sql. Undo with
-- supabase/rollback/t4_staff_report_rules_down.sql.
--
--   1. Periods: a report can be started for the current period or a past one
--      (late reports), never a future one.
--   2. Revisions: while a report is sent back, reviewers see the last
--      submitted version, not the author's edits in progress. Their direct
--      read of the live row stops; staff_reports_in_revision() hands them
--      the row with the frozen content instead, and files added during the
--      revision stay hidden until it is resubmitted. Version history and the
--      review trail stay readable throughout.
--   3. Schedules: once a schedule has a report, its length and start date
--      are fixed (changing them used to rebuild periods and could overlap
--      or resend reminders). Make a new schedule instead.
--   4. Attachments: the five-file cap holds under concurrent uploads (the
--      report row is locked while counting), and the size and type come
--      from the stored file, not from what the browser said.
--   5. Reminders: "N days before" lands at the deadline's local time across
--      a daylight-saving change (it was computed in UTC, an hour off).

-- ======================================================================
-- 1. No reports for future periods
-- ======================================================================
-- Security invoker on purpose: current_user is the caller only outside a
-- definer function. Staff can read periods and schedules.
create or replace function public.staff_report_period_open()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if exists (select 1 from public.reporting_periods rp
             join public.reporting_schedules s on s.id = rp.schedule_id
             where rp.id = new.period_id and rp.period_start > (now() at time zone s.time_zone)::date) then
    raise exception 'that period has not started yet' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.staff_report_period_open() from public, anon, authenticated;
create trigger staff_reports_period_open before insert on public.staff_reports
  for each row execute function public.staff_report_period_open();

-- ======================================================================
-- 2. Reviewers don't see a revision in progress
-- ======================================================================
drop policy staff_reports_select on public.staff_reports;
create policy staff_reports_select on public.staff_reports for select to authenticated
  using ((staff_id = auth.uid() and public.is_staff())
         or (public.can_read_staff_reports() and version > 0 and status <> 'revision_requested'));

-- History and the review trail follow the report, not the live row.
drop policy staff_report_versions_select on public.staff_report_versions;
create policy staff_report_versions_select on public.staff_report_versions for select to authenticated
  using (public.staff_report_readable(report_id));
drop policy staff_report_reviews_select on public.staff_report_reviews;
create policy staff_report_reviews_select on public.staff_report_reviews for select to authenticated
  using (public.staff_report_readable(report_id));

-- A reports-in-revision row for reviewers, with the last submitted content.
create or replace function public.staff_reports_in_revision(p_report uuid default null)
returns setof public.staff_reports
language sql stable security definer set search_path = public
as $$
  select r.id, r.period_id, r.staff_id, r.department_id, r.status,
         v.content->>'activities', v.content->>'accomplishments', v.content->'outcomes',
         v.content->>'challenges', v.content->>'assistance_needed', (v.content->>'no_assistance_needed')::boolean,
         v.content->>'next_goals', v.content->>'comments', r.version, r.submitted_at, r.submitted_by,
         r.reviewed_by, r.reviewed_at, r.acknowledged_at, r.created_at, v.submitted_at,
         array(select jsonb_array_elements_text(coalesce(v.content->'programs', '[]'::jsonb)))
  from public.staff_reports r
  join public.staff_report_versions v on v.report_id = r.id and v.version = r.version
  where r.status = 'revision_requested' and r.staff_id is distinct from auth.uid()
    and public.can_read_staff_reports() and (p_report is null or r.id = p_report)
$$;
revoke all on function public.staff_reports_in_revision(uuid) from public, anon;
grant execute on function public.staff_reports_in_revision(uuid) to authenticated;

-- A file is visible to a reviewer if the report is, unless it was added
-- during a revision that hasn't been resubmitted.
create or replace function public.staff_report_file_visible(p_report uuid, p_added timestamptz)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_reports r
    where r.id = p_report
      and ((r.staff_id = auth.uid() and public.is_staff())
           or (public.can_read_staff_reports() and r.version > 0
               and (r.status <> 'revision_requested' or p_added <= r.submitted_at)))
  )
$$;
revoke all on function public.staff_report_file_visible(uuid, timestamptz) from public, anon;
grant execute on function public.staff_report_file_visible(uuid, timestamptz) to authenticated;

drop policy staff_report_attachments_select on public.staff_report_attachments;
create policy staff_report_attachments_select on public.staff_report_attachments for select to authenticated
  using (public.staff_report_file_visible(report_id, created_at));

-- The stored file: its listing time (or its upload time, before it's
-- listed), looked up here rather than in the policy, where the attachment
-- row would itself be filtered by the reader's access.
create or replace function public.staff_report_object_visible(p_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.staff_report_file_visible(public.staff_report_path_report(p_name), coalesce(
    (select a.created_at from public.staff_report_attachments a where a.storage_path = p_name),
    (select o.created_at from storage.objects o where o.bucket_id = 'staff-report-files' and o.name = p_name)))
$$;
revoke all on function public.staff_report_object_visible(text) from public, anon;
grant execute on function public.staff_report_object_visible(text) to authenticated;

drop policy staff_report_files_select on storage.objects;
create policy staff_report_files_select on storage.objects for select to authenticated
  using (bucket_id = 'staff-report-files' and public.staff_report_object_visible(name));

-- ======================================================================
-- 3. A used schedule keeps its length and start date
-- ======================================================================
create or replace function public.reporting_schedule_lock()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.first_period_start, new.period_days) is distinct from (old.first_period_start, old.period_days)
     and exists (select 1 from public.staff_reports r join public.reporting_periods rp on rp.id = r.period_id
                 where rp.schedule_id = old.id) then
    raise exception 'this schedule already has reports; create a new schedule to change its length or start date'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.reporting_schedule_lock() from public, anon, authenticated;
create trigger reporting_schedules_lock before update on public.reporting_schedules
  for each row execute function public.reporting_schedule_lock();

-- ======================================================================
-- 4. Attachment cap under concurrency; size and type from the stored file
-- ======================================================================
create or replace function public.staff_report_attachment_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  meta jsonb;
begin
  -- Concurrent uploads to one report queue here, so the count below is true.
  perform 1 from public.staff_reports where id = new.report_id for update;
  if (select count(*) from public.staff_report_attachments a where a.report_id = new.report_id) >= 5 then
    raise exception 'a report can have at most 5 files' using errcode = '23514';
  end if;
  select o.metadata into meta from storage.objects o
  where o.bucket_id = 'staff-report-files' and o.name = new.storage_path;
  if meta is not null then
    new.size_bytes := coalesce((meta->>'size')::int, new.size_bytes);
    new.mime_type := coalesce(meta->>'mimetype', new.mime_type);
  end if;
  return new;
end;
$$;
revoke all on function public.staff_report_attachment_rules() from public, anon, authenticated;
create trigger staff_report_attachments_rules before insert on public.staff_report_attachments
  for each row execute function public.staff_report_attachment_rules();

-- ======================================================================
-- 5. Reminder offsets in the schedule's own time zone
-- ======================================================================
CREATE OR REPLACE FUNCTION public.staff_reports_tick(p_now timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  sent integer := 0;
  rp record;
  e record;
  off int;
  fire_at timestamptz;
  key text;
  overdue_count int;
  period_label text;
  due_label text;
begin
  perform public.ensure_reporting_periods();

  for rp in
    select p.id, p.period_start, p.period_end, p.due_at, s.time_zone, s.grace_hours, s.reminder_offsets
    from public.reporting_periods p
    join public.reporting_schedules s on s.id = p.schedule_id and s.active
    where p.due_at between p_now - interval '9 days' and p_now + interval '8 days'
  loop
    period_label := public.staff_report_period_label(rp.id);
    due_label := public.staff_report_due_label(rp.due_at, rp.time_zone);

    for e in
      select x.staff_id
      from public.staff_report_expectations(rp.id) x
      join public.profiles pr on pr.id = x.staff_id and pr.active
      where x.submitted_at is null
    loop
      foreach off in array rp.reminder_offsets loop
        fire_at := ((rp.due_at at time zone rp.time_zone) + make_interval(days => off)) at time zone rp.time_zone;
        if off > 0 then
          fire_at := greatest(fire_at, rp.due_at + make_interval(hours => rp.grace_hours));
        end if;
        continue when p_now < fire_at or p_now >= fire_at + interval '1 day';

        key := 'due:' || rp.id || ':' || e.staff_id || ':' || off;
        insert into public.staff_report_notices_sent (notice_key) values (key) on conflict do nothing;
        continue when not found;

        insert into public.notifications (user_id, type, title, message, link)
        values (
          e.staff_id,
          case when off > 0 then 'staff_report_overdue' else 'staff_report_due' end,
          case when off > 0 then 'Report overdue' else 'Report due' end,
          case when off > 0
            then 'Your report for ' || period_label || ' was due ' || due_label || '. Please submit it as soon as you can.'
            else 'Your report for ' || period_label || ' is due ' || due_label || '.'
          end,
          '/myreports'
        );
        sent := sent + 1;
      end loop;
    end loop;

    fire_at := rp.due_at + make_interval(hours => rp.grace_hours);
    if p_now >= fire_at and p_now < fire_at + interval '1 day' then
      select count(*) into overdue_count
      from public.staff_report_expectations(rp.id) x
      join public.profiles pr on pr.id = x.staff_id and pr.active
      where x.submitted_at is null;

      if overdue_count > 0 then
        for e in select reviewer as user_id from public.staff_report_reviewer_ids() reviewer loop
          key := 'overdue_digest:' || rp.id || ':' || e.user_id;
          insert into public.staff_report_notices_sent (notice_key) values (key) on conflict do nothing;
          continue when not found;
          insert into public.notifications (user_id, type, title, message, link)
          values (
            e.user_id, 'staff_report_overdue_digest', 'Reports overdue',
            overdue_count || case when overdue_count = 1 then ' report is' else ' reports are' end
              || ' overdue for ' || period_label || '.',
            '/staffreports'
          );
          sent := sent + 1;
        end loop;
      end if;
    end if;
  end loop;

  return sent;
end;
$function$

;
revoke all on function public.staff_reports_tick(timestamptz) from public, anon, authenticated;
