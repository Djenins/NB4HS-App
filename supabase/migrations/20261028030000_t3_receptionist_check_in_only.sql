-- t3 -- receptionists keep check-in and check-out, and lose participant
-- records (owner decision, 2026-10-28; launch-audit-2026-10-28.md).
-- NOT APPLIED to the hosted project. Live dry run 2026-10-28 (rolled back): t3 check
-- and p1 passed. Tested on the local stack with
-- supabase/tests/t3_receptionist_check.sql. Undo with
-- supabase/rollback/t3_receptionist_check_in_only_down.sql.
--
-- p3a gave the legacy receptionist role participants.view and
-- participants.edit (org scope) to mirror the old "any staff member reads
-- students" rule. That also opened every client, student, food client and
-- food distribution record, client profile pages, and edits to classes,
-- courses and shared lists. Check-in needs none of it:
--   * visits: front_desk.checkin / .checkout (unchanged)
--   * the student roster: kiosk_roster(), names and class only -- the app
--     falls back to it when the students table returns nothing
--   * student and visitor check-in: kiosk_student_check_in() and
--     kiosk_create_visit() (unchanged)
-- Only the legacy receptionist role changes; a receptionist who also holds
-- another role keeps what that role gives.
delete from public.role_permissions rp
using public.roles r
where r.id = rp.role_id and r.key = 'legacy_receptionist'
  and rp.permission_key in ('participants.view', 'participants.edit');
