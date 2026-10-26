# SNAP Outreach Module — Audit, Architecture & Staged Plan

Status: **proposal, awaiting approval. Nothing below has been implemented.**
Audited 2026-10-26 against `main` + branch `Djenins/redesign-add-household-form`
and the live Supabase project `vkbzarlkqzvhsfdmxyyq` (read-only queries only).

---

## 1. What currently exists

| Area | Finding |
|---|---|
| Framework | Vite 5 + React 18 SPA, react-router 6, plain JS/JSX (no TypeScript). Single `AppContext` holds global state. |
| Hosting | Vercel (`nb4hs-app`), static SPA rewrite only. **No server runtime** — no API routes, no Supabase Edge Functions. |
| Database | Supabase Postgres. 32 public tables, all with RLS on. 33 migrations applied **directly to the project; none are in the repo** (no `supabase/` folder). Extensions: pgcrypto, uuid-ossp, vault. **No pg_cron / pg_net.** |
| Data access | Browser → PostgREST with the anon key. RLS + a few `SECURITY DEFINER` RPCs are the *only* server-side authorization. Convention: `lib/*Data.js` maps snake_case rows ↔ camelCase app shapes. |
| Auth | Supabase Auth email/password; `profiles(id, name, email, role, active)` populated by `handle_new_user` trigger. Password reset wired. |
| Roles | `profiles.role` ∈ administrator, staff, receptionist, case_manager, job_developer (CHECK constraint). SQL helpers `has_role(text[])`, `is_admin()`. Client side: `navItemsForRole()` + `<RequireRoute>`. Module-level opt-in pattern: `workforce_role_access` (admin toggles which roles see Workforce). |
| Participant identity | **`clients` master record** (`nb_id` NB-00001…) + per-program tables (`case_clients`, `job_clients`, `food_clients`, `students`) linked by `client_id`. Created through `create_*_client(master, program, matched_client_id)` RPCs. `findPossibleDuplicates()` + `DuplicateClientWarning` — suggests matches, **never auto-merges**. |
| Case management | `case_clients` + `case_client_notes` (case_manager/admin only). `client_notes` with private/department/all visibility. `communications` log (method, direction, summary, follow_up_required). `client_documents` + Storage. |
| Referrals | `referrals` is **workforce-specific** (job_client → job_opening → employer, all NOT NULL). Not reusable for partner/DHS referrals. |
| Appointments | `appointments` (client_id, date/time, reason, assigned_email, status requested/scheduled/completed/cancelled, recurrence series, public request form + lookup RPC). `meeting_with` CHECK limited to case_manager/job_developer. |
| Calendar / events | `calendar_events` is a staff availability calendar (type visit/appointment). No community-event concept anywhere. |
| Notifications | `notifications` per-user in-app feed (bell), inserted by DB trigger on appointment assignment, realtime. **No email or SMS anywhere.** |
| Reporting | Computed client-side from globally loaded arrays; CSV / Excel / PDF exports client-side. `grants` + polymorphic `service_grant_tags(record_table, record_id)` for funder attribution — reusable as-is. |
| Audit log | **None.** |
| i18n | `lib/i18n.js` STR table: en / ht / fr. (`custom_options` also has `es`.) |
| Design system | Tailwind 3 tokens (`tailwind.config.js` + `styles/main.css`, light/dark), Radix/shadcn-style `ui/` primitives, Shell sidebar with `NAV_SECTION` taxonomy, `ModuleNav` secondary nav, `StatCard`, `DashChart`, `SectionCard`, `SearchFilterPanel`, `ResultsToolbar`, `EmptyState`, `FormField`, `ConfirmModal`, `Toast`, `Pagination`, `Badge`. |
| Tests | Vitest + Testing Library; 179 tests pass (pure lib helpers + Shell/AppointmentLookup). |

## 2. Unfinished work, limitations, and pre-existing risks

These exist **today**, independent of SNAP. Some block putting SNAP data in this database.

