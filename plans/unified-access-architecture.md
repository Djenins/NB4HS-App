# NB4HS Unified Architecture: Users, Positions, Roles, Permissions, Workspaces

Status: **approved 2026-10-26** with the recommended defaults D1–D13. **Phase 0 complete 2026-10-26:**
- PR #23 merged, so the repo matches the live database.
- PR #31 merged (Staff Reports R1 is live).
- PR #34 merged: security hotfixes, CI and the new appointment-request path.
- Migrations p0a (20261026084229) and p0b (20261026084847) applied and verified on live.
- One test appointment was submitted on the live site, checked and deleted.

Open from §2.1: S7 and S8 (Phase 3), S11 (Phase 1), S13 (review).
Audit date 2026-10-26. The audit was read-only: the repository at `origin/main` (d47f5bc), the open PR branches and the live Supabase project `vkbzarlkqzvhsfdmxyyq`, read with SELECT queries only.

This builds on three earlier plans. It does not replace them:
- `ui-design-system.md` (approved; Phase 1 merged as PR #32, Phase 2 in progress)
- `outreach-management-architecture.md` (approved; O1 merged)
- `staff-reporting-architecture.md` (R1 built, PR #31 open). §8 below reshapes it.

Throughout, **[exists]** marks something already built and **[new]** marks a proposal.

---

## 1. Current architecture assessment

### 1.1 Stack and delivery

- React 18, Vite 5, react-router 6, Tailwind 3 alongside the legacy `main.css`, and Supabase (Auth, Postgres, RLS, Realtime, pg_cron, one Storage bucket).
- Deployed to Vercel as a static SPA. There are no Edge Functions, no `pg_net` and no email provider.
- No CI: there is no `.github/` directory, so tests run only by hand (`npm test`, 16 files, about 250 cases).
- Live data is small: 6 profiles (5 active: 3 administrators, 1 staff, 1 case manager), 3 clients, 10 students, 0 staff reports.
- The inactive profile is an administrator named "Bernard Georges" (§11, D1).

### 1.2 Identity and authorization today [exists]

| Layer | What it is | Notes |
|---|---|---|
| Accounts | Supabase Auth, email and password. `handle_new_user` creates `profiles(id, name, email, role, active)` **inactive** | One account per person, which is correct. Self-signup is locked down (Stage 0a) |
| System role | `profiles.role` CHECK in administrator, staff, receptionist, case_manager, job_developer. **One role per user** | This single column mixes job position and permission set |
| DB helpers | `is_admin()`, `has_role(text[])`, `is_staff()` (= any active profile) | All are SECURITY DEFINER with `search_path` set (good) |
| Program roles | `program_staff(user_id, program, program_role)` with worker, supervisor, program_admin (+ reviewer for `staff_reports`). Helpers `has_program_role`, `can_manage_program`, `is_program_lead` | The closest thing to the target model, but only for Outreach/SNAP and Staff Reports |
| Workforce toggle | `workforce_role_access(role, enabled)`, edited in Settings | **Used only by the UI.** RLS is hard-coded to administrator and job_developer, so the toggle and the database disagree |
| Program registry | `programs(key, module, features[], …)`: rows `snap` (module outreach) and `staff_reports` (module staff_reporting) | Despite the name, this is the *Outreach program configuration*, not the organization's programs |
| Departments | `departments` (6 rows) and `staff_departments` (0 rows), from Staff Reports R1 | A second, parallel list of programs |
| Audit | `audit_events` + `audit_row_change()`. Records changed **field names only**. Attached to 10 Outreach and registry tables | Not attached to `profiles`, so role and activation changes go unaudited. No immutability guard |
| Navigation | `lib/nav.js` maps role to a hard-coded key list; `NAV_SECTION` groups the keys; `RequireRoute` reuses the same list | Client-side only. **14 staff routes have no guard at all** |
| User admin | `Users.jsx`: list, activate or deactivate, and create through the browser's `auth.signUp` | Creating a user can **switch the admin's own session** to the new account. No invite, role change, name edit, session revocation or history |

### 1.3 Programs and features as built [exists]

| Area | Built pages (routes) | Data |
|---|---|---|
| **Workforce** | `/workforce` hub, `/workforcedashboard`, `/jobdeveloper` (participants) + `/:clientId`, `/employers` + `/:id`, `/jobopenings`, `/candidatematching`, `/referrals`, `/placements` + `/:id` (with follow-up check-ins), `/workforcereports` | `job_clients`, `job_applications`, `employers*`, `job_openings`, `referrals`, `placements`, `placement_checkins` |
| **SNAP** (an Outreach program) | `/outreach/snap/{dashboard,contacts,cases,tasks,staff}`; `/snap/*` redirects there | `outreach_contacts`, `contact_consents`, `outreach_interactions`, `assistance_cases`, notes, stage history, `tasks` |
| **Students** | `/students` (roster board, enrollment, sessions), `/assessments` (a **separate top-level nav item** today) | `students` (assessment scores are columns on it), `classes`, `sessions`, `past_session_students`, `visits` (attendance) |
| **Case Management** | `/casemanagement`, `/mycaseload`, `/clients/:nbId` (unified profile: notes, documents, communications, intake) | `clients`, `case_clients`, `case_client_notes`, `client_notes`, `client_documents`, `communications`, `appointments` |
| **Food Distribution** | `/fooddistribution` | `food_clients`, `food_distributions` (**not in your program list, see D2**) |
| Front desk (shared) | `/checkin*`, `/checkout*`, `/search` (visitor log), `/qrcode`, kiosk mode | `visits`, kiosk RPCs |
| Shared | `/dashboard`, `/calendar`, `/reports`, `/manage` (service, staff and classroom lists), notifications bell | `calendar_events`, `notifications` |
| Admin | `/users`, `/settings` (closing time, which is stored per browser, and the Workforce toggles) | `profiles`, `workforce_role_access` |
| Staff Reports | Built on PR #31 (`/myreports`, `/staffreports`). **Its migration is already applied live; the code is not merged** | `reporting_*`, `staff_reports`, versions, reviews |

### 1.4 Shared UI [exists]

- The design-system plan is approved.
- Phase 1 (semantic tokens) is merged.
- Phase 2 primitives are being built, **uncommitted**, in the separate worktree `../NB4HS-App-React-ds` on branch `Djenins/design-system-components`. It already includes PageHeader, Dialog, Drawer, DataTable, FilterBar, Tabs, StatusBadge, KpiCard, EmptyState, Skeleton and more.
- The approved Calendar redesign is the visual reference.
- The `impeccable` skill is installed with subcommands `audit`, `critique`, `extract`, `document`, `typeset`, `layout`, `adapt`, `harden`, `polish` and `detect`. There is no separate `normalize` command; normalizing is `extract` + `polish`. Four helper agents are also installed: documenter, finish-reviewer, asset-producer and manual-edit-applier.

### 1.5 Repo and live-database drift (Phase 0)

1. Staff Reports R1 migration `20261026075822` is **applied live**, but PR #31 is open, so `main` lacks the migration file and the code.
2. Stage 0b was applied live as version `20261026062909`. The repo file is named `20261026120100_…` and its header still says "NOT YET APPLIED". PR #23 (which records 0b as applied) is open.
3. The `client-documents` bucket and its policies exist only in the dashboard and are not in any migration.

---

## 2. Gap analysis

| Requirement | Today | Gap |
|---|---|---|
| Users ≠ positions ≠ roles | One `profiles.role` column does all three | New `positions`, `roles` and assignment tables |
| Multiple positions and roles per user | One role (plus program roles in SNAP only) | Many-to-many tables |
| Custom roles | None; roles are a CHECK list | `roles` + `role_permissions`, admin-editable |
| Explicit program access | Implied by role; Workforce by a role toggle that RLS ignores | `user_program_access`, enforced in RLS |
| Action-level permissions | Implied by role lists inside each policy | `permissions` catalog and `has_permission()` |
| Record scopes (own, assigned, team, program, org) | Partly: SNAP assigned vs lead, appointment by email, notes by `created_by` | One scope model and helper. Teams do not exist |
| Assessments under Students | Separate nav item and route; data is already on `students` | Nest it in nav, routes and permissions |
| Dynamic navigation | Hard-coded role→key list | Built from a module registry and effective permissions |
| Route and API enforcement | 14 unguarded routes; several RPCs with no role checks | Guard every route; fix the RPCs; move policies to permissions |
| Program workspaces | Workforce and Outreach have ModuleNav; the others are flat pages | One workspace shell with a contextual sidebar |
| Admin user lifecycle | Browser signUp, activate toggle | Server-side invite and lifecycle through an Edge Function |
| Audit of admin changes | Profiles not audited; field names only | Value-level audit for admin tables; append-only |
| Biweekly reports across programs | R1: one report **per department** | One report per period listing several programs and positions (§8) |
| Email to Bernard | No email anywhere | Outbound queue, Edge Function and provider (R3) |
| Unified design | In progress | Continue the approved plan; add the shell, workspace and admin templates |

### 2.1 Pre-existing security issues found in the audit

These are fixed in Phase 0 or Phase 1, independent of the new model.

| # | Severity | Issue | Evidence |
|---|---|---|---|
| S1 | **High** | `create_case_client`, `create_job_client`, `create_food_client` and `create_student` are SECURITY DEFINER with **no role check**. Any signed-in user, including a receptionist, can create case or job clients that RLS would refuse | `20260715130854…sql:226-329`, `20260720164605…sql` |
| S2 | **High** | Storage bucket `client-documents`: any authenticated user can read, upload and delete **any** object (live policy is `bucket_id = 'client-documents'` only) | live `pg_policies` |
| S3 | Medium | `appointments_insert` is `with check (true)` for **anon**: any status, any `assigned_email`, and it fires notifications to any staff member | phase2:155, live |
| S4 | Medium | Users can edit their own `profiles.email`. Appointment notifications are routed by email (`limit 1`), so a user can intercept a colleague's notifications | `rbac_hardening.sql:8-27` |
| S5 | Medium | The `staff_directory` view (definer rights) is granted to anon and exposes staff emails | `20260716053433…:30-36` |
| S6 | Medium | Signup still stores a requested `administrator` role (inactive). Activating that account grants admin silently | stage0a:32-38 |
| S7 | Medium | Workforce toggle and RLS disagree (see §1.2) | `20260727200452` vs workforce policies |
| S8 | Medium | Intake form is gated to case manager or admin **only in the UI**; `clients` RLS is `is_staff()` | `CaseManagement.jsx:293`, `ClientProfile.jsx:616` |
| S9 | Low | `created_by` and `uploaded_by` can be spoofed on notes, documents, communications and calendar events. A "private" note can be planted under another user's name | `20260720193841`, others |
| S10 | Low | Some admin checks skip `active` (calendar_events, appointments by email) | `20260716050948:35,43` |
| S11 | Low | `audit_events` is not append-only for privileged roles; profile changes are not audited | stage1:92 |
| S12 | Low | `next_nb_id()` and `next_student_display_id()` are callable by anon (number burning) | `20260715131048`, `20260716032418` |
| S13 | Info | Kiosk RPCs expose the roster and open visits by design. Rate limiting is to be reviewed | stage0a |

---

## 3. Organizational data model [new]

### 3.1 Concepts, kept strictly apart

```
 profiles (user, 1 per person) ──< user_positions >── positions   describes the job, grants nothing
        │
        ├──< user_roles >── roles ──< role_permissions >── permissions ── app_modules
        │        (optionally scoped to one program)                  (program ▸ submodule, shared, admin)
        ├──< user_program_access >── app_modules (kind = program)  the program gate
        ├──< user_permission_overrides  (grant | deny, with scope, reason, expiry)
        └──< team_members >── teams (per program)                  used only by the team scope
```

### 3.2 Module registry: programs, submodules and shared features

`app_modules` is the single catalog the admin pages, navigation and permissions read from.

```
app_modules (key PK, parent_key → app_modules, kind program|submodule|shared|admin,
             name_en/ht/fr, description, icon, sort_order,
             implemented bool,     -- false = catalog entry only, no screens, never shown in nav
             active bool,          -- org switch: a module can be turned off
             outreach_program text → programs(key) null,   -- links SNAP to its Outreach config row
             created_at, updated_at)
```

Proposed seed (only **implemented** areas get `implemented = true`):

| Key | Kind | Parent | Notes |
|---|---|---|---|
| `workforce` | program | | |
| `workforce.participants`, `.employers`, `.jobs`, `.matching`, `.referrals`, `.placements`, `.reports` | submodule | workforce | Follow-ups live inside placements |
| `snap` | program | | `outreach_program = 'snap'`, so the Outreach engine keeps working |
| `snap.contacts`, `.cases`, `.tasks`, `.staff` | submodule | snap | Partners, referrals, appointments and reports are **not built** (Outreach plan O2+) |
| `students` | program | | |
| `students.directory`, `.classes`, `.attendance`, `.assessments`, `.sessions` | submodule | students | **Assessments is a submodule only** |
| `case_management` | program | | |
| `case_management.clients`, `.caseload`, `.notes`, `.documents`, `.intake`, `.appointments` | submodule | case_management | |
| `food_distribution` | program | | Pending D2 |
| `front_desk` | shared | | check-in, check-out, visitor search, QR |
| `calendar`, `staff_reports`, `notifications`, `org_reports`, `profile` | shared | | |
| `admin` | admin | | Users, Roles, Programs, Positions, Audit, Settings |

**Relation to existing tables:**
- `programs` stays as the Outreach configuration table. It is not renamed and nothing is lost.
- The `staff_reports` row in `programs` becomes redundant after Phase 6 and is retired, not deleted.
- `departments` is superseded by `app_modules` programs (§8.2, D7).

Adding a module to the catalog (`implemented = false`) creates **no** screens, tables or navigation. Building it is still a code change, which keeps catalog and implementation independent (req. 15).

### 3.3 Positions

```
positions        (id, key, name_en/ht/fr, description, archived_at, sort_order)
user_positions   (user_id, position_id, is_primary bool, started_on, ended_on, assigned_by, PK(user_id, position_id))
position_role_suggestions (position_id, role_id)   -- a hint in the admin UI only, never applied automatically
```

Seed: Outreach Worker, Job Developer, Case Manager, Computer Literacy Instructor, Program Coordinator, Program Director, Executive Director, IT Administrator, plus Receptionist / Front Desk (confirm, D4).

### 3.4 Roles and permissions

```
permissions      (key PK e.g. 'students.assessments.grade', module_key → app_modules,
                  action, description_en/ht/fr,
                  scoped bool,          -- does this permission take a record scope?
                  sensitivity normal|sensitive|system,
                  sort_order)
roles            (id, key unique, name, description,
                  kind builtin|custom, protected bool,   -- protected = cannot be edited, archived or deleted
                  archived_at, created_by, timestamps)
role_permissions (role_id, permission_key, scope own|assigned|team|program|org null, PK(role_id, permission_key))
user_roles       (id, user_id, role_id, program_key → app_modules null,   -- null = every program the user can access
                  granted_by, granted_at, expires_at, revoked_at, revoked_by)
user_permission_overrides (id, user_id, permission_key, effect grant|deny, scope, program_key null,
                  reason not null, granted_by, granted_at, expires_at, revoked_at)
user_program_access (user_id, program_key → app_modules(kind=program), is_primary bool,
                  granted_by, granted_at, revoked_at, PK(user_id, program_key))
teams            (id, program_key, name, lead_id → profiles, active)
team_members     (team_id, user_id, PK)
profiles         + primary_workspace text → app_modules, deactivated_at, deactivated_by, invited_at
```

**Permission catalog sketch.** About 120 keys, seeded in the migration. Each program follows the same pattern.

| Module | Keys |
|---|---|
| Students | `students.view`, `.create`, `.edit`, `.delete`, `.export`; `students.attendance.view`, `.manage`; `students.classes.view`, `.manage`; `students.sessions.manage`; `students.assessments.view`, `.create`, `.administer`, `.grade`, `.manage` |
| Workforce | `workforce.view`; `workforce.participants.{view,create,edit,delete,export}`; `workforce.employers.*`; `workforce.jobs.*`; `workforce.referrals.{view,create,edit}`; `workforce.placements.{view,create,edit}`; `workforce.reports.{view,export}`; `workforce.settings.manage` |
| SNAP | `snap.view`; `snap.contacts.{view,create,edit}`; `snap.cases.{view,create,edit,review}`; `snap.cases.notes.view` (sensitive); `snap.tasks.{view,manage}`; `snap.staff.manage`; `snap.reports.view`; `snap.settings.manage` |
| Case Management | `case_management.view`; `.clients.{view,create,edit,delete,export}`; `.notes.view` (sensitive), `.notes.create`; `.intake.view`/`.edit` (sensitive); `.documents.{view,upload,delete}` (sensitive); `.appointments.{view,manage}`; `.reports.view` |
| Participants (master record) | `participants.view`, `participants.demographics.view` (sensitive), `participants.merge` |
| Shared | `frontdesk.checkin`, `.checkout`, `.visits.search`, `.visits.edit`, `.qrcode`; `calendar.view`, `.events.create`, `.events.manage_all`; `staff_reports.submit`, `.review`, `.view_all`, `.export`, `.schedule.manage`; `org_reports.view`, `.export` |
| Admin (all `system`) | `admin.access`; `admin.users.{view,invite,edit,deactivate,revoke_sessions}`; `admin.roles.{view,manage}`; `admin.permissions.assign`; `admin.positions.manage`; `admin.programs.manage`; `admin.audit.view`; `admin.settings.manage` |

**Built-in roles** (`kind = builtin`):

| Role | Purpose | Protected |
|---|---|---|
| System Administrator | Every `admin.*` permission. **No sensitive participant permissions** unless also granted another role | Yes |
| Executive Oversight | `org_reports.*`, `staff_reports.review` and `.view_all`, `<program>.view` and `<program>.reports.view` at org scope. **No sensitive notes** | Edit only |
| Program Manager, Program Staff, Front Desk, Viewer (aggregates only) | Templates to copy or assign, applied per program through `user_roles.program_key` | No |
| *Legacy: Administrator, Staff, Receptionist, Case Manager, Job Developer* | Exact mirrors of today's hard-coded access, used for the no-change backfill (§7). Archived once you reassign people | No |

---

## 4. Permission resolution rules [new]

All evaluation happens **server-side**. The client receives a copy only to draw the UI.

For user **U**, permission **P** (module M, root program R(M)) and an optional record:

1. **Account.** U must be active (`profiles.active`) and the auth user not banned. Otherwise U has nothing.
2. **Module switch.** If M or any ancestor has `active = false` or `implemented = false`, deny.
3. **Explicit deny wins.** An unexpired, unrevoked `deny` override for P, matching R or with a null program, denies. It beats every role and grant.
4. **Program gate.** If M belongs to a program, U must hold `user_program_access(U, R)`. A role never opens a program by itself; this matches "positions and roles do not grant program access".
5. **Parent gate.** A submodule permission also requires the parent's `.view` permission (for example `students.assessments.grade` requires `students.view`). This applies recursively.
6. **Grants.** U holds P if any active `user_roles` row (whose `program_key` is null or equals R) includes P, **or** an active `grant` override exists.
7. **Scope.** The effective scope is the **widest** scope among the matching grants (own < assigned < team < program < org). A deny override with a scope narrows the result to below that scope (for example "deny program scope" leaves assigned).
8. **Record check.** For a scoped P on one row:

   | Scope | Rule |
   |---|---|
   | own | `created_by = U` |
   | assigned | `assigned_to = U`, or an active `record_shares` row exists (Outreach plan) |
   | team | the record's assignee is in a team U leads or belongs to, within R |
   | program | the record's program is R |
   | org | any |

   Until teams exist, **team resolves to assigned** (least privilege).
9. **Sensitive data.** `sensitivity = sensitive` permissions are never included in System Administrator or Executive Oversight, never implied by a parent, and adding one to a role or override triggers a high-risk confirmation. `system` permissions can only be assigned by a holder of `admin.permissions.assign` who is a System Administrator.
10. **No defaults.** Absence means deny. A navigation item existing never grants anything.

**Anti-escalation**, enforced in triggers on `role_permissions`, `user_roles` and `user_permission_overrides`:
- A non-System-Administrator can assign only permissions they effectively hold themselves, at the same or a narrower scope.
- A user cannot change their own roles, overrides or program access.
- Protected roles are immutable.
- The **last active System Administrator** cannot be deactivated, cannot lose the role, and cannot be given a deny on `admin.*`.

**Performance.** A `user_effective_permissions(user_id, permission_key, program_key, scope)` table is rebuilt for affected users by triggers on every input table. RLS calls `has_permission(p_key, p_program default null)` and `permission_scope(p_key, p_program)`, two STABLE SECURITY DEFINER lookups on an indexed table. The client calls `my_permissions()` once per session (plus a realtime refresh).

**Preview.** `preview_effective_permissions(user_id, proposed jsonb)` returns the before-and-after diff, with the origin of each permission (role X, override Y, denied by Z) and without saving. The admin UI shows this before every save.

---

## 5. Proposed database migrations

All migrations are additive, one per phase. Each gets a dry run inside `begin … rollback` against the live project with a regression script (the pattern from `supabase/tests/staff_reports_r1_check.sql`), then is applied only after your OK.

| Migration | Phase | Contents |
|---|---|---|
| `p0_security_hotfixes` | 0 | S1: role checks in the `create_*` RPCs. S2: bucket policies by record access, plus the bucket definition version-controlled. S3: anon appointment insert limited to `status = 'requested'`, `source = 'client'`, no `assigned_email`. S4: block self-edit of `email`. S5: drop the anon grant on `staff_directory`. S6: signup always stores `staff`. S9: force attribution columns to `auth.uid()`. S10: add the `active` checks. S12: revoke the anon grants |
| `p1_access_foundation` | 1 | `app_modules`, `permissions`, `roles`, `role_permissions`, `user_roles`, `user_permission_overrides`, `user_program_access`, `positions`, `user_positions`, `teams`, `team_members`, `user_effective_permissions`; `has_permission()`, `permission_scope()`, `my_permissions()`, `preview_effective_permissions()`; the anti-escalation and last-admin triggers; the **backfill**: legacy roles from `profiles.role`, program access mirroring today, and `program_staff` mirrored into program-scoped roles. **No existing policy changes** |
| `p1_audit_hardening` | 1 | `audit_events` gains `subject_user_id`, `old_values`/`new_values` jsonb (**only for admin tables**, which hold no participant data), and `reason`. An append-only trigger plus a revoke of UPDATE and DELETE from every role. The audit trigger is attached to `profiles` and all new admin tables |
| `p3_policies_<module>` | 3 | One migration per module: replace `has_role(...)` / `is_staff()` policies with `has_permission()` plus scope, and fix S7 and S8. **Each ships a down migration that restores the old policies verbatim** |
| `p6_staff_reports_r1b` | 6 | See §8.2 |
| `p6_r2_reminders`, `p6_r3_email`, `p6_r4_attachments` | 6 | As in the staff reporting plan, with the email queue made generic |

Nothing is dropped during the transition:
- `profiles.role` stays, kept in sync for display and rollback until Phase 8.
- `program_staff` stays, read by a compatibility view.
- `workforce_role_access` stays read-only.

They are retired only in a final clean-up migration after the Phase 8 sign-off.

---

## 6. Admin interface design [new]

Routes are under `/admin`. Each needs `admin.access` plus that page's permission. Old `/users` and `/settings` redirect.

| Page | Contents |
|---|---|
| Overview | Account counts (active, invited, deactivated), recent admin changes, a warning if only one System Administrator is active, email queue health (after R3) |
| Users | DataTable: name, email, positions, roles, programs, status, last sign-in. Filters. "Invite staff" |
| User profile `/admin/users/:id` | Tabs: **Profile** (name, email, status, primary workspace, lifecycle actions) · **Positions** · **Roles** (each with an optional program) · **Program Access** · **Detailed Permissions** · **Activity & Audit** |
| Roles & Permissions | Role list (built-in, custom, archived) → role editor: the hierarchical tree with scope pickers, Duplicate, Archive, an "affected users" count, and an impact preview before saving |
| Programs & Modules | The module tree: active and implemented flags, descriptions, which users can access each program. Turning a module off needs a confirmation |
| Staff Positions | Add, edit and archive positions; suggested roles |
| Access Audit Log | Filters for actor, affected user, action and date. Shows the before→after diff. Read-only. CSV export needs `admin.audit.view` |
| System Settings | Today's Settings: closing time **moved to the server** (`app_settings`), Manage's service, staff and classroom lists, the reporting schedule (moved from Staff Reports) |

**Detailed Permissions tab: hierarchical editor.**

```
▾ Students                         [access: ✓ granted 2026-10-26 by A. Admin]
   Student Directory    View ●role:Program Staff   Create ●role   Edit ●role   Delete ○
   Classes              View ●role   Manage ○
   Attendance           View ●role   Manage ◐override:grant (until Dec 31)
 ▾ Assessments          View ●role   Create ●role   Administer ●role   Grade ✕override:deny   Manage ○
```

- ● means from a role (hover shows which). ◐ is an individual grant. ✕ is an individual deny. ○ means not held.
- The scope shows as a chip beside each scoped permission.
- Edits are staged. **Save** opens a preview listing added and removed permissions. High-risk items (any sensitive or system permission, removing an admin, deactivation) need a typed confirmation and a reason.

**Account lifecycle.** This goes through a new Edge Function, `admin-users`. It runs with the service role key held as a function secret; that key never reaches the browser. It verifies the caller's JWT and checks `has_permission`, then:
- **Invite:** `auth.admin.inviteUserByEmail` sends a secure one-time link. The profile is created inactive and becomes active on first password set. This replaces today's browser `signUp`, which can switch the admin's session.
- **Resend invite**, **send password reset**.
- **Deactivate:** the profile goes inactive, the auth user is banned, and **all sessions are revoked**. **Reactivate** reverses it.
- **Revoke sessions** on its own.
- Every action writes `audit_events` with a reason. Passwords are never shown, set or stored by the admin UI.

Invites use Supabase Auth email, with a custom SMTP sender once the email provider is chosen (D9).

---

## 7. Dynamic navigation and workspace architecture [new]

### 7.1 One registry drives everything

`src/lib/modules.js` mirrors `app_modules` and adds the UI details: route, icon, i18n label and the permission each item `requires`.
- **Sidebar** = registry ∩ `my_permissions()`. Groups with no visible children are not rendered.
- **`RequireRoute`** wraps **every** staff route and checks the same `requires` key. This closes the 14 unguarded routes.
- **Landing page:** `profiles.primary_workspace`, or else the first authorized workspace.
- **Dashboard:** a personal "Home" built from widgets the user is authorized for: my tasks, my caseload, my reports due, program KPIs at the user's scope.

### 7.2 Shell layout (one shell for everything)

```
┌ Sidebar ─────────────────┐┌ Topbar: breadcrumbs ·········· search · bell · theme · lang · avatar ┐
│ [Workspace ▾  Students ] ││ PageHeader (title, description, actions)                              │
│                          ││                                                                       │
│  Overview                ││   page content (one of the 5 approved page templates)                  │
│  Student Directory       ││                                                                       │
│  Classes                 ││                                                                       │
│  Attendance              ││                                                                       │
│  Assessments  ●          ││                                                                       │
│  Reports                 ││                                                                       │
│ ─────────────            ││                                                                       │
│  Home · Calendar ·       ││                                                                       │
│  My Reports · Admin      ││                                                                       │
└──────────────────────────┘└───────────────────────────────────────────────────────────────────────┘
```

- **Workspace switcher** at the top of the sidebar. It lists Home, each authorized program and Admin (if allowed). Switching changes the sidebar to that workspace's sections without re-login, and remembers the last page per workspace.
- **Shared links** sit at the bottom of the sidebar so they are reachable from every workspace.
- **Mobile:** an off-canvas drawer (the approved design system item 3g) replaces today's forced 76px rail. The workspace switcher sits at its top.
- **Accessibility:** the sidebar is a `<nav>` landmark; the switcher is a listbox; `aria-current="page"` marks the active item; keyboard focus moves to the page title after navigation.

### 7.3 Workspace menus: existing features only

| Workspace | Sections (✓ built and mapped; ✗ not built, hidden until built) |
|---|---|
| **Workforce** | ✓ Overview (WorkforceDashboard) · ✓ Participants (JobDeveloper) · ✓ Job Opportunities · ✓ Employers · ✓ Matching · ✓ Applications & Referrals · ✓ Placements & Follow-ups · ✓ Reports |
| **SNAP** | ✓ Overview · ✓ Contacts (outreach activity) · ✓ Assistance Cases · ✓ Follow-ups · ✓ Program Staff · ✗ Appointments · ✗ Community Partners · ✗ Referrals · ✗ Reports (Outreach O2+) |
| **Students** | ✓ Student Directory (Students board) · ✓ Classes (from Manage) · ✓ Attendance (student visits; a filtered view of existing data) · ✓ Assessments · ✓ Sessions · ✗ Overview (small new page, see D10) · ✗ Progress · ✗ Reports |
| **Case Management** | ✓ Clients (CaseManagement) · ✓ My Caseload · ✓ Appointments (existing appointment section) · ✗ Overview · ✗ Follow-ups · ✗ Referrals · ✗ Reports |
| **Food Distribution** (D2) | ✓ Distributions |
| **Home (shared)** | ✓ Dashboard · ✓ Calendar · ✓ Front Desk (check-in, check-out, visitor log, QR) · ✓ My Reports · ✓ Staff Reports review (permission) · ✓ Org Reports · Profile (new, small: own name, language, password) |

### 7.4 Routes: preserve, then redirect

- New canonical routes:
  - `/workforce/<section>`, `/snap/<section>`, `/students/<section>`, `/case-management/<section>`, `/food/<section>`, `/admin/<section>`
  - Records: `/students/assessments`, `/workforce/employers/:id`, …
- **Every current URL keeps working** through `<Navigate replace>` redirects, covered by a route test per old URL. Examples:
  - `/assessments` → `/students/assessments`
  - `/employers/:id` → `/workforce/employers/:id`
  - `/outreach/snap/cases` → `/snap/cases`
  - `/users` → `/admin/users`
- Notification links stored in the database (`notifications.link`) are rewritten in the same migration as the routes.
- **Outreach** stays as the engine behind SNAP. Each future outreach program becomes its own program workspace. (This reverses today's `/snap → /outreach/snap` redirect; see D3.)

---

## 8. Staff reporting integration

### 8.1 What exists [exists, PR #31 open, applied live]

- Schedule: 14-day periods from Mon Nov 2 2026, due Monday 5:00 PM America/New_York.
- Drafts with autosave, submit through RPCs, immutable versions, reviewer actions (acknowledge, request revision) and in-app notifications with links.
- Reviewer = `program_staff('staff_reports','reviewer')`.
- The unique key is **(period, staff, department)**.

### 8.2 Changes required by this goal [new, migration R1b]

The goal says staff report across programs **in one report**. R1 requires one report per department. There are 0 reports and 0 department assignments live, so reshaping now costs nothing.

| Change | Detail |
|---|---|
| One report per staff × period | Unique key becomes `(period_id, staff_id)`; `department_id` becomes nullable, then retired |
| Programs worked on | `staff_report_programs(report_id, module_key)`, at least one required to submit, limited to the user's program access (plus an "Organization-wide / Administration" option) |
| Positions | Snapshot the user's positions on submit (`positions jsonb` on the version). Optional per-program sections in the form |
| Who must report | Every active user holding `staff_reports.submit` (instead of department membership) |
| Reviewers | `staff_reports.review` permission. Bernard gets it through Executive Oversight once D1 is confirmed |
| Schedule admin | Moves to Admin → System Settings (`staff_reports.schedule.manage`) |
| Departments | Superseded by `app_modules`. The tables are kept read-only, then dropped in clean-up (D7) |

Then R2–R4 follow as already planned:
- **R2** hourly reminders: configurable offsets before and after the due date, deduplicated by a primary-key table.
- **R3** a generic `outbound_messages` queue, pg_net, an Edge Function `send-outbound` and a provider. The email to Bernard carries the staff name, period and a "Review report" link to the authenticated route, and **no report content or participant details**.
- **R4** private attachments with signed URLs.

**PR #31 recommendation:** merge it as-is first, so `main` matches the live database (it removes drift item 1). Then build R1b as its own PR.

---

## 9. Design-system standardization plan

Continue `ui-design-system.md` (approved). This goal adds:
1. **Shell work** (its batch 3g) moves earlier, into **Phase 4**, because the workspace switcher, contextual sidebar, breadcrumbs and mobile drawer are built once in the new shell.
2. **New templates** for the Admin pages: the hierarchical permission tree, the diff/preview dialog and the audit diff row. These use the same Phase 2 primitives (Tabs, DataTable, Dialog, Drawer, StatusBadge).
3. **Program accents:** one controlled `--workspace-accent` token per program, used only on the workspace switcher chip and the active-item indicator. Navy chrome, blue actions and red for errors stay universal.
4. **Impeccable gates per batch:**
   - `impeccable detect` after every PR
   - `/impeccable critique` on the Admin user profile and one workspace overview
   - `/impeccable harden` for the permission-denied, empty, loading and error states
   - `/impeccable audit` at the end, target ≥17/20
   - `/impeccable document` to refresh DESIGN.md
5. **Coordination:** the Phase 2 primitives are uncommitted in `../NB4HS-App-React-ds`. They need to land (their own PR) before Phase 4 starts, so the shell is built on them rather than duplicating them.
6. **Calendar:** visually preserved (it is the reference). It only adopts the shared tokens. No change to event placement, dates, times or recurrence. Gap noted for you: the calendar does **not** show client `appointments` rows, only `calendar_events` (D11).

---

## 10. Security considerations

- **Layers enforced:**
  - nav (registry)
  - routes (`RequireRoute` on every route)
  - RPCs (`has_permission` at the top of every SECURITY DEFINER function)
  - RLS (`has_permission` plus scope on every table)
  - Storage (policies resolve the parent record's access)
  - exports (export permissions, checked in the RPC that builds the export)
  - reporting RPCs (scope-filtered)
- **Never in the browser:** the service role key, other users' effective permissions (except for admins with `admin.users.view`), and audit values on participant tables (field names only, as today).
- **Sessions:** deactivation bans the user and revokes refresh tokens. The existing `active` checks in every helper block an already-issued JWT at the database within one request.
- **Sensitive participant data:** case notes, intake, documents, demographics and SNAP case notes each sit behind their own `sensitive` permission. Administrators and Executive Oversight do **not** get them by default. This continues the decision already made for SNAP and Staff Reports.
- **Privilege escalation:** handled by the triggers in §4, the protected built-in roles and the last-admin guard. Each is covered by a regression test.
- **Attachments:** private buckets, path = record id, signed URLs with a short expiry, access through the parent record.
- **Audit:** append-only, values recorded for admin tables, actor = `auth.uid()` (never client-supplied), reason required for high-risk actions.

---

## 11. Migration and rollback strategy

1. **Phase 0** clears drift (merge #23, #31; rename or record the 0b file) and ships the security hotfixes.
2. **Phase 1 is behaviour-neutral.** Legacy roles are backfilled from `profiles.role` and `program_staff`, so `my_permissions()` reproduces today's access exactly. A comparison script asserts, for every live user and every nav key, that the legacy rule and the new rule agree **before** anything switches over.
3. **Frontend switch behind a flag.** The app setting `auth_model = legacy | permissions` (server-side) keeps the old `nav.js` path available for one release. Rollback means flipping the flag.
4. **Policies switch module by module** (Phase 3). Each module's migration has a tested down migration restoring the previous policies verbatim. A broken module rolls back alone.
5. **Data is never deleted.** Old columns and tables stay until the final clean-up, after your sign-off.
6. **Testing environment:** the repo has no `supabase/config.toml` or local stack. Options:
   - (a) keep the proven `begin … rollback` dry runs against live (free; what we have done so far)
   - (b) a Supabase branch for full rehearsals (paid per hour)
   - (c) set up the local Supabase CLI and Docker stack

   See D12.
7. **Production:** nothing is applied to the live database or deployed to Vercel without your explicit OK for that step.

---

## 12. Testing plan

| Layer | Tests |
|---|---|
| Resolver (JS) | `lib/permissions.js` mirrors the SQL rules, with table-driven tests for: deny beats grant, program gate, parent gate, widest scope, deny-with-scope narrowing, expiry, archived roles, inactive account, module switched off |
| SQL regression | `supabase/tests/access_*.sql`: impersonate personas through `set local role authenticated` + `request.jwt.claims`. Assert allowed and denied per table, per action, per scope; escalation attempts fail; last-admin guard; audit append-only; storage access |
| Parity | The legacy-vs-new access comparison over all live users (Phase 1 gate) |
| Navigation and routes | Persona snapshots: Marc (Workforce + SNAP + Students, Assessments only if granted), Jasmine (Case Management), Bernard (oversight, no case notes), receptionist, System Administrator. Every route renders or redirects as expected. Every legacy URL redirects |
| Admin UI | Invite, role edit with preview, override, deactivate with confirmation, last-admin block |
| Staff reports | The existing R1 tests, plus multi-program reports, one-per-period, reminder dedupe, email queue (stubbed provider) |
| Design | `impeccable detect`; visual checks at 1440, 768 and 390 in light and dark; axe checks on the new pages |
| CI [new] | A GitHub Actions workflow running `npm ci && npm test && npm run build` on every PR |

---

## 13. Phased implementation sequence

Each phase is one or more PRs. Every migration gets a dry run, then your approval, then it is applied.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Housekeeping and hotfixes** | Merge #31 and #23 (or record 0b), resolve the 0b filename drift, land the design-system Phase 2 PR, add CI, migration `p0_security_hotfixes` (S1–S6, S9, S10, S12) | Repo == live; hotfix regression script passes |
| **1. Data model and authorization foundation** | `p1_access_foundation`, `p1_audit_hardening`, `my_permissions()`, `usePermissions()` hook, `lib/modules.js` registry. Nothing visible changes | Parity script: 0 differences |
| **2. Users, positions, roles** | `admin-users` Edge Function (invite, deactivate, revoke, reset), Admin → Users, user profile (Profile, Positions, Roles tabs), Positions page, Roles list and editor (no permission tree yet) | Admin can invite and deactivate; sessions revoked; audited |
| **3. Program and submodule permissions** | Program Access tab; `p3_policies_*` per module (Students incl. Assessments → Workforce → Case Management → SNAP → Food → shared); fixes S7, S8 | Per-module SQL regression passes; down migrations tested |
| **4. Dynamic navigation and workspaces** | New shell (switcher, contextual sidebar, breadcrumbs, mobile drawer), registry-driven nav, `RequireRoute` everywhere, canonical routes + redirects, Home dashboard, `primary_workspace`; `auth_model` flag | Persona snapshots; every old URL redirects |
| **5. Admin permission management UI** | Detailed Permissions tree with origins, overrides, preview, high-risk confirmations; Programs & Modules page; Access Audit Log; System Settings consolidation | Escalation tests; preview equals post-save state |
| **6. Staff reporting and notifications** | R1b reshape, R2 reminders, R3 email (provider per D9), R4 attachments; Bernard's review flow | Submit → in-app + email to reviewers, with no content in the email |
| **7. Design-system normalization** | Remaining rollout batches of `ui-design-system.md` across all pages, the Admin templates, workspace accents | `impeccable audit` ≥17/20 |
| **8. Security, accessibility and regression** | Full persona sweep, axe, keyboard pass, reduced motion, trilingual overflow; retire legacy roles and the `auth_model` flag; final clean-up migration (drop `workforce_role_access`, departments, `profiles.role` usage) after sign-off | Your sign-off; then a production deploy on your OK |

Phases 2 and 3 can partly overlap, and so can 6 and 7. Phase 4 depends on 1 and the design-system Phase 2 PR.

---

## 14. Decisions needed before Phase 0

| # | Decision | Recommendation |
|---|---|---|
| D1 | Is the inactive "Bernard Georges" administrator profile his account? Confirm by email. May it be reactivated with **Executive Oversight** (not System Administrator)? | Yes, Executive Oversight only |
| D2 | Is **Food Distribution** a program (its own workspace) or part of another? | Its own small program |
| D3 | Should SNAP appear as a top-level program at `/snap` (Outreach as the engine), reversing today's `/snap → /outreach/snap`? | Yes |
| D4 | Initial positions list (the 8 named plus Receptionist / Front Desk?) and who holds which | Send the staff list; nothing will be inferred from names |
| D5 | Should today's administrators keep reading case notes and intake? The legacy mirror preserves it; the target model removes it unless they're granted it | Mirror first, then review each admin in Phase 5 |
| D6 | Team scope: define teams now, or treat "team" as "assigned" until teams are needed? | Treat as assigned; add teams later |
| D7 | Retire R1 `departments` in favour of program modules (§8.2), and one report per period across programs? | Yes |
| D8 | Merge PR #31 as-is first, then reshape in R1b? | Yes |
| D9 | Email provider for invites and report emails | Resend with a verified `nb4hs.org` domain; or defer email and run in-app only |
| D10 | Build the small Students and Case Management **Overview** pages, which don't exist yet (reusing existing data), or omit them until requested? | Omit; land on the Directory or Clients page |
| D11 | Should client appointments show on the Calendar? Not today | Separate follow-up, not in this project |
| D12 | Rehearsal environment: dry runs on live (free), a Supabase branch (paid) or a local stack | Dry runs plus the local stack in Phase 1 |
| D13 | The `profiles.role` single column: keep it as a display-only "legacy role" until Phase 8, then remove it? | Yes |
