-- Undo t5_notifications_read_only: the table-level UPDATE grant comes back
-- (RLS still limits updates to your own rows).
begin;
revoke update (read) on public.notifications from authenticated;
grant update on public.notifications to anon, authenticated;
delete from supabase_migrations.schema_migrations where version = '20261028050000';
commit;
