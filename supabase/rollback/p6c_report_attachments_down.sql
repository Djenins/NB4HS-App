-- Undo p6c_report_attachments. The list of attachments goes with its table.
-- The staff-report-files bucket stays: Supabase Storage refuses deletions
-- from SQL. With the policies gone nobody but the service role can reach it;
-- remove it (and any files) in the dashboard or through the Storage API if
-- you want it gone.
begin;
drop policy staff_report_files_select on storage.objects;
drop policy staff_report_files_insert on storage.objects;
drop policy staff_report_files_delete on storage.objects;
drop table public.staff_report_attachments;
drop function public.staff_report_file_exists(text);
drop function public.staff_report_attachment_removable(text);
drop function public.staff_report_listable(uuid);
drop function public.staff_report_attachable(uuid);
drop function public.staff_report_editable_by_me(uuid);
drop function public.staff_report_readable(uuid);
drop function public.staff_report_path_report(text);
delete from supabase_migrations.schema_migrations where version = '20261027040000';
commit;