| Sev. | Issue | Why it matters for SNAP |
|---|---|---|
| **Critical** | `handle_new_user` takes `role` from user-supplied signup metadata, and `Users.jsx` creates staff via public `auth.signUp`. If "Allow new users to sign up" is on in Supabase Auth, anyone holding the (public) anon key can create an **administrator** account. *Needs a 1-minute check of the Auth setting.* | Any RLS we write is bypassable by a self-made admin. |
| **High** | `visits` SELECT is granted to `public` (anon): every visitor's name/phone/email/address is readable without signing in. `students` likewise readable by anon. | Same pattern must not be repeated; shows the kiosk's anon session needs a narrower API. |
| High | `clients` SELECT/UPDATE `true` for every authenticated role, incl. receptionist. | SNAP contacts would live in `clients`; acceptable for name/contact only if SNAP-specific data lives in separately-protected tables (this plan does that). |
| Medium | `grants`, `service_grant_tags`, `custom_options`, `students`, `classes` writable by any authenticated user. `staff_directory` is a SECURITY DEFINER view (advisor ERROR). anon can EXECUTE several SECURITY DEFINER functions. Leaked-password protection off. | General hardening. |
| Medium | Schema not version-controlled — migrations exist only in the Supabase project history. | We can't review/reproduce SNAP migrations safely without a repo baseline. |
| Medium | Global "fetch whole table on mount + realtime" in `AppContext`. | Won't scale and over-shares; SNAP should fetch per page and aggregate server-side. |
| Low | `case_clients.immigration_status` exists. | SNAP must never read or require it. |
| Info | No scheduler, no email/SMS, no audit log, no server code. | Automation and comms need a deliberate (free) choice — see §7. |

## 3. How SNAP should integrate (reuse vs. build)

**Reuse as-is:** Supabase Auth + `profiles`; `clients` master identity + NB ID; duplicate matcher + `DuplicateClientWarning`; `create_*_client` RPC pattern; `notifications` + bell; `grants`/`service_grant_tags`; Shell, `ModuleNav`, all UI primitives and tokens; i18n; CSV/Excel/PDF export helpers; Vitest setup.

**Extend (additive, non-destructive):**
- `appointments` — add nullable `program`, `assistance_case_id`; widen `meeting_with` CHECK to include `outreach_worker`.
- `notifications` — add nullable `task_id`, new `type` values.
- Calendar page — read `outreach_events` as an extra read-only source (no duplicate rows in `calendar_events`).
- `ClientProfile` — add a read-only "SNAP Outreach" tab for authorized users.
- Settings — module access toggle, same idiom as Workforce.

**Build new:** program-scoped staff roles, outreach contacts (program layer on `clients`), consent records, interactions log, assistance cases + configurable stages + notes + stage history, community partners, outreach referrals, outreach events + attendance, generic tasks, message templates + outbound message log, audit events, reporting RPCs.

**Generalization rule:** every new table carries `program text` (value `'snap'` now). A future program (e.g. Medicaid, LIHEAP outreach) is new rows in `program_case_stages` + a nav entry, not new tables.

## 4. Recommended database architecture

All new tables: `uuid` PK (`gen_random_uuid()`), `created_at`/`updated_at timestamptz`, `created_by → profiles.id`, FKs with explicit `ON DELETE`, indexes on every FK + `(program, status)` / `(assigned_to, due_date)` hot paths, RLS on, audit trigger attached.

