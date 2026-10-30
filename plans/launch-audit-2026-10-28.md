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
| Local database | Set up later the same day; see "Local stack" below |

## Local stack (set up 2026-10-28)

- `supabase/config.toml` (ports 5532x), `supabase/seed.sql` (7 fake accounts), `npm run dev:local`. How to use it is in `README-Dev.md`.
- **All migrations replay from an empty database (tested)**, after one fix (63 at the time; 64 with `t1`). Before the fix, the p1b guard "this would leave no active System Administrator" stopped `p3d_snap_policies` on any database that has no accounts yet. That means a brand-new NB4HS-owned Supabase project could not have been built from the migrations either. The fix adds an early return to `assert_system_admin_remains()` for a database where no account is active and none was ever an administrator. On live there are active administrators, so it never takes this branch and live behavior doesn't change. **This edits an already-applied migration file.** You approved keeping it.

Later the same day I narrowed it (`2f29e90`). My first version, "no active account", would have let the last administrator be deactivated when they were the only active account. `supabase/tests/p1b_bootstrap_check.sql` covers three cases:
- that one, which is now refused
- a new project's first sign-up, which goes through
- the documented first-administrator bootstrap, which works
- **Probes run locally (tested):**
  - `p0b`, `p1`, `p2`, `p3a`, `p5`, `p6a`, `p6b` and `p6c` all pass. `p1` reports legacy parity OK for the 6 active seeded accounts.
  - `p0a` fails on purpose. It asserts the old anonymous appointments insert still works, which was only true between p0a and p0b.
  - The p3 parity scripts weren't run. They wrap a single migration (before, then apply, then after) and need that migration rolled back first.
- **Cron:** the three jobs are scheduled locally. `send-outbound` does nothing because the local vault has no `send_outbound_url`, so nothing calls out.
- **Permission fix in the browser (tested, local stack):**
  - The receptionist lands on Check-In.
  - Typing `/case-management` or `/admin/users` redirects back to Check-In.
  - Deactivating the receptionist mid-session and reloading lands on sign-in with no sidebar.

## How this maps to goals.md

| Checklist item | Goal in `goals.md` | Status |
|---|---|---|
| Permission loading / legacy fallback | Goals 2 and 10 | Fixed and **tested** (below) |
| RLS inspection | Goal 2 | **Read**; assumptions listed below |
| SNAP tasks / cross-program tasks | New. Not in `goals.md` yet | Migration `t1` written and **tested locally**; not applied to live (below) |
| Staff reports | Goal 7 covers the UI only | Findings below |
| Calendar / notifications / search | Goal 6 covers the UI only | Findings below |
| Deploy variables, NB4HS-owned accounts, budget | Goal 11 | Written: [deploy-and-operations.md](deploy-and-operations.md), [nb4hs-accounts-checklist.md](nb4hs-accounts-checklist.md), [launch-budget.md](launch-budget.md) |
| Accessibility, responsive, bilingual (client screens) | Goals 4–8 | Audited in the browser; two fixes (below) |

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

Items marked *(t1)* are fixed by the `t1` migration below, tested locally only.

- *(t1)* **Some tasks are never reminded.** The reminder cron runs once a day at 11:00 UTC. A task that is created after the run and due the same day is never reminded, and overdue tasks never get a second reminder.
- *(t1)* **Reassigned or reopened tasks are never re-reminded.** The dedupe key is `(task, due_date)` and does not include the assignee.
- **People get reminders for tasks they cannot open.**
  - *(t1)* The reminder checks only `profiles.active`, not `snap.tasks.view`.
  - **Fixed (tested in the browser).** The assignee picker listed every active profile, not just program staff (`SnapTaskList.jsx:163`). It now lists the program's active members plus the lead.
- **Closing or reassigning a case leaves its open tasks unchanged.**
- **Deleting a client hard-deletes their tasks and cases** (`on delete cascade`).
- *(t1, link only)* **Reminder notifications have no `link`**, so they can't be clicked. (They are not English-only: the bell translates `snap_task_due` by type. That was a wrong lead.)
- **`taskPermissions()` in the UI copies the old role rules, not the current RLS.**

## P1 — Cross-program tasks: migration `t1` (written, tested locally, not applied)

