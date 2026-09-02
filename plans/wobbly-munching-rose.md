# Supabase migration — as-built reconstruction

## Note on this document

The original plan file at this path was lost (never committed to git, and its
content wasn't preserved in any session transcript on this machine). This is
a **reconstruction**, assembled from the ~15 code comments across the
codebase that cite it, describing what was actually shipped rather than what
was originally proposed. Treat it as documentation of the as-built migration,
not as the literal original plan text.

## Context

The app originally kept all state in a single `data` blob in `localStorage`
(visits, students, classes, clients, appointments, notes, documents, staff
users, sessions, ...), with a hand-rolled plaintext password check against
`data.users`. This migration moves that state onto Supabase (Postgres +
Auth + Realtime), table by table, in three phases — each phase swaps the
read/write layer for one slice of `data` while keeping the rest of the app
(which only reads the resulting shape) working with minimal changes.

The general idiom used throughout: a `lib/*Data.js` module maps snake_case
Postgres rows to/from the exact camelCase shapes the rest of the app already
expected (`checkinData.js`, `clientsData.js`, `sessionsData.js`), so page
components mostly don't change — only the *write* call sites do. Tables that
a global page needs to list/filter get fetched on mount and kept live via
`postgres_changes` subscriptions in `AppContext`; tables that are only shown
per-record on a detail page (notes, documents, communications, applications)
are fetched on demand instead of held in global state.

## Phase 1 — Auth + visits/students/classes

- **Auth**: `supabaseAuth.js` replaces the old plaintext `data.users`
  password check with real Supabase Auth (`supabase.auth.signInWithPassword`).
  A separate `profiles` table (role/name/active), keyed by `auth.users.id`,
  carries the role/name/active fields the old `data.users` rows used to hold.
  `StaffLogin.jsx` calls `signIn`, then synchronously reads the fresh profile
  to pick a landing page and surface the pending-appointments toast; `session`
  itself is set by `AppContext`'s own `onAuthStateChange` listener.
- **Visits/students/classes**: `checkinData.js` replaces
  `data.visits`/`data.students`/`data.classes`. Fetched on mount and kept in
  sync in real time via `postgres_changes` subscriptions in `AppContext`, so a
  check-in on one device shows up on every other device/tab within seconds.
- The 3 seed staff accounts created for this phase belong to real staff, not
  demo logins — the app's login screen deliberately has no click-to-copy
  demo-credentials panel, since showing them would mean leaking real
  passwords, not placeholder ones.
- Deliberately deferred: a real `resetPasswordForEmail` flow for "Forgot
  Password?" — no reset flow is wired up.

## Phase 2 — Clients, program tables, appointments, per-record data

- **`clientsData.js`** replaces the Case Management / Job Developer / Food
  Distribution / unified-client slice of `data` (`caseClients`, `jobClients`,
  `foodClients`, the master `clients` table, custom services/staff/industries
  lists). Same row↔shape mapping idiom as `checkinData.js`.
- **Unified client record**: `ClientProfile.jsx` reads/writes the master
  `clients` table; each program's own detail (Case Management/Job
  Developer/Food Distribution) stays in its own table (`case_clients`,
  `job_clients`, `food_clients`, ...), joined by the master client's id.
- **No `program_enrollments` join table**: the old design's join table only
  ever stored two fields nothing used (`status` always `"active"`,
  `assignedStaffId` always `null`), so it was dropped. Each program table
  instead carries its own `nbId` (joined from `clients` server-side); "which
  programs is this person in" is just filtering each program pool by `nbId`.
- **Appointments** now store the *master* `clients.id` directly (not a
  per-program row id) — a program row's `nbId` is resolved to that master id
  only at submit time.
- **Per-client detail data — fetched on demand, not global state**: notes,
  documents, and communications on `ClientProfile.jsx`; applications, notes,
  and documents on `JobClientProfile.jsx`. Each lives in its own table
  (e.g. the privacy-restricted `case_client_notes` table, RLS-scoped to
  `case_manager`/`administrator` only) and is fetched per-client rather than
  embedded on the program row or held in global `AppContext` state.

## Phase 3 — Sessions, past-session students, profiles

- **`sessionsData.js`** replaces `data.currentSession`/`data.sessionHistory`/
  `data.pastSessionStudents`. Same row↔shape mapping idiom as
  `checkinData.js`/`clientsData.js`. "Current session" and "history" are both
  just rows in a `sessions` table — the only difference is the `is_current`
  flag, flipped atomically server-side by `start_new_session()`.
- **`profiles`** replaces the old `data.users` local mirror entirely —
  `Users.jsx`/`CaseManagement.jsx`/`JobDeveloper.jsx` read real Supabase Auth
  profiles directly instead of a hand-synced copy.
- Same authenticated-only fetch-on-mount + subscription pattern as Phase 2 —
  the pages that read this data are all staff-only, unreachable by the
  kiosk's anonymous session (see `lib/nav.js`).
- Per-signed-in-user notification feed (new-appointment alerts) added on top
  of this phase's data, fetched and kept live the same way, scoped to the
  current user's rows via `session.id`.

## What's out of scope / still deferred

These are noted in code comments as explicitly not part of this migration:

- Password reset (`resetPasswordForEmail`) — still not wired up.
- The separate **Employer & Job Opportunity Management** module (Workforce
  Development: Employers, Job Openings, Candidate Matching, Referrals,
  Placements, Workforce Dashboard, Reports) is a later, independent
  multi-phase plan, not part of this migration.
