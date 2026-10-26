# Staff Biweekly Reporting — Architecture Proposal

Status: **approved 2026-10-26. Stage R1 built; its migration applied 2026-10-26 (version 20261026075822).**
Organization-wide module (not part of SNAP / Outreach). Staff submit a report every two weeks to the
Executive Director, Bernard Georges, and to any other explicitly granted reviewer.

---

## 1. Existing codebase findings (inspected 2026-10-26)

| Area | What exists | Reuse |
|---|---|---|
| Auth / staff | Supabase Auth email+password; `profiles(id, name, email, role, active)` via `handle_new_user`; `prevent_self_role_escalation` trigger | Staff identity = `auth.uid()`; never a client-supplied id |
| System roles | `profiles.role` ∈ administrator, staff, receptionist, case_manager, job_developer; `is_admin()`, `has_role()` | Admin configures the schedule and grants reviewers |
| Program roles | `program_staff(user_id, program, program_role, active)` + `has_program_role()`, `can_manage_program()`; `program` CHECK is `('snap')` only; deliberately **no admin bypass** | Add program `staff_reports` with roles `reviewer` / `program_admin` — the "existing role system" for reviewer permission |
| Departments | **None.** No departments table; `program_staff` is SNAP-only; `outreach-management-architecture.md` proposes a `programs` registry but it is unapproved | Need a small department registry + staff assignments (§5) |
| Navigation | `nav.js` (`navItemsForRole`, `NAV_SECTION`), `RequireRoute` (route guard = same rule as sidebar), `ModuleNav` for in-module sections, `SnapOutreach.jsx` as the module-page pattern | New nav keys + one module page with ModuleNav |
| In-app notifications | `notifications(user_id, appointment_id, type, title, message, read)`, realtime, `NotificationBell` (localizes known `type`s, e.g. `snap_task_due`). Rows inserted only by security-definer DB code. **No link column** — rows can't open a page | Reuse table; add nullable `link` column; bell navigates on click |
| Email | **None anywhere** — no provider, no Edge Functions (0 deployed), no `pg_net`. SNAP plan §7 already reserved an `outbound_messages` queue + provider interface for later | Build that queue once, here, generic enough for SNAP Stage 4 to reuse |
| Scheduling | `pg_cron` enabled; job `snap-task-reminders` (daily 11:00 UTC) calls an idempotent function with a `*_reminders_sent` dedupe table; `snap_today()` hardcodes `America/New_York` | Same pattern; but use the schedule's configured time zone |
| Audit | `audit_events` + generic `audit_row_change()` trigger (records *which* fields changed, never values) | Attach to all new tables; explicit review history table for reviewer actions/comments |
| Storage | One private bucket `client-documents` (`client_documents` table, RLS) | New private bucket `staff-report-files`, same pattern |
| Reports / export | `Reports.jsx`/`WorkforceReports.jsx` CSV export; `jspdf` + `html2canvas` installed | CSV summary export; print/PDF of one report |
| Tests | Vitest + Testing Library; pure-logic `lib/*.test.js` + page/component tests. No SQL test harness | Pure deadline/status logic in JS with tests; SQL verified in a `begin … rollback` script |

**Live-data findings that need your decision**

- A profile named **"Bernard Georges" exists with role `administrator` but `active = false`.** He can't sign
  in or receive notifications until reactivated. I will not grant anything based on the name — please
  confirm this is his account (by email) and that it should be reactivated.
- 5 active staff today (3 administrators, 1 staff, 1 case manager).
- Being an administrator will **not** by itself let anyone read others' reports (same rule as SNAP case
  notes). Admins configure the schedule and grant the reviewer role; reviewers read reports.

**Repo state:** the working tree has uncommitted edits in ~15 files (modals, SNAP components,
`main.css`, new `useModalA11y.js`) that aren't mine. I'll leave them alone and do this work on a new branch
from `origin/main`.

---

## 2. Recommended navigation

| Sidebar item | Route | Who sees it | Section |
|---|---|---|---|
| **My Reports** | `/myreports`, `/myreports/:reportId` | Every active staff member who is *expected* to report (assigned to ≥1 department covered by an active schedule) | Overview |
| **Staff Reports** | `/staffreports` (ModuleNav: Overview · All reports · Schedule), `/staffreports/:reportId` | `reviewer` role; *Schedule* tab only for administrators / reporting `program_admin` | Overview |

