# Launch audit — 2026-10-28

Work queue: `NB4HS_Claude_Goal_Kit/TODAY_CHECKLIST.md`. This document adds to `goals.md`; it does not replace it. Nothing here touched the hosted database, Vercel or any paid service.

**How to read the status labels**
- **Tested**: a test exercised it and the test passed.
- **Read**: someone read the code or migration. Nothing ran it.
- **Read (subagent)**: a read-only review agent found it and nobody has re-checked it. Treat these as leads.

## Baseline

| | |
|---|---|
| Branch | `Djenins/launch-goals`, clean, tracking origin, at `fc48ac1` |
| Build | `npm run build` passes. One chunk is over 500 KB (`index` 1,025 KB, `charts` 553 KB). That is goal 3 in `goals.md` |
| Tests before | 561 passed in 39 files |
| Tests after | 573 passed in 40 files (12 new) |
| Local database | Not available. The repo has no `supabase/config.toml`, so no migration or RLS check ran locally |

## How this maps to goals.md

| Checklist item | Goal in `goals.md` | Status |
|---|---|---|
| Permission loading / legacy fallback | Goals 2 and 10 | Fixed and **tested** (below) |
| RLS inspection | Goal 2 | **Read**; assumptions listed below |
| SNAP tasks / cross-program tasks | New. Not in `goals.md` yet | Design only (below) |
| Staff reports | Goal 7 covers the UI only | Findings below |
| Calendar / notifications / search | Goal 6 covers the UI only | Findings below |
| Deploy variables, NB4HS-owned accounts, budget | Goal 11 | Not started |

## P0 — Permission loading and the legacy fallback (fixed)

**The problem (read, then tested).** `fetchMyPermissions()` returned `[]` when the call failed. `resolveNavItems()` then read any empty list as "the call failed" and showed the old account-type pages. So an account that had *legitimately* lost all access kept its old sidebar and could still open those routes. These accounts get an empty answer:
- a deactivated user whose access token has not expired yet (deactivation ends sessions, but a page reload restores the token from storage)
- an account where every permission is denied by an override
- an account whose modules have all been switched off

RLS still blocked the data, but the pages opened.

**A second problem.** While `my_permissions()` was still loading, `RequireRoute` used the legacy list to decide whether to open the page. A page the permission model refuses could render and fire its queries before the redirect.

**The fix**
- `permissions.js`: `fetchMyPermissions()` now returns `null` on failure, including when the call throws, and `[]` only for an empty answer.
- `AppContext.jsx`:
  - New `permissionsFailed` flag.
  - The permissions effect is now keyed on the user id rather than the session object. A token refresh no longer drops back into the loading state.
- `useNavItems.js`: falls back to the legacy list only while loading or after a failed call. An empty answer now means no pages.
- `RequireRoute.jsx`: renders nothing until the first answer arrives.
- `supabaseAuth.js`: `profileToSession()` refuses `active === false`, so a restored session for a deactivated account doesn't count as signed in. StaffLogin already blocked these accounts at sign-in.
- `StaffLogin.jsx`: passes the failed flag through.

**Tests**
- New `src/lib/permissionLoading.test.jsx`:
  - `fetchMyPermissions` with OK, empty, error and throw
  - `profileToSession` for a deactivated account
  - `RequireRoute` while loading, for a denied page, for an empty answer, and after a failed call
- New cases in `workspaces.test.js` for every account type.
- `ForYouPanel.test.jsx` now sets `permissionsFailed` explicitly.

**What changes for users**
- An account that holds nothing now sees the sign-in page instead of its old pages. It gets no message saying why. That message is a small follow-up, and it is staff-only text in English.
- On a failed call, the app still falls back to the legacy list. That is intended: it keeps staff working during a blip, and RLS still enforces access.

## P0 — RLS: verified vs assumed

What a script over all migrations **read**: every table that is created has RLS enabled. The only `using (true)` policies left are `classes_select` and `courses_select`, which are public catalog data.

What still needs a live check against the hosted database. Each one needs your OK to run as a `begin … rollback` probe.

1. **The applied state matches the repo.** Everything here comes from migration files. Run `supabase/tests/p3_policy_parity_after.sql` against live.
2. **Appointments and calendar events are not scoped by program.** Anyone with `calendar.view` can read every client appointment and every calendar event, including `person_name` and `notes`. Confirm that this is intended for every role that has `calendar.view`.
3. **13 functions can be called without signing in.** The list:
   - `book_staff_appointment`, `bookable_staff`, `check_out_visit`
   - `kiosk_create_visit`, `kiosk_roster`, `kiosk_student_check_in`, `kiosk_visits`
   - `lookup_client_appointments`, `public_appointment_staff`, `public_register_case_client`
   - `public_visit_count`, `request_appointment`, `staff_open_slots`

   None of them has a rate limit. That is S13 in goal 2, and it is still undecided.
