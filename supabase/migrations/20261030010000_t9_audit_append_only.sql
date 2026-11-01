-- t9 -- close the gaps left in p1a's append-only audit log (audit finding
-- S11, plans/unified-access-architecture.md §2.1; launch goal 2).
-- NOT APPLIED to the hosted project. Tested on the local stack with
-- supabase/tests/t9_audit_append_only_check.sql. Undo with
-- supabase/rollback/t9_audit_append_only_down.sql.
--
-- p1a (applied 2026-10-26) made audit_events append-only with a trigger and
-- started auditing profiles. Three gaps remained, each confirmed on the local
-- stack (and the first two read from live, 2026-10-30) before this fix:
-- 1. The trigger could be switched off with one SET. Supabase lets the
--    postgres role (dashboard SQL editor, migrations) set
--    session_replication_role = replica, and ordinary triggers don't fire in
--    that mode, so an UPDATE or DELETE on audit_events went through. The
--    profiles audit trigger was skipped the same way. All three now fire
--    in every mode (ENABLE ALWAYS).
-- 2. service_role could still INSERT, so anything holding the service key
--    could write rows that look like real history. Only audit_row_change()
--    and the admin RPCs (security definer, run as the table owner) write
--    the log; nothing calls it with the service key.
-- 3. Deleting an account failed whenever it had audit history: the foreign
--    keys on actor_id and subject_user_id are ON DELETE SET NULL, and that
--    SET NULL is an UPDATE the append-only trigger refuses. So a profile
--    delete could never be audited, and history would have lost who did
--    it. The foreign keys are dropped: the ids stay in the log after the
--    account is gone, and deleting an account works and is recorded.
--
-- Also: the table owner (postgres) loses UPDATE, DELETE and TRUNCATE on the
-- table, a second guard behind the trigger.
--
-- What's left: the owner can still DROP or DISABLE the trigger with DDL, and
-- supabase_admin can do anything. Both are deliberate schema changes, not a
-- quiet edit, and show in the migration history and database logs.

alter table public.audit_events drop constraint audit_events_actor_id_fkey;
alter table public.audit_events drop constraint audit_events_subject_user_id_fkey;

alter table public.audit_events enable always trigger audit_events_no_update_delete;
alter table public.audit_events enable always trigger audit_events_no_truncate;
alter table public.profiles enable always trigger profiles_audit;

revoke insert on public.audit_events from service_role;
revoke update, delete, truncate on public.audit_events from postgres;