Files: `supabase/migrations/20261028010000_t1_cross_program_tasks.sql`, `supabase/rollback/t1_cross_program_tasks_down.sql`, `supabase/tests/t1_tasks_check.sql`.

**What it does**
- **New columns on `tasks`:** `module` (required; for SNAP it is filled from the program) and an optional `subject_type` + `subject_id` pair for the record a task is about. `program` may now be empty, for tasks outside Outreach. Existing rows get `module = 'snap'` without an `updated_at` bump or audit rows.
- **Access:**
  - SNAP tasks keep exactly today's rule.
  - Tasks in other modules check `<module>.tasks.view` / `.manage`. Those permissions don't exist yet, so those tasks stay closed to everyone. Turning tasks on for Case Management or Workforce is a later decision: add the two keys and grant them.
  - A task can't move to another module.
- **Reminders:**
  - Run hourly from 7:00 to 19:59 New York time, instead of once at 11:00 UTC.
  - One "due" reminder per task, assignee and due date, so reassigned or re-dated tasks are reminded again.
  - One "overdue" nudge the day after the due date.
  - Only to assignees who can open the task.
  - Linked to `/snap/tasks`.
  - Reminders already sent are carried over, so nobody is reminded twice when it goes live.
- **Realtime:** `tasks` is added to `supabase_realtime`.
- **App:** the bell shows a title for the new `task_overdue` type. It is staff-only, so the `ht`/`fr` text is English.

**Tested on the local stack**
- **SNAP parity:** `p3d_probes` with `p3_policy_parity_before/after` on table `tasks` found 2,880 answers for 32 simulated people, with no changes:
  - before → after the migration
  - after → after the rollback

  The test does catch a real change: a deliberately broken owner rule produced 30 differences.
- **`t1_tasks_check.sql` passes:**
  - the module rules
  - Case Management tasks closed by default and opened by an `assigned`-scope grant
  - reminder count, link, quiet hours, overdue nudge, no repeats, reassignment, re-dating, and finished tasks
- **Carry-over:** a re-apply over a reminder that had already been sent did not send it again.
- **Full replay:** `supabase db reset --local` with all 64 migrations, then every probe except the stale `p0a` passes.
- **API:** through the API as the seeded SNAP worker, a SNAP task insert and read work as before, and a Case Management insert is refused.
- **App:** 573 unit tests and the build pass.

**Not done here:**
- the assignee picker that lists every active profile
- what happens to open tasks when a case closes or is reassigned
- `on delete cascade` from clients
- `taskPermissions()` in the UI
- a calendar `task` kind
- `due_at` (a time of day)

**Before it goes to live:** a `begin … rollback` dry run of the parity run and `t1_tasks_check.sql` against the hosted project, then your approval, per `goals.md`.

## P1 — Staff reports (read (subagent) unless marked)

The database enforces the state machine, blocks self-review and blocks edits after submit. Period and deadline maths is tested across DST.

**Problems:**
1. **Fixed (`6b666e4`, tested).** **Discarding a draft leaves its attachments in storage.** **Read** and confirmed: `discardDraft` deletes only the row (`staffReports.js:431`). After that, the storage delete policy can no longer match.
2. **Decided and done in `t4`: used schedules are locked.** **Changing a schedule's length or start can create overlapping periods.** Only `(schedule_id, period_start)` is unique. Rebuilt periods get new ids, so reminders may go out again.
3. **Decided and done in `t4`: hidden until resubmitted.** **Reviewers can see live revisions.** See RLS item 5.
4. **Fixed in `t4`.** **The 5-file limit can race,** and the client supplies `size_bytes` and `mime_type`. The bucket still enforces the 10 MB limit and the allowed types.
5. **Fixed in migration `t2` (`162421d`, tested locally, not on live).** **The email time label shows no time zone.** Confirmed: it rendered "Mon, Nov 2, 2026 at 5:00 PM ". It now shows EST or EDT, or a UTC offset for any other zone.
6. **Fixed in `t4` (confirmed first).** **Reminder offsets are computed in the session's time zone,** so they land an hour off across DST. A "3 days before" reminder for a Nov 2 17:00 EST deadline fired at 18:00 EDT.
7. **A report can be started for any period,** including future ones and up to 60 periods back. Confirmed: the insert policy only checks the author, and a draft for a future period was accepted locally. **Decided and done in `t4`:** the current and past periods are allowed, future ones refused.