Both guarded by `RequireRoute` (UI), with RLS + RPC checks as the real control. Notification links point at
these routes; no tokens in URLs — "secure link" = authenticated route + RLS.

---

## 3. Staff experience — My Reports

**Header card (current period):** "Reporting period Oct 19 – Nov 1, 2026 · Due Mon Nov 2, 5:00 PM
(America/New_York) · 3 days left", one status chip per department the person reports for, and one primary
button: **Create report** / **Continue draft** / **Revise report** (revision requested) / *Submitted ✓*.

**Lists below:** Needs revision (highlighted, with reviewer's comment) · Drafts · Submitted / history (period,
department, submitted date, status, reviewer action). Filter by department and year.

**Report form** (single page, sectioned, autosave every few seconds + explicit *Save draft*):

| Field | Required to submit |
|---|---|
| Staff member — read-only, from session | auto |
| Department/program — picker limited to the person's assignments | yes |
| Reporting period — read-only, from the schedule | auto |
| Activities completed | yes |
| Key accomplishments | yes |
| Quantitative outcomes — repeatable rows: metric · value · unit/notes | no |
| Challenges encountered | yes |
| Assistance or decisions needed from management | no (explicit "None" checkbox) |
| Goals for next period | yes |
| Additional comments | no |
| Attachments — PDF, DOCX, XLSX, PNG/JPG, ≤10 MB each, ≤5 files | no |

A short privacy note on the form: *don't include participant names, case numbers or case notes — refer to
counts and outcomes.* Submit opens a confirm dialog summarizing period/department, disables while in flight,
then shows a confirmation screen with the submission timestamp.

