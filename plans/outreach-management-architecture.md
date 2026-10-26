# Outreach Management Module — Architecture Proposal (SNAP as first program)

Status: **approved 2026-10-26** (D1–D6 as recommended). O1 merged (PR #27) and its migration applied 2026-10-26.
Supersedes the module framing in `snap-outreach-architecture.md` (§3, §5, §10); that file's
decisions, security work and Stage 0–2b reports still stand.

---

## 1. What already exists (inspected 2026-10-26)

SNAP Stages 0–2b are merged (PRs #22, #24, #25, #26) and their migrations applied to the live
project. Most of the multi-worker foundation is already in place:

| Already built | Where |
|---|---|
| One participant identity: `clients` (NB ID), program layers link by `client_id`; duplicate matcher | phase2 migration, `masterClients.js`, `DuplicateClientWarning` |
| Staff accounts and auth: Supabase Auth + `profiles.role` | unchanged |
| Program-scoped roles on top of system roles: `program_staff (user_id, program, program_role)` with `has_program_role()`, `can_manage_program()`, `is_program_lead()` | stage1 |
| Audit log `audit_events` + generic trigger | stage1 |
| `outreach_contacts` (program layer on `clients`, assigned worker), `contact_consents`, `outreach_interactions` | stage2a |
| `program_case_stages` (configurable stages), `assistance_cases`, notes, stage history, closure/review rules | stage2b |
| `tasks` (follow-ups, automation key), pg_cron reminders → `notifications` | stage2b |
| `snap_dashboard(from, to)` aggregate RPC (RLS-scoped) | stage2b |
| `/snap` page with ModuleNav: Dashboard · Contacts · Cases · Follow-ups · Staff & Access | `SnapOutreach.jsx`, `components/snap/*` |

**What does not fit the new requirements:**

1. Every table has `program text check (program in ('snap'))` — adding a program means altering
   every table. There is no `programs` registry.
2. The UI is a "SNAP Outreach" module (`/snap`, sidebar label, `snap*` component and function names)
   rather than Outreach Management with SNAP inside it.
3. SNAP specifics are hardcoded in CHECK constraints: assistance types
   (`application_help`, `ebt_card_help`, …), closure reasons, the "referred to RI DHS" milestone.
4. No way to share an individual record with a worker who isn't the assignee (req. 6).
5. No personal "My work" vs supervisor "Team" split; the dashboard is a program KPI page.
6. Not yet built: partners, referrals, appointments, events, program reports.
7. Existing `referrals` table is workforce-only (job_client → job_opening → employer, all NOT NULL) —
   not reusable. Existing `appointments` is generic and reusable. Existing `calendar_events` is staff
   availability, not community events.

**Live data:** all SNAP tables are empty except one `program_staff` row. Reshaping now costs
nothing in data migration; it gets more expensive after go-live.

## 2. Guiding decisions

- **Extend, don't rebuild.** Keep every existing table name (they are already generic:
  `outreach_contacts`, `assistance_cases`, `tasks`, `program_staff`). Change the module's frame,
  not its foundations.
- **One person = one `clients` row.** Program participation is a row in a program layer table,
  never a second person record.
- **One staff account.** Program roles are grants on `profiles`, never separate logins.
- **Program is data, not code.** A new outreach program = rows in `programs` and its config tables
  + (optionally) program-specific screens. No new tables, no CHECK edits.
- **RLS is the control; the UI mirrors it.**
- **No eligibility decisions.** NB4HS records what it did (assisted, referred); a DHS result is at
  most a labelled, participant-reported note (open decision, unchanged).

## 3. Data model

### 3.1 Program registry and configuration (new)

```
programs                (key PK 'snap', module 'outreach', name_en/ht/fr, active,
                         features text[]  -- which workflows this program uses:
                                          -- contacts, cases, referrals, appointments, events
                         case_number_prefix 'SNAP', created_at, updated_at)

program_option_sets     (program → programs, set_key, key, label_en/ht/fr, sort_order, active,
                         PK(program, set_key, key))
                         set_key ∈ assistance_type | closure_reason | referral_type |
                                   interaction_outcome | event_type | appointment_reason
                         -- SNAP rows seeded from today's CHECK lists

program_case_stages     (exists) + optional milestone_key ('application_assisted', 'referred_external')
                         so milestones are configured on the stage, not hardcoded in the trigger
```

`program` columns on every outreach table become `references programs(key)` instead of
`check (program in ('snap'))`. Hardcoded value lists become a validation trigger against
`program_option_sets` (or FK where the column is scalar).

### 3.2 Staff, roles and access

```
program_staff           (exists) role ∈ worker | supervisor | program_admin | viewer (new)
                         viewer = aggregate reports only, no participant data
                         (e.g. Executive Director, grants/finance staff)

record_shares (new)     (id, program, record_type 'contact'|'case', record_id,
                         user_id → profiles, access 'read'|'edit', reason,
                         granted_by, granted_at, expires_at, revoked_at)
                         -- explicit sharing for coverage, co-working, handoffs
```

`can_access_record(type, id, mode)` SECURITY DEFINER helper used in RLS:
assignee, OR active share, OR program lead. Every grant/revoke is audited.

### 3.3 Participants and outreach work (existing, small changes)

| Table | Change |
|---|---|
| `outreach_contacts` | FK to `programs`; read rule per decision D2 below |
| `contact_consents` | unchanged (person-level, already program-agnostic); RLS widened from `'snap'` to "any outreach program role" |
| `outreach_interactions` | FK to `programs`; add `event_id`, `referral_id`, `appointment_id` (nullable) so "My outreach activities" is one list |
| `assistance_cases` | FK to `programs`; assistance types validated against option sets; `case_number` uses `programs.case_number_prefix`; RLS uses `can_access_record` |
| `assistance_case_notes`, `case_stage_history` | follow case access (now incl. shares) |
| `tasks` | FK to `programs`; add `appointment_id`, `referral_id`, `event_id` links |

### 3.4 New outreach workflows

```
community_partners      (id, name, category, contact_name, phone, email, address, city, zip,
                         referral_instructions, status active|inactive, notes)
partner_programs        (partner_id, program)        -- one partner, many programs; NB4HS-wide directory

outreach_referrals      (id, program, client_id → clients, case_id?, partner_id?, referral_type
                         (option set: e.g. ri_dhs, food_pantry, wic, legal_aid),
                         referred_by, referred_at, status made|received|completed|unable_to_complete,
                         status_at, notes ≤1000)

appointments            (EXISTING table, additive columns)
                         + program → programs (nullable; null = existing non-program appts)
                         + case_id → assistance_cases, + assigned_to → profiles
                         + meeting_with CHECK widened with 'outreach_worker'
                         + location / mode (in_person|phone|video)

outreach_events         (id, program, title, event_type (option set), starts_at, ends_at, location,
                         status planned|completed|cancelled, anonymous_headcount, outcome_notes,
                         lead_staff_id)
outreach_event_staff    (event_id, user_id)
outreach_event_partners (event_id, partner_id)
outreach_event_attendance (event_id, client_id, follow_up_consent, UNIQUE(event_id, client_id))
```

Automation (same idempotent `automation_key` pattern as today): attendance with follow-up consent →
follow-up task; appointment marked completed → "record outcome" task; referral with no status
change after N days (configurable per program) → follow-up task.

### 3.5 Reporting (server-side, RLS-scoped)

```
outreach_dashboard(program, from, to, scope 'me'|'team')   -- replaces snap_dashboard (kept as wrapper)
outreach_my_work(program)                                   -- the personal dashboard lists
outreach_team_workload(program, from, to)                   -- per-worker counts, leads only
outreach_report(program, from, to, staff_id?)               -- program report + metric definitions
outreach_export(program, from, to)                          -- PII export, leads only, writes audit row
```

Counting rules carry over from the SNAP plan §4 (contacts, interactions, individuals reached,
applications assisted, referrals completed, verified-vs-reported outcomes).

### 3.6 Not stored (unchanged)

SSN, EBT card numbers/PINs, ConnectRI/DHS passwords, immigration status, income documents.

## 4. Navigation

**Sidebar** (Programs section): **Outreach** (`/outreach`) replaces "SNAP Outreach". Visible to anyone
with any outreach program role, and to administrators (settings only). `/snap/*` redirects.

**Inside the module:** a program switcher in the header (shows only programs the person belongs to;
hidden when there is just one — today, SNAP). Routes are `/outreach/:program/...`.

```
Outreach · [SNAP ▾]
  My Work        personal dashboard (default for workers)
  Team           supervisor dashboard (leads only)
  Contacts       /outreach/snap/contacts, /contacts/:id
  Cases          /outreach/snap/cases, /cases/:id                (feature: cases)
  Follow-ups     /outreach/snap/tasks
  Appointments   /outreach/snap/appointments                     (feature: appointments)
  Referrals      /outreach/snap/referrals                        (feature: referrals)
  Events         /outreach/snap/events, /events/:id              (feature: events)
  Partners       /outreach/partners, /partners/:id               (NB4HS-wide, filtered by program)
  Reports        /outreach/snap/reports                          (leads, viewers; workers see own)
  Settings       /outreach/snap/settings                         (program admins, system admins)
                 → Staff & access · Stages · Option lists · Program features
```

Sections appear only if the program has the feature on and the person's role allows it
(`outreachSectionsFor(systemRole, programRole, programFeatures)` replacing `snapSectionsFor`).

**Integrations with existing screens (additive):**
- **Client profile** (`/clients/:nbId`): an "Outreach" tab listing that person's program contacts,
  cases, referrals and appointments the viewer is allowed to see.
- **Calendar**: outreach appointments already appear (same table); outreach events added as a
  read-only overlay.
- **Notification bell**: reminders for tasks, assignments, shares and review requests.

### Dashboards

**My Work** (every outreach worker, scoped to `assigned_to = me` + shared with me):

```
[ Quick actions: + Contact · Log activity · + Case · Schedule · + Referral · + Follow-up ]
[ My contacts ] [ Active cases ] [ Follow-ups due (overdue) ] [ Appointments this week ]
[ My follow-ups due — list ]              [ My upcoming appointments — list ]
[ My active cases — stage, next step ]    [ My recent referrals — status ]
[ My outreach activity — last 30 days chart + recent entries ]
[ Shared with me ]
```

**Team** (supervisors / program admins):

```
[ KPI row: program-wide period metrics (today's dashboard numbers) ]
[ Workload table: worker · contacts · open cases · overdue follow-ups · appts this week ·
                  activities last 7d · referrals open ]   → click to filter any list by worker
[ Unassigned queue: contacts/cases without a worker → assign ]
[ Awaiting review: cases with supervisor review requested ]
[ Overdue follow-ups across the team ]   [ Upcoming events + staffing ]
```

Reassignment: single-record (exists) plus bulk reassign from the workload table (e.g. a worker
leaves → move all their open work), audited.

## 5. Role permissions

Program roles are per program; system role (`profiles.role`) is unchanged and independent.

| Capability | Worker | Supervisor | Program admin | Viewer (new) | System admin w/o program role | Other staff |
|---|---|---|---|---|---|---|
| See Outreach module | ✓ | ✓ | ✓ | Reports only | Settings only | ✗ |
| Search / add contacts | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Read contacts | see **D2** | all | all | ✗ | ✗ | ✗ |
| Edit contact | assigned / shared-edit | all | all | ✗ | ✗ | ✗ |
| Cases, notes, history | assigned / shared | all | all | ✗ | ✗ | ✗ |
| Close case / approve review | request | ✓ | ✓ | ✗ | ✗ | ✗ |
| Assign / reassign / bulk reassign | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Share a record | own records | any | any | ✗ | ✗ | ✗ |
| Follow-ups | own + created | team | team | ✗ | ✗ | ✗ |
| Appointments | own + shared cases | team | team | ✗ | ✗ | via existing Calendar (time/name only) |
| Referrals | own + shared | team | team | ✗ | ✗ | ✗ |
| Events | read all, log attendance on staffed events | manage | manage | ✗ | ✗ | ✗ |
| Partners directory | read | edit | edit | ✗ | ✗ | ✗ |
| Team dashboard | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Reports (aggregate) | own activity | program | program | program | program | ✗ |
| PII export (audited) | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Configure stages, option lists, features | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| Grant program roles | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |
| Audit log | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ |

## 6. Implementation phases (one reviewed PR each; live migrations additive and applied after review)

| Phase | Contents | DB | Preserves |
|---|---|---|---|
| **O1 — Reframe as Outreach Management** | `programs` registry (seed SNAP), `program_option_sets` (seed SNAP lists), `program` CHECKs → FKs, hardcoded lists → option-set validation, stage-configured milestones, `outreach_dashboard` with `snap_dashboard` wrapper. UI: sidebar "Outreach", `/outreach/:program/*` routes, `/snap` redirect, program switcher, `outreachSectionsFor`. Rename `components/snap` → `components/outreach` where generic. No new features. | 2 tables, constraint swaps, functions | All Stage 1–2b behaviour, tests re-pointed |
| **O2 — Multi-worker: My Work, Team, sharing** | `record_shares` + `can_access_record`, RLS updates; `viewer` role; My Work dashboard; Team dashboard (workload, unassigned queue, review queue, bulk reassign); share/unshare UI; assignment notifications | 1 table, policy updates | |
| **O3 — Partners & referrals** | `community_partners`, `partner_programs`, `outreach_referrals`, stalled-referral automation, Referrals section, Partners directory, referrals on case + My Work | 3 tables | Workforce `referrals` untouched |
| **O4 — Appointments & events** | Additive columns on `appointments`; outreach appointments section; `outreach_events` + staff/partners/attendance; attendance → follow-up automation; calendar overlay; Client profile "Outreach" tab | 4 tables, 1 additive ALTER | Existing appointment request form, lookup, calendar |
| **O5 — Reporting & settings** | `outreach_report`, CSV/Excel/PDF with metric definitions, audited PII export, per-worker reports; Settings UI for stages, option lists, features; audit-log viewer | functions | |
| **O6 — Launch readiness** | RLS role tests for every role × table, component tests, a11y/responsive pass, docs + staff guide, go-live checklist (from the SNAP plan §9) | — | |

Messaging (templates, consent-gated outbound log, provider) stays a separately approved later phase
(decision 8 still open).

## 7. Decisions needed

| # | Question | Recommendation |
|---|---|---|
| D1 | Approve reframing `/snap` as **Outreach** with SNAP as a program (O1) before adding features? | Yes — tables are empty, so it's cheapest now |
| D2 | Contact visibility for workers: keep "all workers read all program contacts" (decision 6, helps find-first dedupe and coverage) or tighten to "assigned + shared"? | Keep search-level visibility (name, NB ID, assigned worker) for everyone; full detail, consent and activity only for assigned/shared/leads |
| D3 | Add a **viewer** role (aggregate reports, no participant data)? | Yes |
| D4 | Outreach appointments in the shared `appointments` table, visible on the main Calendar to all staff (time + name, as today), with SNAP detail kept on the case? | Yes — avoids a second calendar |
| D5 | Partners directory NB4HS-wide (shared across programs) or outreach-only? | NB4HS-wide, linked to programs |
| D6 | Can supervisors share records, or only assignees and leads? | Assignees share their own; leads share any |
| D7 | Open from before: may NB4HS record a participant-reported DHS outcome? | Unchanged — needed before O5 reports |

---

## Decisions recorded

| # | Decision (2026-10-26) |
|---|---|
| D1 | Reframe `/snap` as Outreach with SNAP as a program, before adding features |
| D2 | Everyone in a program can search its contacts (name, NB ID, assigned worker); full detail, consent and activity only for the assigned worker, people it's shared with, and supervisors (O2) |
| D3 | Add a `viewer` role: aggregate reports, no participant data (O2) |
| D4 | Outreach appointments live in the shared `appointments` table and show on the main Calendar (O4) |
| D5 | One NB4HS-wide partner directory, linked to programs (O3) |
| D6 | Workers share their own records; supervisors and program admins share any (O2) |
| D7 | Open: recording a participant-reported DHS outcome (needed before O5) |

## O1 report — Outreach Management frame, programs, option lists

Branch `Djenins/outreach-o1-reframe` (from `main` @ e296476). No new features; SNAP works as before, inside Outreach.

**Database** — `supabase/migrations/20261026074338_outreach_o1_programs_and_options.sql` (**applied 2026-10-26** after PR #27 review):
- `programs` registry (key, module `outreach`, names en/ht/fr, case-number prefix, scope note en/ht/fr, `features`, active), seeded with SNAP (`contacts`, `cases`, `tasks`). Readable by active staff; admins add programs; admins and the program's admins edit it; no deletes.
- `check (program in ('snap'))` on `program_staff`, `outreach_contacts`, `outreach_interactions`, `program_case_stages`, `assistance_cases`, `tasks` replaced by foreign keys to `programs`.
- `program_option_sets` (per program: `assistance_type`, `closure_reason`), seeded with exactly the values the old CHECKs allowed and the app's existing en/ht/fr labels. Members read; admins and program admins edit; options are retired (`active = false`), never deleted. `assistance_case_rules()` validates against them: newly chosen values must be active, values already on the case stay valid.
- `program_case_stages.milestone` (`application_assisted`, `referred_external`): the trigger sets the milestone dates from the stage's configuration instead of hardcoded SNAP stage keys. Stage configuration is now editable by system admins as well as program admins.
- New cases: case number from the program's prefix on a shared counter (`snap_case_number_seq` renamed `outreach_case_number_seq`; `next_snap_case_number()` dropped), no longer editable; a case opened without a stage starts at its program's first active stage (the old `'new_inquiry'` default was SNAP-only).
- Consent RLS: any outreach program role (`has_any_program_role()`), since consent is person-level.
- `outreach_dashboard(program, from, to)`; `snap_dashboard(from, to)` kept as a wrapper returning the old keys.
- `audit_row_change()` also records `key` as the record id, and a `programs` row's own key as its program; audit triggers on `programs` and `program_option_sets`.

**App**
- Sidebar **Outreach** (`/outreach/:program/:section`) replaces SNAP Outreach; `/snap/*` redirects to `/outreach/snap`. Sections are in the URL.
- `pages/Outreach.jsx` (was `SnapOutreach.jsx`) loads the program registry, picks the program from the URL (only programs the person holds a role in; administrators see all), shows a program switcher only when there's more than one, and provides `{ program, programRole, info, options }` through `context/OutreachProgramContext.jsx`.
- `lib/outreachPrograms.js`: `outreachSectionsFor()` (replaces `snapSectionsFor()`, adds per-program feature gating), `programsVisibleTo()`, `hasOutreachAccess()`, option-list helpers, data fetchers.
- Every section reads the program from context instead of `"snap"`; data functions take the program (`fetchTasks`, `createTask`, `createCase`, `createOutreachContact`, `logInteraction`, `fetchRecentActivity`, `fetchOutreachDashboard`).
- Assistance types and closure reasons come from the database; milestone labels and the dashboard's referral tile use the configured stage's label (SNAP: "Referred to Rhode Island DHS") and are hidden when a program has no such stage. The "DHS decides eligibility" note is the program's own scope note.
- Module strings made program-neutral (e.g. "Program role", "Program staff and access"); 18 SNAP-specific i18n entries removed (their text now lives in the database) and 13 reworded. New: `navOutreach`, `outreachProgramLabel`, `outreachLoadError` (ht/fr need a native-speaker check).
- `components/snap/*` file names unchanged on purpose: another branch is editing them; renaming can follow once that lands.

**Tests executed**
- Local Postgres 17 (stub + Stage 1, 2a, 2b + O1): all 2a and 2b checks give the same results as without O1 (only the bad-assistance-code error wording changes, and 2a's audit list now includes `program_case_stages` from the milestone seed). 27 new O1 checks pass: unknown program rejected; admin adds a second program and configures its stages and options without a program role; workers read but can't change programs or options; prefix case numbers, client-supplied number ignored, number not editable; second program's case starts at its own first stage; another program's assistance code and closure reason rejected; configured milestone dates; retired option kept on save but not newly selectable (including via the other list); consent recordable by a member of any program; per-program dashboard and the `snap_dashboard` wrapper's old keys; a SNAP supervisor sees no other program's cases or options; a SNAP program admin edits SNAP options but not another program's stages; feature list constrained; audit rows for programs and options; anon sees nothing. The local run found and fixed two issues before commit: the SNAP-only stage default, and a retired option slipping back in through the other assistance list.
- `vitest` 251/251 (new: section/feature/program visibility, sidebar entry, option lists, scope notes, milestones; module page redirects, URL sections, no access to other programs, switcher, `/snap` forwarding; case detail option lists, retired options, closure reasons, milestone labels; dashboard program and referral tile). `vite build` passes.
- Browser (signed out): `/snap/cases` and `/outreach/snap` both return to the landing page, no console errors. Signed-in screens not exercised (no staff credentials, and the live database needs the migration first).

**Rollout:** PR #27 merged 2026-10-26; migration applied the same day (version 20261026074338). Remaining: confirm the deploy, then smoke-test Outreach → SNAP signed in as a SNAP role holder.

**Verified on the live project after applying:** RLS on `programs` and `program_option_sets` with their 6 policies, plus the 4 recreated consent and stage policies (10 in total across the four tables); no `'snap'` CHECK constraint left; 7 tables reference `programs`; SNAP seeded with 14 options and both milestone stages; `case_number` and `stage_key` have no column default; `next_snap_case_number()` gone; trigger functions callable by no one, `outreach_dashboard` / `snap_dashboard` / `has_any_program_role` by signed-in users only. Role checks with real accounts and temporary SNAP roles inside a rolled-back transaction (24/24): a worker reads the program and its 14 options but can't rename the program or add options; a new case gets `SNAP-2026-00002`, starts at New inquiry, gets its automatic follow-up, and its number can't be edited; an unknown assistance code is refused; both milestone dates are set by the configured stages; the worker records consent under the new any-program rule; `outreach_dashboard` counts the referral and `snap_dashboard` still returns the old keys; a supervisor is refused an unknown closure reason, closes with a SNAP one, and can't edit options; a program admin edits a SNAP option; an administrator without a SNAP role reads the options and adds a program but sees no contacts, cases, consents or notes; the SNAP supervisor can't edit the other program; anonymous callers see nothing; audit rows for programs and options carry a record id and program. Afterwards: only SNAP in `programs`, the one existing `program_staff` row unchanged, no test client, case, task or consent, and no edited option. The case-number and NB ID counters each advanced by one, so the next numbers skip one. Security advisor: no new anon findings, no tables without RLS; among signed-in-callable SECURITY DEFINER functions `next_snap_case_number` is gone and `has_any_program_role` is new (intended: RLS evaluates it as the caller, like `has_program_role`).

**Known limitations:** reminder notifications keep the `snap_task_due` type and `snap_send_task_reminders()` / `snap_today()` names (program-agnostic in behaviour); `referred_to_dhs_at` keeps its column name (now "referred out" for any program); there's no settings UI yet for programs, options or stages (O5); the program switcher has no unread/count badges.