## P1 — Calendar, notifications, search (read (subagent) unless marked)

1. **Fixed (`9b849db`, tested).** **"Mark all read" can never be clicked. Read and confirmed:**
   - Opening the bell marks every item read one by one (`NotificationBell.jsx:125`). The button then disappears because it only shows while `unreadCount > 0`.
   - Failed requests aren't rolled back.
2. **Fixed (`21b6228`, tested).** **The calendar shows actions the database refuses.** Edit, Duplicate and Delete appear for events the user doesn't own. A refused delete removes 0 rows and looks like it worked.
3. **The calendar doesn't show** rows from the real `appointments` table, tasks, report due dates or time off.
4. **Fixed (`343a3fa`).** **The `appointment_assigned` type has no translated title.** Its test leaves the type out, so it can't catch this.
5. **Fixed (`12c7372`, tested).** **⌘K search: student results linked to `/clients/:nbId` for people the route guard refuses.** Confirmed for Executive Oversight, which has `students.view` without `participants.view`. Search now asks `routeAllowed("clients")`. Search still covers only pages, students, case clients and staff.
6. **Fixed (`2b38afd`, tested).** **`fetchNotifications` has no limit,** and every realtime event fetches the whole list again. It is now capped at the newest 50.

## P2 — Low-risk fixes (done)

Each fix is its own commit on `Djenins/launch-goals`. None is pushed.

| Commit | Fix | How it was checked |
|---|---|---|
| `9b849db` | **Notification bell.** Items stay unread while the panel is open, and "Mark all read" works. Closing the panel marks them read in one request. A failed write puts the unread state back. | New component test `NotificationBell.open.test.jsx` (3 cases) |
| `6b666e4` | **Discard draft.** The draft's uploaded files are removed before the report row is deleted. If storage fails, the draft is kept. | Unit test `staffReportsDiscard.test.js` (3 cases). On the local stack, as the seeded staff account: the old order left the file in the bucket, and the new order removes it |
| `21b6228` | **Calendar actions.** Edit and Delete only on your own events, or with `calendar.events.manage_all`. Duplicate and adding need `calendar.events.create`, which Executive Oversight doesn't have. A refused delete or update now shows an error. | Unit test `calendarRights.test.js` (6 cases). In the browser as the seeded receptionist: another person's event offers only View and Duplicate, their own offers all four. The API confirms a refused delete returns 204 with 0 rows |

| `343a3fa` | **`appointment_assigned` notifications** get a title key like every other server type. They're staff-only, so the `ht`/`fr` text is English. | The type is now in `NotificationBell.test.jsx` |
| `a19b351` | **Page language for screen readers.** `<html lang>` follows the language the page shows. Before, it stayed `en` on Kreyòl and French pages. The kiosk's "Check its status" link gets a 44px tap area with no visual change | In the browser at phone width: `lang` goes `en` → `fr`, back to `en` on a staff page and `fr` again on a client page. The paragraph keeps its 41px height and the text doesn't move |

After these fixes: 585 unit tests and the build pass. All 10 SQL checks pass after a full replay of the 64 migrations (`p0a` is stale by design).

## P2 — Client screens: accessibility, responsive, bilingual

**Screens checked:**
- check-in landing
- student check-in
- visitor check-in
- check-out
- appointment request
- appointment lookup
- new-client registration

**How:**
- **Bilingual:** a script compared every `t("…")` key on these pages and their components with `i18n.js`, and looked for hardcoded English. It found no missing keys and no hardcoded text. The only `ht`/`fr` values equal to English are a phone placeholder and French "Date", both correct.
- **In the browser,** on the local stack at 375 px, a script checked each screen for:
  - unlabeled fields and nameless buttons
  - images without `alt`
  - targets under 24 px
  - horizontal overflow
  - heading order and a `main` landmark
- **Contrast:** computed for text on the kiosk landing.

**Results:**
- **Clean:** every screen had labels, headings, `main` and no overflow, and none of the 20 text styles checked failed contrast.
- **Registration errors:** submitting the empty form moves focus to the first problem field. Each field gets `aria-invalid` and `aria-describedby` pointing at its message, and a polite status sums it up.
- **Fixed:** `<html lang>` and the small kiosk link (above).
- **Deliberate, unchanged:** the client's language choice isn't saved, so a shared kiosk starts the next person in English.