```
program_staff            (user_id→profiles, program, program_role: worker|supervisor|program_admin, active)  PK(user_id, program)
                          + has_program_role(program, roles[]) SECURITY DEFINER helper

outreach_contacts        (program, client_id→clients UNIQUE per program, preferred_language, preferred_contact_method,
                          outreach_source, source_event_id→outreach_events, assigned_to→profiles, status, follow_up_status)
contact_consents         (client_id→clients, channel email|sms|phone|mail, purpose, status granted|revoked, language,
                          captured_by, captured_at, method, revoked_at)          -- append-only; latest row wins
outreach_interactions    (program, client_id?, assistance_case_id?, event_id?, partner_id?, staff_id, type, channel,
                          direction, occurred_at, summary, outcome)              -- the activity log; counts "interactions"

program_case_stages      (program, key, label_en/ht/fr, sort_order, is_terminal, requires_review, active)  -- seeded with the 10 stages
assistance_cases         (program, case_number 'SNAP-2026-00001', client_id→clients, outreach_contact_id, assigned_to,
                          opened_at, stage_key, assistance_requested text[], assistance_provided text[],
                          application_assisted_at, follow_up_date, closure_reason, closed_at,
                          supervisor_review_status, reviewed_by, reviewed_at,
                          reported_outcome, reported_outcome_source, reported_outcome_at)  -- see "outcomes" below
assistance_case_notes    (assistance_case_id, content, created_by)               -- tightest RLS in the module
case_stage_history       (assistance_case_id, from_stage, to_stage, changed_by, changed_at)

community_partners       (name, category, contact_name, phone, email, address, city, zip, referral_instructions,
                          status, notes, programs text[])
outreach_referrals       (program, client_id, assistance_case_id?, partner_id?, referral_type (e.g. ri_dhs, food_pantry),
                          referred_at, status made|received|completed|unable, completed_at, notes)

outreach_events          (program, title, type, starts_at, ends_at, location, status planned|completed|cancelled,
                          anonymous_headcount, outcome_notes)
outreach_event_partners  (event_id, partner_id)      outreach_event_staff (event_id, user_id)
outreach_event_attendance(event_id, client_id, follow_up_consent)  UNIQUE(event_id, client_id)

tasks                    (program, title, description, assigned_to, priority, due_date, status, completed_at,
                          completion_notes, client_id?, assistance_case_id?, event_id?,
                          source manual|automation, automation_key UNIQUE)       -- idempotent automation

message_templates        (program, key, channel, language, body, approved_by, approved_at, active)
outbound_messages        (client_id, channel, template_id, language, status queued|sent|failed|blocked_no_consent,
                          provider, provider_message_id, queued_by, sent_at)     -- body never contains case detail

audit_events             (id bigserial, occurred_at, actor_id, action, table_name, record_id, program,
                          changed_fields text[])                                 -- field *names*, not values
```

**Deliberately not stored:** SSN, EBT card numbers/PINs, ConnectRI/DHS passwords, immigration status, income documents. Free-text fields carry a UI hint not to enter them.

**Outcomes:** NB4HS records what it *did* (`application_assisted_at`, referrals made). A DHS result is only stored as `reported_outcome` with a mandatory `reported_outcome_source` (`participant_reported` | `dhs_notice_viewed`) and is labelled that way everywhere. No eligibility logic, no "approved/denied/enrolled" status.

**Counting rules (for reports):** *contacts* = distinct `client_id` in `outreach_contacts`; *interactions* = rows in `outreach_interactions`; *individuals reached* = distinct `client_id` across contacts + interactions + attendance in range, plus event `anonymous_headcount` reported separately; *applications assisted* = cases with `application_assisted_at` in range; *verified outcomes* = only `reported_outcome_source = 'dhs_notice_viewed'`.

**Server-side aggregation:** `snap_dashboard_metrics(from, to)` and `snap_report(from, to, staff_id?)` as `SECURITY INVOKER` SQL functions so RLS still applies; PII-bearing exports go through an RPC that also writes an `audit_events` row.

## 5. Navigation and screens

Sidebar → **Programs** section → new entry **SNAP Outreach** (`/snap`), visible per `program_staff` membership (plus the admin toggle in Settings). Inside, a `ModuleNav` strip identical to Workforce:

`Dashboard · Contacts · Cases · Partners · Events · Appointments · Tasks · Reports · Settings`

Detail routes: `/snap/contacts/:id`, `/snap/cases/:id`, `/snap/partners/:id`, `/snap/events/:id`.

**Dashboard layout** (existing `StatCard` / `DashChart` / `SectionCard`):

```
[ Quick actions: + Contact  + Case  Log activity  Schedule  + Follow-up  Record referral ]
[ KPI row: Individuals contacted · New contacts · Cases opened · Applications assisted ·
           Referrals completed · Follow-ups due · Overdue tasks · Events completed ]   ← date-range chip
[ Activity over time (line) ]                 [ Contacts by channel (bar) ]
[ Cases by stage (bar) ] [ Referrals by partner (bar) ] [ Follow-up completion (gauge) ]
[ Today's appointments ] [ My follow-ups ] [ Cases needing attention ]
[ Recent activity ]      [ Upcoming events ]
```

Every number comes from `snap_dashboard_metrics`; empty states explain how to create the first record. Workers see their scope, supervisors their program.

## 6. Permission matrix (proposed)