4. **`notifications_update_own` lets users change any column of their own rows**, not just `read`. Low risk, but `with check` could pin the other columns.
5. **Reviewers can read staff reports during a revision.** `staff_reports` select is `version > 0`, so reviewers can read the live row and its new attachments while a report is in `revision_requested`. The review screen shows the frozen version, but the API returns the live one. (Read (subagent).)
6. **The `tasks` RLS has `snap.tasks.*` written into it.** A second outreach program would need new permission keys or a policy change. This contradicts a comment in p3d. (Read (subagent).)

## P1 — SNAP tasks and reminders (read (subagent) unless marked)

- **Some tasks are never reminded.** The reminder cron runs once a day at 11:00 UTC. A task that is created after the run and due the same day is never reminded, and overdue tasks never get a second reminder.
- **Reassigned or reopened tasks are never re-reminded.** The dedupe key is `(task, due_date)` and does not include the assignee.
- **People get reminders for tasks they cannot open.**
  - The reminder checks only `profiles.active`, not `snap.tasks.view`.
  - The assignee picker lists every active profile, not just program staff (`SnapTaskList.jsx:163`).
- **Closing or reassigning a case leaves its open tasks unchanged.**
- **Deleting a client hard-deletes their tasks and cases** (`on delete cascade`).
- **Reminder notifications are English-only and have no `link`**, so they can't be clicked.
- **`taskPermissions()` in the UI copies the old role rules, not the current RLS.**

## P1 — Proposal: cross-program tasks (design only)

The goal is to generalize `public.tasks` without changing what SNAP sees. The migration is **not written yet**, because it can't be tested without a local stack (see next steps).

1. **Additive columns on `tasks`:**
   - `module text` (default `'outreach'`)
   - `subject_type text` and `subject_id uuid`, nullable (placement, employer, student…)
   - `due_at timestamptz`, nullable, alongside `due_date`

   Backfill `module = 'outreach'`.
2. **Permissions per module.** Replace the hardcoded `'snap.tasks.view'` and `'snap.tasks.manage'` with a helper, `task_permission(module, program, action)`. For outreach it returns the current keys, so SNAP behaves the same. Keep `can_on_record` scopes.
3. **Reminders:**
   - Move dedupe to a `notice_key` that includes the assignee and due date, the same pattern as staff reports.
   - Run hourly with the `snap_today()` date rules, and add one overdue nudge.
   - Skip assignees who cannot see the task.
   - Set `link`.
4. **Keep as they are:** the `automation_key` uniqueness and its `case_opened:` prefix, the status values, the `completed_at` trigger, the audit trigger, the `snap_task_due` type, and the dashboard counts.
5. **Realtime and calendar:** add `tasks` to `supabase_realtime`, then add a `task` kind to the calendar.
6. **Rollback:** a script in `supabase/rollback/`, plus probes in `supabase/tests/` that match the p3d ones.

## P1 — Staff reports (read (subagent) unless marked)

The database enforces the state machine, blocks self-review and blocks edits after submit. Period and deadline maths is tested across DST.

**Problems:**
1. **Discarding a draft leaves its attachments in storage.** **Read** and confirmed: `discardDraft` deletes only the row (`staffReports.js:431`). After that, the storage delete policy can no longer match.
2. **Changing a schedule's length or start can create overlapping periods.** Only `(schedule_id, period_start)` is unique. Rebuilt periods get new ids, so reminders may go out again.
3. **Reviewers can see live revisions.** See RLS item 5.
4. **The 5-file limit can race,** and the client supplies `size_bytes` and `mime_type`. The bucket still enforces the 10 MB limit and the allowed types.
5. **The email time label probably shows no time zone.** It applies `to_char(…, 'TZ')` to a timestamp without a zone. Suspected.
6. **Reminder offsets are computed in the session's time zone,** so they may land an hour off across DST. Suspected.
7. **A report can be started for any period,** including future ones and up to 60 periods back.

## P1 — Calendar, notifications, search (read (subagent) unless marked)

1. **"Mark all read" can never be clicked. Read and confirmed:**
   - Opening the bell marks every item read one by one (`NotificationBell.jsx:125`). The button then disappears because it only shows while `unreadCount > 0`.
   - Failed requests aren't rolled back.
2. **The calendar shows actions the database refuses.** Edit, Duplicate and Delete appear for events the user doesn't own. A refused delete removes 0 rows and looks like it worked.
3. **The calendar doesn't show** rows from the real `appointments` table, tasks, report due dates or time off.
4. **The `appointment_assigned` type has no translated title.** Its test leaves the type out, so it can't catch this.
5. **⌘K search covers only** pages, students, case clients and staff. Student results link to `/clients/:nbId`, which needs `participants.view`.
6. **`fetchNotifications` has no limit,** and every realtime event fetches the whole list again.

## Next steps (proposed, need your OK)

- **Set up a local Supabase stack** (`supabase init`, Docker), so the task migration and the RLS probes can run locally before any `begin … rollback` against live.
- **Low-risk fixes for the P2 slot:**
  - mark-all-read
  - orphaned attachments on discard
  - calendar action gating
  - reminder `link` and translated titles

  Each would be its own PR.
- **Still to do:** deploy variables and migration order, the NB4HS-owned accounts checklist, and the budget (required vs optional, no invented prices).