**Multiple departments:** one report per staff × department × period (recommended — Bernard sees each
department's work separately and the duplicate rule is exact). Alternative: one combined report per period
with a per-department section. *Decision needed.*

## 4. Bernard's experience — Staff Reports

**Overview tab** — period picker (defaults to current), department + staff filters, then KPI tiles: Expected ·
Submitted · Pending (not yet due) · Overdue · Awaiting review · Revision requested · Submission rate (%).
Below: a table — Staff member · Department · Period · Due · Submitted · Status · Action (*Review* / *View*),
sortable, searchable, mobile-collapsing to cards.

**All reports tab** — the same table across periods with search (staff, department, text) and date range;
**Export CSV** of the summary rows (no attachments, no free-text bodies unless "include content" is
ticked).

**Report detail** — full content, attachments (signed URL, short expiry), version history (each
submission is a frozen snapshot; diff-friendly side-by-side of current vs previous), review history, links to
the same person's previous reports. Actions: **Acknowledge**, **Request revision** (comment required),
**Print / PDF**. Opening a *Submitted* report moves it to *Under review* automatically.

**Schedule tab** (admins / reporting program_admin): first period start, duration (14 days default),
deadline rule, time zone, which departments are covered (or all), reminder offsets, grace period, active
toggle; plus department list and staff ↔ department assignments; plus who holds the reviewer role.

---

## 5. Database changes (one additive migration per stage, nothing existing dropped)

```
departments                (id, key, name, active, sort_order)                     -- org registry
staff_departments          (user_id→profiles, department_id, active, primary key(user_id, department_id))
programs                   -- (O1 registry) row 'staff_reports', module 'staff_reporting'
program_staff              -- role CHECK per program: staff_reports takes reviewer | program_admin
reporting_schedules        (id, name, first_period_start date, period_days int default 14 check > 0,
                            deadline_days_after_end int default 1, deadline_time time default '17:00',
                            time_zone text default 'America/New_York' (validated against pg_timezone_names),
                            grace_hours int default 0, reminder_offsets int[] default '{-3,-1,0,1}',
                            applies_to_all bool default true, active, created_by, timestamps)
reporting_schedule_departments (schedule_id, department_id)
reporting_periods          (id, schedule_id, period_start date, period_end date, due_at timestamptz,
                            unique(schedule_id, period_start))                     -- materialized by cron
staff_reports              (id, period_id, staff_id→profiles, department_id, status, content columns…,
                            quantitative_outcomes jsonb, version int, submitted_at, submitted_by,
                            last_reviewed_by, acknowledged_at, timestamps,
                            unique(period_id, staff_id, department_id))              -- duplicate guard
staff_report_versions      (report_id, version, content jsonb, submitted_at, submitted_by)  -- immutable snapshots
staff_report_reviews       (id, report_id, reviewer_id, action submitted|review_started|revision_requested|
                            acknowledged, comment, created_at)                        -- review history
staff_report_attachments   (id, report_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
report_reminders_sent      (period_id, staff_id, department_id, offset_days, sent_at, primary key(all 4))
outbound_messages          (id, channel 'email', to_user_id, to_address, template, payload jsonb,
                            dedupe_key unique, status queued|sending|sent|failed|cancelled,
                            attempts, next_attempt_at, last_error, provider_message_id, sent_at, created_at)
notifications              -- add nullable `link text`
storage bucket             staff-report-files (private), path = {report_id}/{uuid}-{name}
```

**Key rules**

- `staff_id` defaults to `auth.uid()`; a trigger rejects any insert/update where `staff_id <> auth.uid()`
  (no submitting on someone else's behalf). An admin "submit for" path is *not* built unless you ask.
- Staff may update content only while their own report is `draft` or `revision_requested`; a BEFORE UPDATE
  trigger blocks client changes to `status`, `submitted_*`, `version`, review columns.
- Status changes only through security-definer RPCs: `submit_staff_report(id)`,
  `start_staff_report_review(id)`, `acknowledge_staff_report(id, comment)`,
  `request_staff_report_revision(id, comment)`. Each checks the caller, validates the transition, writes
  `staff_report_reviews`, `notifications` and `outbound_messages` **in the same transaction**.
- Allowed transitions: draft→submitted; submitted→under_review; submitted/under_review→revision_requested |
  acknowledged; revision_requested→submitted (version+1). Acknowledged is final.
- RLS: own rows (select/insert/update draft); `has_program_role('staff_reports', ['reviewer'])` select all;
  no client deletes of submitted reports. Attachments and the storage bucket follow the parent report's
  access. Departments/schedules readable by authenticated staff, writable by admins/reporting program_admin.
- `audit_row_change()` trigger on every new table.
- `staff_reports_overview(period_id, department_id, staff_id)` — security-definer RPC for the dashboard,
  refusing non-reviewers; returns expected × actual (the "expected" set = active staff assigned to a covered
  department, so missing reports show as Pending/Overdue rows even though no row exists).

**Deadline math (time zone safe):** `due_at = ((period_end + deadline_days_after_end) + deadline_time) at time
zone time_zone`, computed in Postgres so DST is handled by the tz database. Overdue = `now() > due_at +
grace_hours` and no submitted version. Period N starts `first_period_start + N × period_days` — truly every
14 days, never "twice a month". The same formula lives in `src/lib/reportingSchedule.js` for display and tests.

No production data is modified except: reactivating Bernard's profile and granting his reviewer role, each
only after you confirm.

---

## 6. Reminder and notification architecture

```
 staff submits ─▶ submit_staff_report() ── one transaction ──┐
                     ├─ staff_reports.status = submitted       │
                     ├─ staff_report_versions snapshot          │  commit: the report is safe
                     ├─ staff_report_reviews 'submitted'        │  even if email never works
                     ├─ notifications → each reviewer (link)    │
                     ├─ outbound_messages (queued) → reviewers  │
                     └─ cancel queued reminder emails for it ───┘
                                     │
 pg_cron every 5 min ─▶ pg_net POST ─▶ Edge Function `send-outbound`
                                         ├─ claims queued rows (FOR UPDATE SKIP LOCKED)
                                         ├─ re-checks still relevant (reminders: not yet submitted)
                                         ├─ provider API → 2xx + id ⇒ status 'sent' (= accepted by provider,
                                         │                                   never shown as "delivered")
                                         └─ error ⇒ attempts+1, backoff 5m·15m·1h·6h, 'failed' after 5

 pg_cron hourly ─▶ staff_reports_tick()
                     ├─ materialize current + next period for each active schedule
                     └─ for each expected (staff, dept, period) with no submitted report and
                        now() ≥ due_at + offset (offsets from the schedule):
                          insert report_reminders_sent (PK dedupes) → notification + queued email
```

- **Hourly** (not daily) so reminders follow the configured deadline time and zone, including DST.
- Reminders stop automatically: the tick only targets unsubmitted expectations, and submission cancels any
  still-queued reminder emails. A revision request creates a new expectation for that report (one reminder
  at +1 day if not resubmitted — confirm).
- Notification types (localized in the bell like `snap_task_due`): `staff_report_submitted`,
  `staff_report_revision_requested`, `staff_report_acknowledged`, `staff_report_due`,
  `staff_report_overdue`. Text is generic: *"New biweekly report submitted by Jane Doe for Oct 19 – Nov 1."*
- **Email** subject `New NB4HS Biweekly Report — [Staff Name]`; body: name, department, period, submission
  time (in the schedule's zone), **Review Report** button → `https://<app>/staffreports/<id>`. Never report
  content, participant info or case notes. Revision-requested and acknowledged emails go to the staff
  member, with the reviewer's comment shown only in the app.
- Admin visibility: Schedule tab shows the email queue health (queued / failed counts, last error) so a
  provider outage is visible instead of silent.
- **Until an email provider is approved and configured, messages stay `queued`** and the app says
  "email pending"; in-app notifications work from Stage R1.

---

## 7. Implementation stages (each is its own PR; migration applied only after your OK)

| Stage | Contents | Tests |
|---|---|---|
| **R1 — Core reporting** | departments, staff_departments, schedules, periods, staff_reports, versions, reviews, `notifications.link`, `staff_reports` program roles; RPCs + RLS + audit; My Reports (drafts, autosave, submit, revise); Staff Reports (overview, table, detail, acknowledge, request revision); Schedule tab; bell links; in-app notifications for submit/revision/ack | deadline/period math incl. DST (Nov 1 2026, Mar 14 2027) and midnight/date boundaries; status transitions; validation; duplicate prevention; multi-department expectations; nav/route guard by role; page tests for draft→resume→submit and reviewer actions; SQL `begin…rollback` script for RLS: staff can't read others', can't spoof `staff_id`, can't change status, non-reviewer admin can't read |
| **R2 — Reminders & overdue** | `report_reminders_sent`, `staff_reports_tick()`, hourly pg_cron job; overdue status in dashboard | reminder due-time calc per offset; dedupe on re-run; cancellation after submission; overdue + grace |
| **R3 — Email** | `outbound_messages`, pg_net, Edge Function `send-outbound`, templates, retry/backoff, queue health card | queue claim, retry/backoff, failure after N, "sent" only on provider 2xx, submission survives provider failure (function tested with a stubbed provider) |
| **R4 — Attachments & export** | private bucket + policies, upload/download with signed URLs, CSV export, print/PDF | type/size limits, attachment access follows report access |

**Deployment requirements:** apply migrations R1–R4 (each after your approval); enable `pg_net` (free) in
R3; email provider account + verified sending domain + API key as an Edge Function secret (R3); app base URL
for links; Vercel deploy of the frontend only when you authorize production.

---

## 8. Decisions (answered 2026-10-26)

- Reviewer: a separate test account for now (email to be confirmed); Bernard's inactive profile is left untouched.
- Departments: the suggested six.
- Schedule: 14-day periods from Mon Nov 2 2026, due the Monday after each period at 5:00 PM America/New_York, no grace.
- One report per department.
- Defaults taken without a separate answer: everyone assigned to a covered department reports; email waits for R3.
- Navigation as built: My Reports shows for every staff role (the page says when someone has no department), not only
  for assigned staff.

### Original questions

1. **Bernard's account** — confirm the inactive "Bernard Georges" profile (by email) is his, and that I may
   reactivate it and grant `reviewer`. Any other reviewers (e.g., a deputy)?
2. **Departments** — the list (suggested: Adult Education/ESL, Case Management, Workforce Development, SNAP
   Outreach, Food Distribution, Administration) and who belongs to which.
3. **Who must report** — all active staff, or only staff in covered departments? Should Bernard himself be
   exempt?
4. **Schedule** — first period start date (suggest Mon Oct 19 2026 or Mon Nov 2 2026), deadline (suggest the
   Monday after the period ends, 5:00 PM ET), grace period (suggest 0).
5. **One report per department, or one combined report** for staff in multiple departments.
6. **Email provider (R3)** — Resend (free tier 3,000/month, needs a verified domain such as nb4hs.org) is my
   recommendation; or defer email and run in-app only for now.