| Capability | Outreach worker | Supervisor | Program admin | System admin (no program role) | Other staff |
|---|---|---|---|---|---|
| View SNAP module | ✓ | ✓ | ✓ | settings only | ✗ |
| Search/create outreach contacts | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit contact | assigned | all | all | ✗ | ✗ |
| View/edit cases | assigned | all | all | ✗ | ✗ |
| Read case notes | assigned cases | all | all | **✗** | ✗ |
| Close case / supervisor review | request | ✓ | ✓ | ✗ | ✗ |
| Partners, events | read + log | ✓ | ✓ | ✗ | ✗ |
| Tasks | own | team | all | ✗ | ✗ |
| Aggregate reports | own activity | ✓ | ✓ | ✓ (aggregate only) | ✗ |
| PII export | ✗ | ✓ (audited) | ✓ (audited) | ✗ | ✗ |
| Configure stages/templates | ✗ | ✗ | ✓ | ✗ | ✗ |
| Grant program roles | ✗ | ✗ | ✓ | ✓ | ✗ |
| Read audit log | ✗ | ✗ | ✓ | ✓ | ✗ |

Enforced in RLS via `has_program_role('snap', …)`; the UI mirrors it but is never the control.

## 7. Automation architecture

| Rule | Mechanism | Idempotency |
|---|---|---|
| New case → initial follow-up task | AFTER INSERT trigger on `assistance_cases` | `automation_key = 'case_opened:<id>'` UNIQUE |
| Due-date reminder | Scheduled job → `notifications` | `'task_due:<task_id>:<date>'` |
| Overdue on dashboard | Query (`due_date < today AND status open`) — no job needed | n/a |
| Appointment completed → prompt outcome | UI prompt on status change + notification row | `'appt_outcome:<id>'` |
| Attendance → follow-up | Trigger, only when `follow_up_consent` | `'event_followup:<event>:<client>'` |
| Case closure requires documentation | BEFORE UPDATE trigger rejects terminal stage without `closure_reason` (+ review if stage requires it) | n/a |

All automation rows have `source='automation'` and land in `audit_events`. Scheduler: **pg_cron** (free Supabase extension) — needs your OK to enable. Email/SMS: `outbound_messages` queue + a provider interface; Stage 4 ships with a "log only / staff sends manually" provider. A real provider (Edge Function + Resend/Twilio etc.) is a later, separately approved, possibly paid step. Sends are blocked unless the latest `contact_consents` row for that channel is `granted`; STOP/opt-out writes a `revoked` row.

## 8. Infrastructure impact

- No new paid services required for Stages 1–4. pg_cron is included in Supabase.
- Database growth is small (tens of thousands of rows/year).
- Vercel: unchanged.
- Optional later costs: SMS/email provider; Supabase branching (≈ hourly billing) if you want a preview database.

## 9. Security & privacy checklist (before production)

- [ ] Fix signup role escalation; staff created only by admins.
- [ ] Remove anon SELECT on `visits`/`students`; give the kiosk narrow RPCs.
- [ ] Baseline current schema into `supabase/migrations/` in the repo.
- [ ] RLS on every SNAP table, tested per role (automated SQL tests).
- [ ] Case notes excluded from admin-by-default; access logged.
- [ ] Audit trigger on all SNAP tables; exports audited.
- [ ] No SSN / PIN / passwords / immigration status fields; UI warnings on free text.
- [ ] Consent required before any outbound message; no case detail in messages.
- [ ] Retention policy approved (e.g. closed cases purged/anonymized after N years) and implemented as a reviewed job.
- [ ] Management sign-off on data sharing with partners / RI DHS.
- [ ] Leaked-password protection on; session timeout policy decided.

## 10. Staged implementation plan (one reviewed PR each)