**Not covered:**
- a real screen reader
- keyboard-only walkthroughs of every flow
- the kiosk QR scan and camera path
- dark mode
- contrast beyond the landing page

## PR #64 acceptance pass (2026-10-28, later)

Everything below ran on the local stack after `supabase db reset --local` replayed all 65 migrations.

**New checks**
- **`src/test/roleMatrix.local.test.jsx` (7 tests).** It signs in as every seeded account through the real API and runs their profile, program roles and `my_permissions()` through the app's own `routeAllowed` and `adminSectionsFor`. For every account, the permission model's pages equal the account-type pages; forbidden pages stay shut; the administrator reaches all five Admin sections; and the deactivated account is not a session and holds nothing. It is skipped in `npm test` and CI.
- **`supabase/tests/t1_rollback_*.sql`.**
  - SNAP tasks in every state survive the rollback and the re-apply. Every column is compared, plus the reminders sent and the audit count, with no `updated_at` bump.
  - The rollback refuses to run while a task outside Outreach exists.
  - A deliberately broken `t1` (no trigger guard on the backfill) fails it.
- **SNAP parity across the `t1` rollback,** on the fresh database: 2,880 answers, no changes.
- **`t2_time_label_check.sql`,** plus a rollback check.

**Fixes in this pass**
- **⌘K search links,** the **SNAP assignee picker,** and the **notification limit** (above).
- **A test bug: `p5_admin_check.sql` failed about half the time on a fresh database.** It used `array_agg(... order by 1)`, which sorts by the constant 1, not a column. The aggregates now order by their own expression, and 18 runs in a row pass. The app was never at fault.

**End to end in the browser (local stack)**
- **Notifications, as the receptionist:**
  - the badge updates live
  - items stay unread while the panel is open
  - "Mark all read" sets `read = true` in the database
  - closing the panel marks new items read
- **Calendar, as the receptionist:** create, duplicate, edit and delete all work, confirmed in the database after each step.
  - A refused delete or edit can't be reached from the UI any more. `calendarDataRefusal.test.js` covers that data-layer path.
- **SNAP supervisor:** the follow-up assignee picker lists only SNAP members.

**Observations, not changed**
- **Receptionists can open client profile pages.** p3a gave them `participants.view` so they can see the check-in roster, matching the old rules. Whether that should include full client profiles is an owner decision.
- **`taskPermissions()` in the SNAP UI mirrors the legacy program roles,** not the permission keys. Custom roles or overrides could see a button the database then refuses. `updateTask` already reports "not permitted" when that happens.
- **Staff report items 2, 3, 4 and 6** need schema changes and product decisions. Not changed.
- **The calendar doesn't show** appointments, tasks or time off. That is a feature, not a fix.
- **Event drawer edit fields have visible labels with no `for`/`id` link.** It's a staff-only screen and not changed.

## Owner decisions (answered 2026-10-28) and what was built

| Decision | Built in | Evidence (local stack) |
|---|---|---|
| **Receptionists: check-in only.** They lose client profiles and participant records. | Migration `t3` drops `participants.view` and `participants.edit` from the legacy receptionist role. The app loads the kiosk roster for staff who can't read the students table. | `t3_receptionist_check.sql` covers records shut, roster, visitor and student check-in, and check-out; it fails without `t3`. The role matrix declares `clients` as an intended removal. **In the browser:** student check-in from the roster, check-out, and `/clients/…` redirecting to Check-In |
| **Reports for the current and past periods only.** | `t4` adds an insert trigger. My Reports hides Start until a period begins. | `t4_staff_report_rules_check.sql`, `MyReportsAction.test.jsx`, and the `StaffReports.test.jsx` "before the period" case |
| **Revisions hidden from reviewers until resubmitted.** | `t4`: reviewers can't read the live row during a revision; `staff_reports_in_revision()` returns it with the submitted content. New files are hidden until resubmission; history and reviews stay readable. The app folds those rows into the reviewer list and the review screen. | The `t4` check (row, function, versions, reviews, attachments, storage, after resubmit). **Through the real API:** the reviewer reads no live row and gets "as submitted" with the period attached. **In the browser:** the list shows "Revision requested" and the review screen shows the submitted text, not the edit. `staffReportsRevision.test.js` |
| **A used schedule is locked.** Its length and start date can't change. | `t4` adds an update trigger. The settings screen explains a refused change. | `t4` check: length and start are refused; other settings still change |

