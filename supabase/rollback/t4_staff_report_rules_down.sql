-- Undo t4_staff_report_rules: the policies, triggers and reminder maths go
-- back to p6a/p6c. Reports already started and files already listed stay.
begin;
drop trigger staff_reports_period_open on public.staff_reports;
drop function public.staff_report_period_open();

drop policy staff_reports_select on public.staff_reports;
create policy staff_reports_select on public.staff_reports for select to authenticated
  using ((staff_id = auth.uid() and public.is_staff()) or (public.can_read_staff_reports() and version > 0));
drop policy staff_report_versions_select on public.staff_report_versions;
create policy staff_report_versions_select on public.staff_report_versions for select to authenticated
  using (exists (select 1 from public.staff_reports r where r.id = staff_report_versions.report_id));
drop policy staff_report_reviews_select on public.staff_report_reviews;
create policy staff_report_reviews_select on public.staff_report_reviews for select to authenticated
  using (exists (select 1 from public.staff_reports r where r.id = staff_report_reviews.report_id));
drop function public.staff_reports_in_revision(uuid);
drop policy staff_report_attachments_select on public.staff_report_attachments;
create policy staff_report_attachments_select on public.staff_report_attachments for select to authenticated
  using (public.staff_report_readable(report_id));
drop policy staff_report_files_select on storage.objects;
create policy staff_report_files_select on storage.objects for select to authenticated
  using (bucket_id = 'staff-report-files' and public.staff_report_readable(public.staff_report_path_report(name)));
drop function public.staff_report_object_visible(text);
drop function public.staff_report_file_visible(uuid, timestamptz);

drop trigger reporting_schedules_lock on public.reporting_schedules;
drop function public.reporting_schedule_lock();

drop trigger staff_report_attachments_rules on public.staff_report_attachments;
drop function public.staff_report_attachment_rules();

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
        fire_at := rp.due_at + make_interval(days => off);
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

delete from supabase_migrations.schema_migrations where version = '20261028040000';
commit;
