-- Phase 6, part C -- staff report attachments, "R4"
-- (plans/staff-reporting-architecture.md §3, §5).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261027040000) after a
-- rolled-back dry run of supabase/tests/p6c_attachments_check.sql passed.
-- Afterwards p6c_attachments_check, p6b_outbound_check and p1_access_check
-- passed against the live database. Builds on p6a.
--
-- * A private bucket, staff-report-files: PDF, Word, Excel, PNG and JPEG,
--   10 MB each, at most 5 per report. Paths are {report_id}/{uuid}-{name}.
-- * Files follow their report: the author adds and removes them while the
--   report is a draft or sent back for revision; whoever can read the report
--   (its author, and reviewers once it is submitted) can download them,
--   through short-lived signed URLs only.
-- * A file that was part of an earlier submission can't be removed during a
--   revision, so a reviewer never loses what they already saw.
-- * staff_report_attachments lists them (name, type, size, who, when) and is
--   audited by field name only -- file names can carry personal details.
--
-- Rollback (supabase/rollback/p6c_report_attachments_down.sql): drop the
-- policies, table and functions; the bucket is removed only while empty.

-- ======================================================================
-- 1. The bucket
-- ======================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('staff-report-files', 'staff-report-files', false, 10485760, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ======================================================================
-- 2. The list
-- ======================================================================
create table public.staff_report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.staff_reports(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 150),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg')),
  size_bytes int not null check (size_bytes between 1 and 10485760),
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (storage_path like report_id::text || '/%')
);
create index staff_report_attachments_report_idx on public.staff_report_attachments (report_id, created_at);
create trigger staff_report_attachments_audit after insert or update or delete on public.staff_report_attachments
  for each row execute function public.audit_row_change();

-- ======================================================================
-- 3. Who may do what (shared by the table and the bucket)
-- ======================================================================
-- The report id a storage path belongs to, or null for anything malformed.
create or replace function public.staff_report_path_report(p_path text)
returns uuid
language sql immutable set search_path = public
as $$
  select case when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[^/]{1,150}$'
              then split_part(p_path, '/', 1)::uuid end
$$;

-- Can the signed-in person see this report (and so its files)?
create or replace function public.staff_report_readable(p_report uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_reports r
    where r.id = p_report
      and ((r.staff_id = auth.uid() and public.is_staff()) or (public.can_read_staff_reports() and r.version > 0))
  )
$$;

-- Their own report, still editable.
create or replace function public.staff_report_editable_by_me(p_report uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_reports r
    where r.id = p_report and r.staff_id = auth.uid() and public.is_staff()
      and r.status in ('draft', 'revision_requested')
  )
$$;

-- Can they upload a file to it? Their own editable report, under 5 files in
-- the bucket.
create or replace function public.staff_report_attachable(p_report uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.staff_report_editable_by_me(p_report)
    and (select count(*) from storage.objects o
         where o.bucket_id = 'staff-report-files' and o.name like p_report::text || '/%') < 5
$$;

-- Can they list one more file? Their own editable report, under 5 listed
-- (the file itself is already uploaded by then).
create or replace function public.staff_report_listable(p_report uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.staff_report_editable_by_me(p_report)
    and (select count(*) from public.staff_report_attachments a where a.report_id = p_report) < 5
$$;

-- Can they remove this file? Their own editable report, and the file was
-- added since the last submission.
create or replace function public.staff_report_attachment_removable(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_report_attachments a
    join public.staff_reports r on r.id = a.report_id
    where a.storage_path = p_path and r.staff_id = auth.uid() and public.is_staff()
      and r.status in ('draft', 'revision_requested')
      and (r.submitted_at is null or a.created_at > r.submitted_at)
  )
$$;

-- Is the file really in the bucket (so a list row never points at nothing)?
create or replace function public.staff_report_file_exists(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from storage.objects o where o.bucket_id = 'staff-report-files' and o.name = p_path)
$$;

revoke all on function public.staff_report_path_report(text) from public, anon;
revoke all on function public.staff_report_readable(uuid) from public, anon;
revoke all on function public.staff_report_editable_by_me(uuid) from public, anon;
revoke all on function public.staff_report_attachable(uuid) from public, anon;
revoke all on function public.staff_report_listable(uuid) from public, anon;
revoke all on function public.staff_report_attachment_removable(text) from public, anon;
revoke all on function public.staff_report_file_exists(text) from public, anon;
grant execute on function public.staff_report_path_report(text) to authenticated;
grant execute on function public.staff_report_readable(uuid) to authenticated;
grant execute on function public.staff_report_editable_by_me(uuid) to authenticated;
grant execute on function public.staff_report_attachable(uuid) to authenticated;
grant execute on function public.staff_report_listable(uuid) to authenticated;
grant execute on function public.staff_report_attachment_removable(text) to authenticated;
grant execute on function public.staff_report_file_exists(text) to authenticated;

-- ======================================================================
-- 4. Policies
-- ======================================================================
alter table public.staff_report_attachments enable row level security;
create policy staff_report_attachments_select on public.staff_report_attachments for select to authenticated
  using (public.staff_report_readable(report_id));
create policy staff_report_attachments_insert on public.staff_report_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.staff_report_path_report(storage_path) = report_id
    and public.staff_report_listable(report_id)
    and public.staff_report_file_exists(storage_path)
  );
create policy staff_report_attachments_delete on public.staff_report_attachments for delete to authenticated
  using (public.staff_report_attachment_removable(storage_path));
-- No update policy: a file is replaced by removing it and adding another.

create policy staff_report_files_select on storage.objects for select to authenticated
  using (bucket_id = 'staff-report-files' and public.staff_report_readable(public.staff_report_path_report(name)));
create policy staff_report_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-report-files' and public.staff_report_attachable(public.staff_report_path_report(name)));
create policy staff_report_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'staff-report-files'
    and (public.staff_report_attachment_removable(name)
         -- an upload whose list row was never written (the browser closed mid-way)
         or (not exists (select 1 from public.staff_report_attachments a where a.storage_path = name)
             and public.staff_report_editable_by_me(public.staff_report_path_report(name))))
  );