| Stage | Contents | DB changes |
|---|---|---|
| **0 — Prereqs** | Schema baseline into repo; security fixes from §2 (separate PR, your approval first) | Policy/function changes only |
| **1 — Foundation** | `program_staff` + helpers, `audit_events` + trigger, nav entry, `/snap` shell with ModuleNav and empty states, Settings access card | 2 tables, 3 functions |
| **2 — Core MVP** | Contacts (search-first, dedupe, link to `clients`), consents, interactions, cases + stages + notes + history, tasks + case-opened trigger, dashboard (real RPC) | ~9 tables, additive |
| **3 — Community ops** | Partners, referrals, events + attendance, appointments extension, calendar overlay, ClientProfile tab | ~6 tables, 2 additive ALTERs |
| **4 — Automation & reporting** | pg_cron reminders, templates + outbound log (log-only provider), reports + CSV with metric definitions, audited PII export | 2 tables, cron jobs |
| **5 — Launch readiness** | RLS role tests, component tests, a11y + responsive pass, migration dry-run, docs, deployment checklist | — |

Each stage report will list: files changed, DB changes, features completed, tests run, known limitations, decisions needed, next steps.

## 11. Decisions needed

See the summary in chat / PR description; recorded here once answered.

---

## Stage 0 report — baseline + security hardening

Branch `Djenins/snap-stage0-baseline-and-security` (from `main` @ 87aa962).

**Files changed**
- `supabase/migrations/2026071…–20260902…` (33 files) — the already-applied migrations, recovered verbatim from `supabase_migrations.schema_migrations`. Documentation of what's live; do not re-run.
- `supabase/migrations/20261026061431_stage0a_kiosk_rpcs_and_signup.sql` — **applied 2026-10-26**; additive: `is_staff()`, kiosk RPCs (`kiosk_visits`, `kiosk_roster`, `public_visit_count`, `kiosk_create_visit`, `kiosk_student_check_in`), new signups start inactive, advisor revokes.
- `supabase/migrations/20261026120100_stage0b_tighten_policies.sql` — `true` policies → `is_staff()`; anon loses SELECT/INSERT on `visits` and SELECT on `students`; grants writable only by Manage-page roles.
- `src/lib/checkinData.js` — `createVisit` via RPC; new `checkInStudentVisit`, `fetchKioskVisits`, `fetchKioskRoster`, `fetchVisitCount`.
- `src/context/AppContext.jsx` — signed-out kiosk loads RPC views and polls every 30 s; staff path unchanged; `data.visitsOnFile`.
- `src/pages/CheckInStudent.jsx` — tap-in calls `checkInStudentVisit` (contact details copied server-side).
- `src/pages/Login.jsx` — landing count uses `visitsOnFile`.
- `src/pages/Users.jsx`, `src/lib/i18n.js` — new accounts must be activated; message updated (en/ht/fr — ht/fr wording needs a native-speaker check).
- `src/lib/checkinData.test.js` — 5 tests pinning the kiosk to the RPCs.

- `src/components/Shell.jsx` + `Shell.test.jsx` — pre-existing crash fix (from c9a7aeb): `useIsMobile()` ran after the `authLoading` early return, so any full page load straight onto a Shell route (e.g. `/?kiosk=1`, or reloading `/dashboard`) threw "Rendered more hooks than during the previous render" and blanked the app. Hook moved above the returns; regression test fails without the fix.

**Rollout (each step safe alone):** ~~apply 0a~~ (done 2026-10-26, version 20261026061431) → deploy this branch → smoke-test kiosk check-in/out + staff login → apply 0b → re-run Supabase security advisor.

**Verified after applying 0a:** grants (anon can call only the five kiosk RPCs; `is_staff`, `create_student`, trigger functions not anon-callable); RPC results match tables (roster 10 = 10 active enrolled students, visit count 14). In the browser, signed out: landing stats 4 / 10 / 14; kiosk landing, student roster (names only) and check-out (empty — 0 open visits) render; the page's only Supabase calls were `rpc/kiosk_visits`, `rpc/kiosk_roster`, `rpc/public_visit_count` and `classes`. **Not exercised:** visitor check-in, student tap-in, check-out — each writes real visit records on the live project.