Also in `t4`:
- **Attachments:** the five-file cap holds under concurrent uploads, and the size and type come from the stored file.
- **Reminders:** the DST reminder fix.

`p6a`, `p6b` and `p6c` now use a started period. Before, they started reports in a future one, which `t4` refuses.

**Note for live:** the first reporting period starts Nov 2, 2026. Once `t4` is applied, no report can be started before then, by design; My Reports shows when the first period starts.

**Gap:** there is no "new schedule" screen. Changing a used schedule's length means an administrator creates a new schedule in SQL and switches the old one off.

## Live dry runs (2026-10-28, approved)

Against the hosted project `vkbzarlkqzvhsfdmxyyq` through the Supabase Management API (`supabase db query --project-ref … -f`).

**How:** every run was one file, `begin; <migration(s)>; <check>; rollback;`. Every check ends by raising an exception, so nothing could commit. Before any migration ran, two probes proved this on the hosted project:
- the whole file ran in one transaction (same transaction id)
- an error rolled back a table created earlier in the same file

That second proof was done once with the MCP tool and once with the CLI.

**Live preconditions (counts only):**
- active accounts: 3 administrators, 1 case manager, 1 staff
- SNAP roles: 1 worker, 1 program admin
- records: 0 staff reports, 0 tasks, 0 started report periods
- no HTTP triggers; the only `auth.users` trigger creates the profile

The `t1`, `t3` and `t4` checks were made portable first (`97fd15f`): they create throwaway accounts and test periods inside the rolled-back transaction.

**Each migration alone:**

| Migration | Checks | Result |
|---|---|---|
| `t1` | p3d SNAP parity before → after | **Pass:** 2,880 answers, 32 personas, no changes |
| `t1` | `t1_tasks_check.sql` | **Pass** |
| `t1` | `t1_rollback_*`: rollback, then re-apply | **Pass** |
| `t1` | SNAP parity across the rollback | **Pass:** 2,880 answers, no changes |
| `t2` | `t2_time_label_check.sql`; `p6b_outbound_check.sql` | **Pass**; **Pass** |
| `t3` | `t3_receptionist_check.sql`; `p1_access_check.sql` | **Pass**; **Pass:** parity for 5 accounts |
| `t4` | `t4_staff_report_rules_check.sql`; `p6a`, `p6b` and `p6c` | **Pass**; all **Pass** |

**All four stacked in apply order,** followed in separate runs by `p1`, `p2`, `p5`, `p6a`, `t1_tasks_check`, `t3_receptionist_check` and `t4_staff_report_rules_check`: all **Pass**.

Five earlier stacked runs left the migrations out by mistake, because of shell word splitting. They tested live as it is: the `t1` and `t4` checks failed as expected, and `p1`, `p2` and `p5` passed. They are not counted above.

**Afterwards, read-only, live was unchanged:**
- 63 migrations recorded, the newest p6c
- none of the new columns, functions, tables or triggers exist
- the task reminder job is still `0 11 * * *`
- receptionists still hold both participant grants
- the email time label still has no zone
- no throwaway accounts or marker tables remain
- staff reports 0, tasks 0, clients 3, students 10
- no notifications in the last hour

## Applied to live (2026-10-28, approved)

`t1`, `t2`, `t3` and `t4` were applied in order to `vkbzarlkqzvhsfdmxyyq`. Each ran as one transaction (`begin; <file>; insert into supabase_migrations.schema_migrations …; commit;`) and was recorded under its file's version.

**Before:** the read-only state matched the dry runs: 63 migrations, no staff reports, no tasks, no receptionists.

**After each migration:**

| | Visible on live | Checks |
|---|---|---|
| `t1` | Module column, the 3 new functions, `task_notices_sent`, the job at `5 * * * *` running `send_task_reminders()`, and `tasks` in realtime | `t1_tasks_check`: **pass**. SNAP parity against the old rules (rolled back): **pass**, 2,880 answers, no changes |
| `t2` | The label reads "Mon, Nov 2, 2026 at 5:00 PM EST" | `t2_time_label_check`, `p6b`: **pass** |
| `t3` | Receptionist participant grants: 0 | `t3_receptionist_check`, `p1`: **pass** |
| `t4` | 3 triggers and 3 functions; the period trigger runs as the caller | `t4_staff_report_rules_check`, `p6a`, `p6c`: **pass** |

