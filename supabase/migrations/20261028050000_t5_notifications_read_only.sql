-- t5 -- staff may only mark their own notifications read or unread (owner
-- decision, 2026-10-28; launch-audit-2026-10-28.md, live security check 4).
-- NOT APPLIED to the hosted project yet. Tested on the local stack with
-- supabase/tests/t5_notifications_check.sql. Undo with
-- supabase/rollback/t5_notifications_read_only_down.sql.
--
-- notifications_update_own already limits updates to your own rows; the
-- table-level UPDATE grant let those updates change the title, message,
-- link or type too. The app only ever sets `read`. Inserts and deletes stay
-- closed by RLS (no policies), as before.
revoke update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;