**Tests executed:** `vitest` 184/184 pass; `vite build` passes. **Not yet executed:** the SQL has not run against any database (no Docker for a local stack, and the live project hasn't been touched); kiosk flows not exercised in a browser because they need 0a applied first.

**Known limitations / residual risk**
- The kiosk still shows, to anyone, the first+last names of people currently checked in (by design: tap your name to check out). No contact details.
- `appointments` INSERT remains open to anon (public request form); `check_out_visit` remains anon-callable; `staff_directory` view (names/emails/roles of staff, used by the public request form) unchanged.
- `clients` remain readable by every *active* staff role, incl. receptionist — a product decision, not changed here.
- Adding a user still swaps the admin's browser session (pre-existing; fixing needs a server-side admin function).
- Leaked-password protection is a dashboard toggle (Auth → Passwords) — not something a migration can set.

---

## Decisions recorded

| # | Question | Decision (2026-10-26) |
|---|---|---|
| 1 | Where SNAP schema changes go | Live project, additive only, applied after each PR is reviewed |
| 3 | Role model | Separate program-scoped roles (`program_staff`), on top of `profiles.role` |
| 4 | Admins and case notes | Administrators manage SNAP staff/settings but read participant data only if they also hold a SNAP role |
| 5–10 | Contacts, worker visibility, pg_cron, messaging, funder/retention, languages | Open — needed before Stage 2 |

## Stage 1 report — roles, audit log, navigation

Branch `Djenins/snap-stage1-foundation`.

**Database** — `supabase/migrations/20261026064304_stage1_program_staff_and_audit.sql` (**applied 2026-10-26** after PR #24 review; additive only):
- `program_staff (user_id, program, program_role, active, granted_by, …)`, PK `(user_id, program)`; `program` CHECK `('snap')`, `program_role` CHECK `('worker','supervisor','program_admin')`.
- `has_program_role(program, roles[])` — active profile + active membership; **no admin bypass**. `can_manage_program(program)` — admin or that program's program admin.
- RLS: own row (if active staff), supervisors/program admins see the team; only `can_manage_program` writes. Revoking deactivates instead of deleting.
- `audit_events` (append-only, field *names* only, readable by admins and the program's admins) + generic `audit_row_change()` trigger, attached to `program_staff`; no-op updates aren't logged. `set_updated_at()` helper.

**App**
- `src/lib/programStaff.js` — data access + `snapSectionsFor()` / `canManageProgram()` (mirror the RLS rules).
- `AppContext` loads the signed-in user's own program roles (`data.programRoles`) and exposes `refetchProgramRoles`.
- Sidebar: **SNAP Outreach** under Programs for administrators and SNAP role holders (`nav.js`, `constants.js`, `navIcons.js`); `/snap` behind `RequireRoute`.
- `pages/SnapOutreach.jsx` with `ModuleNav`: **Overview** (members; honest "being set up" state + scope note that DHS decides eligibility) and **Staff & Access** (admins/program admins; assign/revoke SNAP roles on active staff). Sections are added only once they work.
- i18n en/ht/fr for the module (ht/fr need a native-speaker check).

**Tests executed**
- Migration run on a throwaway local Postgres 17 against a stub of the live auth/profile helpers: 21 role checks pass (worker/supervisor/admin/program admin/inactive/anon visibility; who can grant; CHECK constraints; audit rows, actor, changed fields, no-op skip; audit not writable directly).
- `vitest` 198/198 (new: access rules + nav entry, SnapOutreach component tests for worker/admin/no-access/role write/load error). `vite build` passes.
- Browser (signed out): kiosk unaffected; `/snap` redirects to the landing page. Signed-in staff screens not exercised in a browser (no staff credentials) — covered by component tests.

**Rollout:** migration applied 2026-10-26 (version 20261026064304). Remaining: merge and deploy PR #24, then an administrator assigns the first SNAP program admin in SNAP Outreach → Staff & Access.

**Verified on the live project after applying:** both tables have RLS on with the five expected policies and two triggers; `has_program_role`/`can_manage_program` callable by signed-in users only, trigger functions by no one. Role checks with real accounts inside a rolled-back transaction (10/10): administrator has no SNAP role but can manage; granting and changing a role writes two audit rows attributed to the administrator; a case manager made supervisor has that role, can't manage, can't grant, reads no audit rows; staff without a role and anonymous callers see no memberships. Afterwards `program_staff` and `audit_events` were both empty. Security advisor: no new anon findings and no tables without RLS; new entries are only the two role-check helpers being callable by signed-in users, the same as `has_role`/`is_admin`, because RLS evaluates them as the caller.

**Known limitations:** no live updates of `program_staff` across tabs (the settings table reloads after each change); supervisors see who's on the team but can't change it; audit log has no UI yet (Stage 5).