**Final sweep against live:** `p0b`, `p1`, `p2`, `p3a`, `p5`, `p6a`, `p6b`, `p6c` and `t1`–`t4` all **pass**.
- **Migrations:** live and the repo hold the same 67 versions.
- **Leftovers:** no test accounts.
- **Data unchanged:** staff reports 0, tasks 0, clients 3, students 10.

## Live security checks (2026-10-28)

All read-only, against `vkbzarlkqzvhsfdmxyyq`. Covers RLS items 1–6 from "P0 — RLS: verified vs assumed".

| # | Item | Result on live |
|---|---|---|
| 1 | Does the applied security setup match the repo? | **Verified identical.** 580 items compared against a fresh local replay of the repo: 212 policies (`public` and `storage`), the RLS flags on 76 tables, `anon`/`authenticated`/`PUBLIC` execute grants and definer flags on 142 functions, and 150 table grants. Nothing differs, and nothing exists on only one side. |
| 2 | Appointments and calendar events aren't scoped by program | **Confirmed as designed.** Both select policies are `has_permission('calendar.view')`. All 5 active staff hold it, through every legacy role and Executive Oversight, so everyone reads every appointment, including `person_name` and `notes`. **Owner decision:** keep, or scope by program. |
| 3 | Functions open without sign-in, with no rate limit | **Confirmed: 13 that touch data**, all security definer: `book_staff_appointment`, `bookable_staff`, `check_out_visit`, `kiosk_create_visit`, `kiosk_roster`, `kiosk_student_check_in`, `kiosk_visits`, `lookup_client_appointments`, `public_appointment_staff`, `public_register_case_client`, `public_visit_count`, `request_appointment` and `staff_open_slots`. Four more open functions (`access_scope_name`, `access_scope_rank`, `audit_values_table`, `legacy_role_programs`) are fixed lookups that read no data. No rate limiting exists. **Owner decision** (S13 in `goals.md`). |
| 4 | `notifications_update_own` allows any column | **Confirmed, and low risk.** Staff can change `title`, `message`, `link` or `type` on their **own** notifications. `user_id` is pinned by `with check`, and `link` is limited to in-app paths. The fix would grant update on `read` only (a small migration). Not done here. |
| 5 | Reviewers could read revisions in progress | **Fixed by `t4`** (applied). `t4_staff_report_rules_check` passed on live. |
| 6 | Tasks RLS hardcoded `snap.tasks.*` | **Fixed by `t1`** (applied). Module-aware `can_on_task()`; SNAP parity passed on live. |

**Supabase Auth settings** (read with `supabase config diff`, which writes nothing):
- **Site URL:** `https://app.nb4hs.org`.
- **Redirect URLs:** `https://app.nb4hs.org/**`, `https://*-marcdeeh.vercel.app/**` and `http://localhost:5173/**`. The reset page on the custom domain is allowed.
  - **Gap:** the plain `nb4hs-app.vercel.app` alias isn't in the list. A reset requested there falls back to the Site URL. To make that alias work fully, add `https://nb4hs-app.vercel.app/**`; or tell staff to use `app.nb4hs.org`.
- **Email:** confirmations are on. TOTP two-factor is enabled.
- **SMTP:** no custom SMTP shows as differing from the local default, so production is probably still on Supabase's built-in mailer, which has a low hourly limit. See `deploy-and-operations.md` §1.
- **Edge Function secret `SITE_URL`:** set to `https://app.nb4hs.org` (2026-10-28).

## Still open

**REQUIRES OWNER APPROVAL:**
- **Deployed 2026-10-28** (PR #64, merge `16a1cc7`, production `dpl_4Cx9ZLX…`). The no-sign-in checks passed; the per-role checks in `deploy-runbook-pr64.md` still need staff with real accounts.
- **Decisions from the live security checks:** calendar and appointment scoping (item 2); rate limits on the 13 open functions (item 3); whether to tighten `notifications` updates to `read` only (item 4).
- **NB4HS accounts and plans:** ownership transfers and any paid plan.

**Leads not acted on:**
- the calendar not showing appointments, tasks or time off
- the task items under `t1`'s "Not done here"
- `taskPermissions()` mirroring legacy program roles
- a "new schedule" screen
