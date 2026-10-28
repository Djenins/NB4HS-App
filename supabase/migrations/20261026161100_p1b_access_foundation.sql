-- Phase 1, part B -- access data model and authorization foundation
-- (plans/unified-access-architecture.md §3, §4, §5, §11).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026161100), right
-- after part A. supabase/tests/p1_access_check.sql passed against the live
-- database afterwards: every active account's legacy sidebar matches its
-- permissions. is_program_module() was left executable by anon; p1c fixes that.
--
-- BEHAVIOUR-NEUTRAL. No existing policy, function or table changes meaning:
-- nothing in the app or in any RLS policy reads the new tables yet. They are
-- filled from today's rules ("legacy" roles mirroring profiles.role,
-- workforce_role_access and program_staff) and kept in sync by triggers, so
-- when Phases 3-4 switch RLS and navigation over, everyone keeps exactly the
-- access they have now. supabase/tests/p1_parity_check.sql proves that for
-- every live account before anything switches.
--
-- Concepts (kept strictly apart):
--   app_modules        programs, their submodules, shared features, admin
--   permissions        what can be done, one module each ('students.assessments.grade')
--   roles              reusable permission sets (built-in, legacy mirrors, custom)
--   user_roles         who holds which role, optionally for one program only
--   user_program_access the program gate: no program access, no program permission
--   user_permission_overrides individual grants and denies (deny wins)
--   positions          job titles -- describe work, grant nothing
--   teams              for the 'team' record scope (until used, team = assigned)
--   user_effective_permissions the resolved result, rebuilt by triggers; RLS
--                      and the app read this through has_permission() etc.

-- ======================================================================
-- 1. Module registry
-- ======================================================================
create table public.app_modules (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  parent_key text references public.app_modules(key) on delete restrict,
  kind text not null check (kind in ('program', 'submodule', 'shared', 'admin')),
  name_en text not null, name_ht text not null, name_fr text not null,
  description text not null default '',
  icon text,
  sort_order int not null default 100,
  -- false = a catalog entry only: no screens exist, never shown or granted.
  implemented boolean not null default false,
  -- organization switch: false turns the module (and everything under it) off.
  active boolean not null default true,
  -- an Outreach program's configuration row, for programs run by the Outreach engine.
  outreach_program text unique references public.programs(key) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'submodule') = (parent_key is not null)),
  check (parent_key is null or key like parent_key || '.%')
);
create trigger app_modules_set_updated_at before update on public.app_modules
  for each row execute function public.set_updated_at();

insert into public.app_modules (key, parent_key, kind, name_en, name_ht, name_fr, sort_order, implemented, outreach_program) values
  -- programs
  ('workforce', null, 'program', 'Workforce', 'Fòs Travay', 'Main-d''œuvre', 10, true, null),
  ('workforce.overview', 'workforce', 'submodule', 'Overview', 'Apèsi', 'Aperçu', 11, true, null),
  ('workforce.participants', 'workforce', 'submodule', 'Participants', 'Patisipan', 'Participants', 12, true, null),
  ('workforce.jobs', 'workforce', 'submodule', 'Job Opportunities', 'Opòtinite Travay', 'Offres d''emploi', 13, true, null),
  ('workforce.employers', 'workforce', 'submodule', 'Employers', 'Anplwayè', 'Employeurs', 14, true, null),
  ('workforce.matching', 'workforce', 'submodule', 'Matching', 'Matche', 'Correspondance', 15, true, null),
  ('workforce.referrals', 'workforce', 'submodule', 'Applications & Referrals', 'Aplikasyon ak Referans', 'Candidatures et orientations', 16, true, null),
  ('workforce.placements', 'workforce', 'submodule', 'Placements & Follow-ups', 'Plasman ak Swivi', 'Placements et suivis', 17, true, null),
  ('workforce.reports', 'workforce', 'submodule', 'Reports', 'Rapò', 'Rapports', 18, true, null),
  ('snap', null, 'program', 'SNAP', 'SNAP', 'SNAP', 20, true, 'snap'),
  ('snap.contacts', 'snap', 'submodule', 'Contacts', 'Kontak', 'Contacts', 21, true, null),
  ('snap.cases', 'snap', 'submodule', 'Assistance Cases', 'Ka Asistans', 'Dossiers d''assistance', 22, true, null),
  ('snap.tasks', 'snap', 'submodule', 'Follow-ups', 'Swivi', 'Suivis', 23, true, null),
  ('students', null, 'program', 'Students', 'Elèv', 'Étudiants', 30, true, null),
  ('students.classes', 'students', 'submodule', 'Classes', 'Klas', 'Cours', 31, true, null),
  ('students.attendance', 'students', 'submodule', 'Attendance', 'Prezans', 'Présence', 32, true, null),
  ('students.assessments', 'students', 'submodule', 'Assessments', 'Evalyasyon', 'Évaluations', 33, true, null),
  ('students.sessions', 'students', 'submodule', 'Sessions', 'Sesyon', 'Sessions', 34, true, null),
  ('case_management', null, 'program', 'Case Management', 'Jesyon Ka', 'Gestion de cas', 40, true, null),
  ('food_distribution', null, 'program', 'Food Distribution', 'Distribisyon Manje', 'Distribution alimentaire', 50, true, null),
  -- shared features
  ('dashboard', null, 'shared', 'Dashboard', 'Tablo', 'Tableau de bord', 100, true, null),
  ('my_caseload', null, 'shared', 'My Caseload', 'Dosye Mwen', 'Mes dossiers', 101, true, null),
  ('front_desk', null, 'shared', 'Front Desk', 'Resepsyon', 'Accueil', 102, true, null),
  ('calendar', null, 'shared', 'Calendar', 'Kalandriye', 'Calendrier', 103, true, null),
  ('participants', null, 'shared', 'Participant Records', 'Dosye Patisipan', 'Dossiers des participants', 104, true, null),
  ('staff_reports', null, 'shared', 'Staff Reports', 'Rapò Anplwaye', 'Rapports du personnel', 105, true, null),
  ('org_reports', null, 'shared', 'Reports', 'Rapò', 'Rapports', 106, true, null),
  ('lists', null, 'shared', 'Lists', 'Lis', 'Listes', 107, true, null),
  -- administration
  ('admin', null, 'admin', 'Administration', 'Administrasyon', 'Administration', 200, true, null),
  ('admin.users', 'admin', 'submodule', 'Users', 'Itilizatè', 'Utilisateurs', 201, true, null),
  ('admin.roles', 'admin', 'submodule', 'Roles & Permissions', 'Wòl ak Pèmisyon', 'Rôles et autorisations', 202, false, null),
  ('admin.positions', 'admin', 'submodule', 'Staff Positions', 'Pòs Anplwaye', 'Postes du personnel', 203, false, null),
  ('admin.programs', 'admin', 'submodule', 'Programs & Modules', 'Pwogram ak Modil', 'Programmes et modules', 204, false, null),
  ('admin.audit', 'admin', 'submodule', 'Access Audit Log', 'Jounal Odit Aksè', 'Journal d''audit des accès', 205, false, null),
  ('admin.settings', 'admin', 'submodule', 'System Settings', 'Paramèt Sistèm', 'Paramètres du système', 206, true, null);

-- ======================================================================
-- 2. Permission catalog
-- ======================================================================
create table public.permissions (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  module_key text not null references public.app_modules(key) on delete restrict,
  description text not null default '',
  -- does it take a record scope (own .. org)?
  scoped boolean not null default false,
  -- sensitive: participant notes, intake, documents, demographics -- never
  --   implied, never in System Administrator or Executive Oversight by default.
  -- system: administration -- assignable only by a System Administrator.
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'sensitive', 'system')),
  sort_order int not null default 100,
  check (key like module_key || '.%')
);

insert into public.permissions (key, module_key, scoped, sensitivity, sort_order, description) values
  -- Workforce
  ('workforce.view', 'workforce', false, 'normal', 1, 'Open the Workforce program'),
  ('workforce.settings.manage', 'workforce', false, 'normal', 2, 'Manage Workforce settings'),
  ('workforce.overview.view', 'workforce.overview', false, 'normal', 1, 'Workforce dashboard'),
  ('workforce.participants.view', 'workforce.participants', true, 'normal', 1, 'View job-seeker participants'),
  ('workforce.participants.create', 'workforce.participants', true, 'normal', 2, 'Add participants'),
  ('workforce.participants.edit', 'workforce.participants', true, 'normal', 3, 'Edit participants'),
  ('workforce.participants.delete', 'workforce.participants', true, 'normal', 4, 'Remove participants'),
  ('workforce.participants.export', 'workforce.participants', true, 'normal', 5, 'Export participants'),
  ('workforce.jobs.view', 'workforce.jobs', false, 'normal', 1, 'View job openings'),
  ('workforce.jobs.create', 'workforce.jobs', false, 'normal', 2, 'Add job openings'),
  ('workforce.jobs.edit', 'workforce.jobs', false, 'normal', 3, 'Edit job openings'),
  ('workforce.jobs.delete', 'workforce.jobs', false, 'normal', 4, 'Remove job openings'),
  ('workforce.employers.view', 'workforce.employers', false, 'normal', 1, 'View employers'),
  ('workforce.employers.create', 'workforce.employers', false, 'normal', 2, 'Add employers'),
  ('workforce.employers.edit', 'workforce.employers', false, 'normal', 3, 'Edit employers'),
  ('workforce.employers.delete', 'workforce.employers', false, 'normal', 4, 'Remove employers'),
  ('workforce.matching.view', 'workforce.matching', false, 'normal', 1, 'Candidate matching'),
  ('workforce.referrals.view', 'workforce.referrals', true, 'normal', 1, 'View applications and referrals'),
  ('workforce.referrals.create', 'workforce.referrals', true, 'normal', 2, 'Create referrals'),
  ('workforce.referrals.edit', 'workforce.referrals', true, 'normal', 3, 'Update referrals'),
  ('workforce.placements.view', 'workforce.placements', true, 'normal', 1, 'View placements and follow-ups'),
  ('workforce.placements.create', 'workforce.placements', true, 'normal', 2, 'Record placements'),
  ('workforce.placements.edit', 'workforce.placements', true, 'normal', 3, 'Update placements and follow-ups'),
  ('workforce.reports.view', 'workforce.reports', false, 'normal', 1, 'Workforce reports'),
  ('workforce.reports.export', 'workforce.reports', false, 'normal', 2, 'Export Workforce reports'),
  -- SNAP
  ('snap.view', 'snap', false, 'normal', 1, 'Open the SNAP program (dashboard)'),
  ('snap.staff.manage', 'snap', false, 'normal', 2, 'Grant and remove SNAP program staff'),
  ('snap.settings.manage', 'snap', false, 'normal', 3, 'Manage SNAP options and stages'),
  ('snap.reports.view', 'snap', false, 'normal', 4, 'SNAP reports'),
  ('snap.contacts.view', 'snap.contacts', true, 'normal', 1, 'View outreach contacts'),
  ('snap.contacts.create', 'snap.contacts', true, 'normal', 2, 'Add outreach contacts'),
  ('snap.contacts.edit', 'snap.contacts', true, 'normal', 3, 'Edit outreach contacts'),
  ('snap.cases.view', 'snap.cases', true, 'normal', 1, 'View assistance cases'),
  ('snap.cases.create', 'snap.cases', true, 'normal', 2, 'Open assistance cases'),
  ('snap.cases.edit', 'snap.cases', true, 'normal', 3, 'Update assistance cases'),
  ('snap.cases.review', 'snap.cases', true, 'normal', 4, 'Review cases before closure'),
  ('snap.cases.notes.view', 'snap.cases', true, 'sensitive', 5, 'Read case notes'),
  ('snap.tasks.view', 'snap.tasks', true, 'normal', 1, 'View follow-ups'),
  ('snap.tasks.manage', 'snap.tasks', true, 'normal', 2, 'Create and complete follow-ups'),
  -- Students
  ('students.view', 'students', true, 'normal', 1, 'Student directory'),
  ('students.create', 'students', true, 'normal', 2, 'Enroll students'),
  ('students.edit', 'students', true, 'normal', 3, 'Edit students'),
  ('students.delete', 'students', true, 'normal', 4, 'Remove students'),
  ('students.export', 'students', true, 'normal', 5, 'Export students'),
  ('students.classes.view', 'students.classes', false, 'normal', 1, 'View classes'),
  ('students.classes.manage', 'students.classes', false, 'normal', 2, 'Manage classes and classrooms'),
  ('students.attendance.view', 'students.attendance', true, 'normal', 1, 'View attendance'),
  ('students.attendance.manage', 'students.attendance', true, 'normal', 2, 'Record and correct attendance'),
  ('students.sessions.manage', 'students.sessions', false, 'normal', 1, 'Start sessions and view history'),
  ('students.assessments.view', 'students.assessments', true, 'normal', 1, 'View assessments'),
  ('students.assessments.create', 'students.assessments', true, 'normal', 2, 'Record assessments'),
  ('students.assessments.administer', 'students.assessments', true, 'normal', 3, 'Administer assessments'),
  ('students.assessments.grade', 'students.assessments', true, 'normal', 4, 'Grade assessments'),
  ('students.assessments.manage', 'students.assessments', false, 'normal', 5, 'Manage assessment settings'),
  -- Case Management
  ('case_management.view', 'case_management', true, 'normal', 1, 'Case Management clients'),
  ('case_management.clients.create', 'case_management', true, 'normal', 2, 'Add clients'),
  ('case_management.clients.edit', 'case_management', true, 'normal', 3, 'Edit clients'),
  ('case_management.clients.delete', 'case_management', true, 'normal', 4, 'Remove clients'),
  ('case_management.clients.export', 'case_management', true, 'normal', 5, 'Export clients'),
  ('case_management.notes.view', 'case_management', true, 'sensitive', 6, 'Read confidential case notes'),
  ('case_management.notes.create', 'case_management', true, 'sensitive', 7, 'Write case notes'),
  ('case_management.intake.view', 'case_management', true, 'sensitive', 8, 'Read intake forms'),
  ('case_management.intake.edit', 'case_management', true, 'sensitive', 9, 'Fill in intake forms'),
  ('case_management.documents.view', 'case_management', true, 'sensitive', 10, 'Open client documents'),
  ('case_management.documents.upload', 'case_management', true, 'sensitive', 11, 'Upload client documents'),
  ('case_management.documents.delete', 'case_management', true, 'sensitive', 12, 'Delete client documents'),
  ('case_management.appointments.view', 'case_management', true, 'normal', 13, 'View appointments'),
  ('case_management.appointments.manage', 'case_management', true, 'normal', 14, 'Schedule and update appointments'),
  ('case_management.reports.view', 'case_management', false, 'normal', 15, 'Case Management reports'),
  -- Food Distribution
  ('food_distribution.view', 'food_distribution', true, 'normal', 1, 'Food Distribution households'),
  ('food_distribution.clients.create', 'food_distribution', true, 'normal', 2, 'Add households'),
  ('food_distribution.clients.edit', 'food_distribution', true, 'normal', 3, 'Edit households'),
  ('food_distribution.distributions.record', 'food_distribution', true, 'normal', 4, 'Record distributions'),
  ('food_distribution.reports.view', 'food_distribution', false, 'normal', 5, 'Food Distribution reports'),
  -- Shared
  ('dashboard.view', 'dashboard', false, 'normal', 1, 'Personal dashboard'),
  ('my_caseload.view', 'my_caseload', false, 'normal', 1, 'My caseload and appointments'),
  ('front_desk.checkin', 'front_desk', false, 'normal', 1, 'Check visitors and students in'),
  ('front_desk.checkout', 'front_desk', false, 'normal', 2, 'Check visitors out'),
  ('front_desk.visits.search', 'front_desk', false, 'normal', 3, 'Search the visitor log'),
  ('front_desk.visits.edit', 'front_desk', false, 'normal', 4, 'Correct visit records'),
  ('front_desk.qrcode', 'front_desk', false, 'normal', 5, 'Print the check-in QR code'),
  ('calendar.view', 'calendar', false, 'normal', 1, 'Shared calendar'),
  ('calendar.events.create', 'calendar', false, 'normal', 2, 'Add calendar events'),
  ('calendar.events.manage_all', 'calendar', false, 'normal', 3, 'Edit anyone''s calendar events'),
  ('participants.view', 'participants', true, 'normal', 1, 'Unified participant record (contact details)'),
  ('participants.demographics.view', 'participants', true, 'sensitive', 2, 'Demographics and household information'),
  ('participants.merge', 'participants', false, 'normal', 3, 'Merge duplicate participant records'),
  ('staff_reports.submit', 'staff_reports', false, 'normal', 1, 'Write and submit my biweekly reports'),
  ('staff_reports.review', 'staff_reports', false, 'normal', 2, 'Review, acknowledge and return reports'),
  ('staff_reports.view_all', 'staff_reports', false, 'normal', 3, 'See every staff report and the summary'),
  ('staff_reports.export', 'staff_reports', false, 'normal', 4, 'Export the report summary'),
  ('staff_reports.schedule.manage', 'staff_reports', false, 'normal', 5, 'Configure the reporting schedule'),
  ('org_reports.view', 'org_reports', false, 'normal', 1, 'Organization reports'),
  ('org_reports.export', 'org_reports', false, 'normal', 2, 'Export organization reports'),
  ('lists.manage', 'lists', false, 'normal', 1, 'Manage service, staff and classroom lists'),
  -- Administration (all 'system')
  ('admin.view', 'admin', false, 'system', 1, 'Open Administration'),
  ('admin.users.view', 'admin.users', false, 'system', 1, 'View staff accounts and their access'),
  ('admin.users.invite', 'admin.users', false, 'system', 2, 'Invite staff'),
  ('admin.users.edit', 'admin.users', false, 'system', 3, 'Edit staff profiles'),
  ('admin.users.deactivate', 'admin.users', false, 'system', 4, 'Deactivate and reactivate accounts'),
  ('admin.users.revoke_sessions', 'admin.users', false, 'system', 5, 'Sign a user out everywhere'),
  ('admin.roles.view', 'admin.roles', false, 'system', 1, 'View roles'),
  ('admin.roles.manage', 'admin.roles', false, 'system', 2, 'Create and edit roles'),
  ('admin.permissions.assign', 'admin', false, 'system', 2, 'Assign roles, program access and overrides'),
  ('admin.positions.manage', 'admin.positions', false, 'system', 1, 'Manage staff positions'),
  ('admin.programs.manage', 'admin.programs', false, 'system', 1, 'Turn programs and modules on or off'),
  ('admin.audit.view', 'admin.audit', false, 'system', 1, 'Read the access audit log'),
  ('admin.settings.manage', 'admin.settings', false, 'system', 1, 'System settings');

-- ======================================================================
-- 3. Roles
-- ======================================================================
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  kind text not null default 'custom' check (kind in ('builtin', 'legacy', 'custom')),
  -- protected: not editable, not archivable (System Administrator).
  protected boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  scope text check (scope in ('own', 'assigned', 'team', 'program', 'org')),
  primary key (role_id, permission_key)
);
create index role_permissions_permission_idx on public.role_permissions (permission_key);

-- ======================================================================
-- 4. Assignments
-- ======================================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  -- null = in every program the user has access to.
  program_key text references public.app_modules(key) on delete restrict,
  -- legacy_sync rows mirror profiles.role / workforce_role_access /
  -- program_staff and are maintained by sync_legacy_access(); admin rows are
  -- never touched by the sync.
  source text not null default 'admin' check (source in ('admin', 'legacy_sync')),
  granted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null
);
create unique index user_roles_active_uniq on public.user_roles (user_id, role_id, coalesce(program_key, ''))
  where revoked_at is null;
create index user_roles_role_idx on public.user_roles (role_id) where revoked_at is null;

create table public.user_program_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_key text not null references public.app_modules(key) on delete restrict,
  is_primary boolean not null default false,
  source text not null default 'admin' check (source in ('admin', 'legacy_sync')),
  granted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, program_key)
);

create table public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  effect text not null check (effect in ('grant', 'deny')),
  -- grant: the scope granted. deny: null = deny entirely; a scope = deny that
  -- scope and wider (e.g. deny 'program' leaves 'assigned').
  scope text check (scope in ('own', 'assigned', 'team', 'program', 'org')),
  program_key text references public.app_modules(key) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 1000),
  granted_by uuid references public.profiles(id) on delete set null default auth.uid(),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null
);
create index user_permission_overrides_user_idx on public.user_permission_overrides (user_id) where revoked_at is null;

-- ======================================================================
-- 5. Positions and teams (describe work; grant nothing)
-- ======================================================================
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name_en text not null, name_ht text not null, name_fr text not null,
  description text not null default '',
  sort_order int not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger positions_set_updated_at before update on public.positions
  for each row execute function public.set_updated_at();

insert into public.positions (key, name_en, name_ht, name_fr, sort_order) values
  ('outreach_worker', 'Outreach Worker', 'Travayè Kominotè', 'Agent de proximité', 10),
  ('job_developer', 'Job Developer', 'Devlopè Travay', 'Développeur d''emploi', 20),
  ('case_manager', 'Case Manager', 'Jesyonè Ka', 'Gestionnaire de cas', 30),
  ('computer_literacy_instructor', 'Computer Literacy Instructor', 'Enstriktè Konesans Òdinatè', 'Formateur en informatique', 40),
  ('program_coordinator', 'Program Coordinator', 'Kòdonatè Pwogram', 'Coordinateur de programme', 50),
  ('program_director', 'Program Director', 'Direktè Pwogram', 'Directeur de programme', 60),
  ('executive_director', 'Executive Director', 'Direktè Egzekitif', 'Directeur exécutif', 70),
  ('it_administrator', 'IT Administrator', 'Administratè IT', 'Administrateur informatique', 80),
  ('receptionist', 'Receptionist / Front Desk', 'Resepsyonis', 'Réceptionniste / Accueil', 90);

create table public.user_positions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete restrict,
  is_primary boolean not null default false,
  started_on date,
  ended_on date,
  assigned_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (user_id, position_id),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

-- A hint for the admin screen only. Never applied automatically.
create table public.position_role_suggestions (
  position_id uuid not null references public.positions(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (position_id, role_id)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  program_key text not null references public.app_modules(key) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  lead_id uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (team_id, user_id)
);

-- ======================================================================
-- 6. Profiles: workspace and lifecycle fields
-- ======================================================================
alter table public.profiles
  add column primary_workspace text references public.app_modules(key) on delete set null,
  add column invited_at timestamptz,
  add column deactivated_at timestamptz,
  add column deactivated_by uuid references public.profiles(id) on delete set null;

-- ======================================================================
-- 7. Row validation
-- ======================================================================
create or replace function public.access_scope_rank(p_scope text)
returns int
language sql
immutable
set search_path = public
as $$
  select case p_scope when 'own' then 1 when 'assigned' then 2 when 'team' then 3
                      when 'program' then 4 when 'org' then 5 else 0 end;
$$;

create or replace function public.access_scope_name(p_rank int)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['own', 'assigned', 'team', 'program', 'org'])[p_rank];
$$;

create or replace function public.is_program_module(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_modules where key = p_key and kind = 'program');
$$;

-- Scoped permissions need a scope; unscoped ones never carry one; program
-- columns must name a program.
create or replace function public.validate_access_row()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  is_scoped boolean;
begin
  -- One table per branch: plpgsql can't reference a column the row lacks.
  if tg_table_name = 'role_permissions' then
    select scoped into is_scoped from public.permissions where key = new.permission_key;
    if is_scoped and new.scope is null then
      raise exception 'permission % needs a scope', new.permission_key using errcode = '23514';
    end if;
    if not is_scoped and new.scope is not null then
      raise exception 'permission % does not take a scope', new.permission_key using errcode = '23514';
    end if;
    return new;
  end if;
  if tg_table_name = 'user_permission_overrides' then
    select scoped into is_scoped from public.permissions where key = new.permission_key;
    if new.effect = 'grant' and is_scoped and new.scope is null then
      raise exception 'permission % needs a scope', new.permission_key using errcode = '23514';
    end if;
    if not is_scoped and new.scope is not null then
      raise exception 'permission % does not take a scope', new.permission_key using errcode = '23514';
    end if;
  end if;
  -- user_roles, user_permission_overrides, user_program_access, teams
  if new.program_key is not null and not public.is_program_module(new.program_key) then
    raise exception '% is not a program', new.program_key using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_access_row() from public, anon, authenticated;
create trigger role_permissions_validate before insert or update on public.role_permissions
  for each row execute function public.validate_access_row();
create trigger user_permission_overrides_validate before insert or update on public.user_permission_overrides
  for each row execute function public.validate_access_row();
create trigger user_roles_validate before insert or update on public.user_roles
  for each row execute function public.validate_access_row();
create trigger user_program_access_validate before insert or update on public.user_program_access
  for each row execute function public.validate_access_row();
create trigger teams_validate before insert or update on public.teams
  for each row execute function public.validate_access_row();

-- ======================================================================
-- 8. Resolution (plans/unified-access-architecture.md §4)
-- ======================================================================
-- Effective permissions of one user, with where each one comes from.
-- Rules, in order:
--   1. inactive account -> nothing
--   2. module (or any ancestor) inactive or not implemented -> nothing
--   3. program gate: a permission in a program needs user_program_access
--   4. grants: active role assignments (program_key null or this program,
--      role not archived) and active grant overrides; widest scope wins
--   5. deny overrides: no scope = removed; a scope = capped below that scope
--   6. parent gate: a submodule permission needs its parent's '.view'
create or replace function public.compute_effective_permissions(p_user uuid)
returns table (permission_key text, program_key text, scope text, sources jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with recursive
  mods as (
    select m.key, m.parent_key, m.kind, m.key as root, m.kind as root_kind, (m.active and m.implemented) as enabled
    from public.app_modules m where m.parent_key is null
    union all
    select c.key, c.parent_key, c.kind, p.root, p.root_kind, (p.enabled and c.active and c.implemented)
    from public.app_modules c join mods p on c.parent_key = p.key
  ),
  perms as (
    select p.key, p.scoped, m.kind as module_kind, m.parent_key,
           case when m.root_kind = 'program' then m.root else '' end as program_key
    from public.permissions p join mods m on m.key = p.module_key
    where m.enabled
  ),
  me as (
    select id from public.profiles where id = p_user and active
  ),
  programs_ok as (
    select upa.program_key from public.user_program_access upa join me on me.id = upa.user_id
    where upa.revoked_at is null
  ),
  grants as (
    select rp.permission_key, ur.program_key as assignment_program, rp.scope,
           jsonb_build_object('type', 'role', 'role', r.key, 'name', r.name, 'assignment', ur.id,
                              'program', ur.program_key) as source
    from me
    join public.user_roles ur on ur.user_id = me.id
      and ur.revoked_at is null and (ur.expires_at is null or ur.expires_at > now())
    join public.roles r on r.id = ur.role_id and r.archived_at is null
    join public.role_permissions rp on rp.role_id = r.id
    union all
    select o.permission_key, o.program_key, o.scope,
           jsonb_build_object('type', 'override', 'override', o.id, 'reason', o.reason, 'program', o.program_key)
    from me
    join public.user_permission_overrides o on o.user_id = me.id and o.effect = 'grant'
      and o.revoked_at is null and (o.expires_at is null or o.expires_at > now())
  ),
  granted as (
    select p.key as permission_key, p.program_key, p.scoped, p.module_kind, p.parent_key,
           max(public.access_scope_rank(g.scope)) as grant_rank,
           jsonb_agg(g.source) as sources
    from perms p
    join grants g on g.permission_key = p.key
      and (p.program_key = '' or g.assignment_program is null or g.assignment_program = p.program_key)
    where p.program_key = '' or p.program_key in (select program_key from programs_ok)
    group by p.key, p.program_key, p.scoped, p.module_kind, p.parent_key
  ),
  denies as (
    select o.permission_key, o.program_key, o.scope, o.id, o.reason
    from me
    join public.user_permission_overrides o on o.user_id = me.id and o.effect = 'deny'
      and o.revoked_at is null and (o.expires_at is null or o.expires_at > now())
  ),
  capped as (
    select g.permission_key, g.program_key, g.module_kind, g.parent_key, g.scoped,
           case
             when not g.scoped then case when d.full_deny or d.any_deny then 0 else 0 end
             when d.full_deny then -1
             when d.cap_rank is not null then least(g.grant_rank, d.cap_rank - 1)
             else g.grant_rank
           end as final_rank,
           coalesce(d.any_deny, false) as any_deny,
           g.sources || coalesce(d.sources, '[]'::jsonb) as sources
    from granted g
    left join lateral (
      select bool_or(dd.scope is null) as full_deny,
             count(*) > 0 as any_deny,
             min(public.access_scope_rank(dd.scope)) filter (where dd.scope is not null) as cap_rank,
             jsonb_agg(jsonb_build_object('type', 'deny', 'override', dd.id, 'reason', dd.reason, 'scope', dd.scope)) as sources
      from denies dd
      where dd.permission_key = g.permission_key
        and (dd.program_key is null or dd.program_key = g.program_key)
      having count(*) > 0
    ) d on true
  ),
  surviving as (
    select * from capped
    where (scoped and final_rank >= 1) or (not scoped and not any_deny)
  ),
  kept as (
    select s.permission_key, s.program_key, s.final_rank, s.scoped, s.sources
    from surviving s where s.module_kind <> 'submodule'
    union all
    select s.permission_key, s.program_key, s.final_rank, s.scoped, s.sources
    from surviving s
    join kept k on k.permission_key = s.parent_key || '.view' and k.program_key = s.program_key
    where s.module_kind = 'submodule'
  )
  select permission_key, program_key,
         case when scoped then public.access_scope_name(final_rank) end as scope,
         sources
  from kept;
$$;
revoke all on function public.compute_effective_permissions(uuid) from public, anon, authenticated;

create table public.user_effective_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  -- '' for permissions outside any program.
  program_key text not null default '',
  scope text,
  sources jsonb not null default '[]',
  refreshed_at timestamptz not null default now(),
  primary key (user_id, permission_key, program_key)
);

create or replace function public.refresh_effective_permissions(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.user_effective_permissions where user_id = p_user;
  insert into public.user_effective_permissions (user_id, permission_key, program_key, scope, sources)
  select p_user, e.permission_key, e.program_key, e.scope, e.sources
  from public.compute_effective_permissions(p_user) e;
end;
$$;
revoke all on function public.refresh_effective_permissions(uuid) from public, anon, authenticated;

create or replace function public.refresh_all_effective_permissions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  for u in select id from public.profiles loop
    perform public.refresh_effective_permissions(u);
  end loop;
end;
$$;
revoke all on function public.refresh_all_effective_permissions() from public, anon, authenticated;

-- ======================================================================
-- 9. Lookups for RLS and the app
-- ======================================================================
-- Does the signed-in user hold this permission (in this program, if given)?
create or replace function public.has_permission(p_key text, p_program text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_effective_permissions e
    where e.user_id = auth.uid() and e.permission_key = p_key
      and (p_program is null or e.program_key = p_program or e.program_key = '')
  );
$$;

-- The widest scope the signed-in user holds for a scoped permission, or null.
create or replace function public.permission_scope(p_key text, p_program text default null)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.access_scope_name(max(public.access_scope_rank(e.scope)))
  from public.user_effective_permissions e
  where e.user_id = auth.uid() and e.permission_key = p_key
    and (p_program is null or e.program_key = p_program or e.program_key = '');
$$;

-- A System Administrator holds the built-in (or legacy) administrator role.
create or replace function public.is_system_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id and r.archived_at is null
    join public.profiles p on p.id = ur.user_id and p.active
    where ur.user_id = p_user and r.key in ('system_administrator', 'legacy_administrator')
      and ur.revoked_at is null and (ur.expires_at is null or ur.expires_at > now())
  );
$$;

-- The signed-in user's own effective permissions (what the app draws from).
create or replace function public.my_permissions()
returns table (permission_key text, program_key text, scope text)
language sql
stable
security definer
set search_path = public
as $$
  select e.permission_key, e.program_key, e.scope
  from public.user_effective_permissions e
  where e.user_id = auth.uid();
$$;

-- Another user's effective permissions with their origins (admin screens).
create or replace function public.user_permissions(p_user uuid)
returns table (permission_key text, program_key text, scope text, sources jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user <> auth.uid() and not public.has_permission('admin.users.view') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select e.permission_key, e.program_key, e.scope, e.sources
    from public.user_effective_permissions e where e.user_id = p_user;
end;
$$;

revoke all on function public.has_permission(text, text) from public, anon;
revoke all on function public.permission_scope(text, text) from public, anon;
revoke all on function public.is_system_admin(uuid) from public, anon;
revoke all on function public.my_permissions() from public, anon;
revoke all on function public.user_permissions(uuid) from public, anon;
grant execute on function public.has_permission(text, text) to authenticated;
grant execute on function public.permission_scope(text, text) to authenticated;
grant execute on function public.is_system_admin(uuid) to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.user_permissions(uuid) to authenticated;

-- ======================================================================
-- 10. Built-in and legacy roles
-- ======================================================================
insert into public.roles (key, name, description, kind, protected, created_by) values
  ('system_administrator', 'System Administrator',
   'Every administration permission. No confidential participant data unless also given another role.', 'builtin', true, null),
  ('executive_oversight', 'Executive Oversight',
   'Organization-wide reports, staff report review and read-only program overviews. No confidential case notes.', 'builtin', false, null),
  ('legacy_administrator', 'Administrator (legacy)', 'Mirrors the old "administrator" account role exactly.', 'legacy', false, null),
  ('legacy_staff', 'Staff (legacy)', 'Mirrors the old "staff" account role exactly.', 'legacy', false, null),
  ('legacy_receptionist', 'Receptionist (legacy)', 'Mirrors the old "receptionist" account role exactly.', 'legacy', false, null),
  ('legacy_case_manager', 'Case Manager (legacy)', 'Mirrors the old "case_manager" account role exactly.', 'legacy', false, null),
  ('legacy_job_developer', 'Job Developer (legacy)', 'Mirrors the old "job_developer" account role exactly.', 'legacy', false, null),
  ('legacy_workforce_access', 'Workforce Development pages (legacy)', 'Mirrors the old Workforce Development Access setting.', 'legacy', false, null),
  ('legacy_outreach_worker', 'Outreach Worker (legacy)', 'Mirrors the old program role "worker".', 'legacy', false, null),
  ('legacy_outreach_supervisor', 'Outreach Supervisor (legacy)', 'Mirrors the old program role "supervisor".', 'legacy', false, null),
  ('legacy_outreach_program_admin', 'Outreach Program Admin (legacy)', 'Mirrors the old program role "program_admin".', 'legacy', false, null),
  ('legacy_report_reviewer', 'Staff Report Reviewer (legacy)', 'Mirrors the old Staff Reports role "reviewer".', 'legacy', false, null),
  ('legacy_report_program_admin', 'Staff Report Schedule Admin (legacy)', 'Mirrors the old Staff Reports role "program_admin".', 'legacy', false, null);

-- One row per (role, permission, scope). Scope is null for unscoped
-- permissions. The legacy sets reproduce today's navigation exactly
-- (src/lib/nav.js) -- see src/lib/legacyParity.test.js.
insert into public.role_permissions (role_id, permission_key, scope)
select r.id, v.permission_key, v.scope
from (values
  -- System Administrator: administration only.
  ('system_administrator', 'admin.view', null), ('system_administrator', 'admin.users.view', null),
  ('system_administrator', 'admin.users.invite', null), ('system_administrator', 'admin.users.edit', null),
  ('system_administrator', 'admin.users.deactivate', null), ('system_administrator', 'admin.users.revoke_sessions', null),
  ('system_administrator', 'admin.roles.view', null), ('system_administrator', 'admin.roles.manage', null),
  ('system_administrator', 'admin.permissions.assign', null), ('system_administrator', 'admin.positions.manage', null),
  ('system_administrator', 'admin.programs.manage', null), ('system_administrator', 'admin.audit.view', null),
  ('system_administrator', 'admin.settings.manage', null),
  -- Executive Oversight: oversight without confidential notes.
  ('executive_oversight', 'dashboard.view', null), ('executive_oversight', 'calendar.view', null),
  ('executive_oversight', 'org_reports.view', null), ('executive_oversight', 'org_reports.export', null),
  ('executive_oversight', 'staff_reports.submit', null), ('executive_oversight', 'staff_reports.review', null),
  ('executive_oversight', 'staff_reports.view_all', null), ('executive_oversight', 'staff_reports.export', null),
  ('executive_oversight', 'workforce.view', null), ('executive_oversight', 'workforce.overview.view', null),
  ('executive_oversight', 'workforce.reports.view', null), ('executive_oversight', 'snap.view', null),
  ('executive_oversight', 'snap.reports.view', null), ('executive_oversight', 'students.view', 'org'),
  ('executive_oversight', 'students.assessments.view', 'org'), ('executive_oversight', 'case_management.reports.view', null),
  ('executive_oversight', 'food_distribution.reports.view', null),

  -- legacy_administrator: today's administrator.
  ('legacy_administrator', 'dashboard.view', null), ('legacy_administrator', 'my_caseload.view', null),
  ('legacy_administrator', 'front_desk.checkin', null), ('legacy_administrator', 'front_desk.checkout', null),
  ('legacy_administrator', 'front_desk.visits.search', null), ('legacy_administrator', 'front_desk.visits.edit', null),
  ('legacy_administrator', 'front_desk.qrcode', null),
  ('legacy_administrator', 'calendar.view', null), ('legacy_administrator', 'calendar.events.create', null),
  ('legacy_administrator', 'calendar.events.manage_all', null),
  ('legacy_administrator', 'org_reports.view', null), ('legacy_administrator', 'org_reports.export', null),
  ('legacy_administrator', 'lists.manage', null),
  ('legacy_administrator', 'participants.view', 'org'), ('legacy_administrator', 'participants.demographics.view', 'org'),
  ('legacy_administrator', 'participants.merge', null),
  ('legacy_administrator', 'staff_reports.submit', null), ('legacy_administrator', 'staff_reports.schedule.manage', null),
  ('legacy_administrator', 'food_distribution.view', 'program'), ('legacy_administrator', 'food_distribution.clients.create', 'program'),
  ('legacy_administrator', 'food_distribution.clients.edit', 'program'), ('legacy_administrator', 'food_distribution.distributions.record', 'program'),
  ('legacy_administrator', 'food_distribution.reports.view', null),
  ('legacy_administrator', 'students.view', 'program'), ('legacy_administrator', 'students.create', 'program'),
  ('legacy_administrator', 'students.edit', 'program'), ('legacy_administrator', 'students.delete', 'program'),
  ('legacy_administrator', 'students.export', 'program'),
  ('legacy_administrator', 'students.classes.view', null), ('legacy_administrator', 'students.classes.manage', null),
  ('legacy_administrator', 'students.attendance.view', 'program'), ('legacy_administrator', 'students.attendance.manage', 'program'),
  ('legacy_administrator', 'students.sessions.manage', null),
  ('legacy_administrator', 'students.assessments.view', 'program'), ('legacy_administrator', 'students.assessments.create', 'program'),
  ('legacy_administrator', 'students.assessments.administer', 'program'), ('legacy_administrator', 'students.assessments.grade', 'program'),
  ('legacy_administrator', 'students.assessments.manage', null),
  ('legacy_administrator', 'case_management.view', 'program'), ('legacy_administrator', 'case_management.clients.create', 'program'),
  ('legacy_administrator', 'case_management.clients.edit', 'program'), ('legacy_administrator', 'case_management.clients.delete', 'program'),
  ('legacy_administrator', 'case_management.clients.export', 'program'),
  ('legacy_administrator', 'case_management.notes.view', 'program'), ('legacy_administrator', 'case_management.notes.create', 'program'),
  ('legacy_administrator', 'case_management.intake.view', 'program'), ('legacy_administrator', 'case_management.intake.edit', 'program'),
  ('legacy_administrator', 'case_management.documents.view', 'program'), ('legacy_administrator', 'case_management.documents.upload', 'program'),
  ('legacy_administrator', 'case_management.documents.delete', 'program'),
  ('legacy_administrator', 'case_management.appointments.view', 'program'), ('legacy_administrator', 'case_management.appointments.manage', 'program'),
  ('legacy_administrator', 'case_management.reports.view', null),
  ('legacy_administrator', 'workforce.view', null), ('legacy_administrator', 'workforce.settings.manage', null),
  ('legacy_administrator', 'workforce.overview.view', null),
  ('legacy_administrator', 'workforce.participants.view', 'program'), ('legacy_administrator', 'workforce.participants.create', 'program'),
  ('legacy_administrator', 'workforce.participants.edit', 'program'), ('legacy_administrator', 'workforce.participants.delete', 'program'),
  ('legacy_administrator', 'workforce.participants.export', 'program'),
  ('legacy_administrator', 'workforce.jobs.view', null), ('legacy_administrator', 'workforce.jobs.create', null),
  ('legacy_administrator', 'workforce.jobs.edit', null), ('legacy_administrator', 'workforce.jobs.delete', null),
  ('legacy_administrator', 'workforce.employers.view', null), ('legacy_administrator', 'workforce.employers.create', null),
  ('legacy_administrator', 'workforce.employers.edit', null), ('legacy_administrator', 'workforce.employers.delete', null),
  ('legacy_administrator', 'workforce.matching.view', null),
  ('legacy_administrator', 'workforce.referrals.view', 'program'), ('legacy_administrator', 'workforce.referrals.create', 'program'),
  ('legacy_administrator', 'workforce.referrals.edit', 'program'),
  ('legacy_administrator', 'workforce.placements.view', 'program'), ('legacy_administrator', 'workforce.placements.create', 'program'),
  ('legacy_administrator', 'workforce.placements.edit', 'program'),
  ('legacy_administrator', 'workforce.reports.view', null), ('legacy_administrator', 'workforce.reports.export', null),
  -- Administrators manage outreach program staff but hold no case data (O1 rule).
  ('legacy_administrator', 'snap.staff.manage', null), ('legacy_administrator', 'snap.settings.manage', null),
  ('legacy_administrator', 'admin.view', null), ('legacy_administrator', 'admin.users.view', null),
  ('legacy_administrator', 'admin.users.invite', null), ('legacy_administrator', 'admin.users.edit', null),
  ('legacy_administrator', 'admin.users.deactivate', null), ('legacy_administrator', 'admin.users.revoke_sessions', null),
  ('legacy_administrator', 'admin.roles.view', null), ('legacy_administrator', 'admin.roles.manage', null),
  ('legacy_administrator', 'admin.permissions.assign', null), ('legacy_administrator', 'admin.positions.manage', null),
  ('legacy_administrator', 'admin.programs.manage', null), ('legacy_administrator', 'admin.audit.view', null),
  ('legacy_administrator', 'admin.settings.manage', null),

  -- legacy_staff
  ('legacy_staff', 'dashboard.view', null), ('legacy_staff', 'front_desk.checkout', null),
  ('legacy_staff', 'front_desk.visits.search', null), ('legacy_staff', 'org_reports.view', null),
  ('legacy_staff', 'calendar.view', null), ('legacy_staff', 'calendar.events.create', null),
  ('legacy_staff', 'participants.view', 'org'), ('legacy_staff', 'staff_reports.submit', null),
  ('legacy_staff', 'food_distribution.view', 'program'), ('legacy_staff', 'food_distribution.clients.create', 'program'),
  ('legacy_staff', 'food_distribution.clients.edit', 'program'), ('legacy_staff', 'food_distribution.distributions.record', 'program'),

  -- legacy_receptionist
  ('legacy_receptionist', 'front_desk.checkin', null), ('legacy_receptionist', 'front_desk.checkout', null),
  ('legacy_receptionist', 'calendar.view', null), ('legacy_receptionist', 'calendar.events.create', null),
  ('legacy_receptionist', 'staff_reports.submit', null),

  -- legacy_case_manager
  ('legacy_case_manager', 'dashboard.view', null), ('legacy_case_manager', 'my_caseload.view', null),
  ('legacy_case_manager', 'front_desk.checkin', null), ('legacy_case_manager', 'front_desk.checkout', null),
  ('legacy_case_manager', 'front_desk.visits.search', null), ('legacy_case_manager', 'front_desk.qrcode', null),
  ('legacy_case_manager', 'org_reports.view', null), ('legacy_case_manager', 'lists.manage', null),
  ('legacy_case_manager', 'calendar.view', null), ('legacy_case_manager', 'calendar.events.create', null),
  ('legacy_case_manager', 'participants.view', 'org'), ('legacy_case_manager', 'participants.demographics.view', 'org'),
  ('legacy_case_manager', 'staff_reports.submit', null),
  ('legacy_case_manager', 'students.view', 'program'), ('legacy_case_manager', 'students.create', 'program'),
  ('legacy_case_manager', 'students.edit', 'program'), ('legacy_case_manager', 'students.delete', 'program'),
  ('legacy_case_manager', 'students.export', 'program'),
  ('legacy_case_manager', 'students.classes.view', null), ('legacy_case_manager', 'students.classes.manage', null),
  ('legacy_case_manager', 'students.attendance.view', 'program'), ('legacy_case_manager', 'students.attendance.manage', 'program'),
  ('legacy_case_manager', 'students.sessions.manage', null),
  ('legacy_case_manager', 'students.assessments.view', 'program'), ('legacy_case_manager', 'students.assessments.create', 'program'),
  ('legacy_case_manager', 'students.assessments.administer', 'program'), ('legacy_case_manager', 'students.assessments.grade', 'program'),
  ('legacy_case_manager', 'case_management.view', 'program'), ('legacy_case_manager', 'case_management.clients.create', 'program'),
  ('legacy_case_manager', 'case_management.clients.edit', 'program'), ('legacy_case_manager', 'case_management.clients.delete', 'program'),
  ('legacy_case_manager', 'case_management.clients.export', 'program'),
  ('legacy_case_manager', 'case_management.notes.view', 'program'), ('legacy_case_manager', 'case_management.notes.create', 'program'),
  ('legacy_case_manager', 'case_management.intake.view', 'program'), ('legacy_case_manager', 'case_management.intake.edit', 'program'),
  ('legacy_case_manager', 'case_management.documents.view', 'program'), ('legacy_case_manager', 'case_management.documents.upload', 'program'),
  ('legacy_case_manager', 'case_management.documents.delete', 'program'),
  ('legacy_case_manager', 'case_management.appointments.view', 'program'), ('legacy_case_manager', 'case_management.appointments.manage', 'program'),
  ('legacy_case_manager', 'case_management.reports.view', null),

  -- legacy_job_developer
  ('legacy_job_developer', 'dashboard.view', null), ('legacy_job_developer', 'my_caseload.view', null),
  ('legacy_job_developer', 'front_desk.checkin', null), ('legacy_job_developer', 'front_desk.checkout', null),
  ('legacy_job_developer', 'front_desk.visits.search', null), ('legacy_job_developer', 'front_desk.qrcode', null),
  ('legacy_job_developer', 'org_reports.view', null), ('legacy_job_developer', 'lists.manage', null),
  ('legacy_job_developer', 'calendar.view', null), ('legacy_job_developer', 'calendar.events.create', null),
  ('legacy_job_developer', 'participants.view', 'org'), ('legacy_job_developer', 'staff_reports.submit', null),
  ('legacy_job_developer', 'students.view', 'program'), ('legacy_job_developer', 'students.create', 'program'),
  ('legacy_job_developer', 'students.edit', 'program'), ('legacy_job_developer', 'students.delete', 'program'),
  ('legacy_job_developer', 'students.export', 'program'),
  ('legacy_job_developer', 'students.classes.view', null), ('legacy_job_developer', 'students.classes.manage', null),
  ('legacy_job_developer', 'students.attendance.view', 'program'), ('legacy_job_developer', 'students.attendance.manage', 'program'),
  ('legacy_job_developer', 'students.sessions.manage', null),
  ('legacy_job_developer', 'students.assessments.view', 'program'), ('legacy_job_developer', 'students.assessments.create', 'program'),
  ('legacy_job_developer', 'students.assessments.administer', 'program'), ('legacy_job_developer', 'students.assessments.grade', 'program'),
  ('legacy_job_developer', 'workforce.view', null),
  ('legacy_job_developer', 'workforce.participants.view', 'program'), ('legacy_job_developer', 'workforce.participants.create', 'program'),
  ('legacy_job_developer', 'workforce.participants.edit', 'program'), ('legacy_job_developer', 'workforce.participants.delete', 'program'),
  ('legacy_job_developer', 'workforce.participants.export', 'program'),

  -- legacy_workforce_access: the seven Workforce Development pages.
  ('legacy_workforce_access', 'workforce.view', null), ('legacy_workforce_access', 'workforce.overview.view', null),
  ('legacy_workforce_access', 'workforce.jobs.view', null), ('legacy_workforce_access', 'workforce.jobs.create', null),
  ('legacy_workforce_access', 'workforce.jobs.edit', null), ('legacy_workforce_access', 'workforce.jobs.delete', null),
  ('legacy_workforce_access', 'workforce.employers.view', null), ('legacy_workforce_access', 'workforce.employers.create', null),
  ('legacy_workforce_access', 'workforce.employers.edit', null), ('legacy_workforce_access', 'workforce.employers.delete', null),
  ('legacy_workforce_access', 'workforce.matching.view', null),
  ('legacy_workforce_access', 'workforce.referrals.view', 'program'), ('legacy_workforce_access', 'workforce.referrals.create', 'program'),
  ('legacy_workforce_access', 'workforce.referrals.edit', 'program'),
  ('legacy_workforce_access', 'workforce.placements.view', 'program'), ('legacy_workforce_access', 'workforce.placements.create', 'program'),
  ('legacy_workforce_access', 'workforce.placements.edit', 'program'),
  ('legacy_workforce_access', 'workforce.reports.view', null), ('legacy_workforce_access', 'workforce.reports.export', null),

  -- legacy outreach roles (assigned per program).
  ('legacy_outreach_worker', 'snap.view', null),
  ('legacy_outreach_worker', 'snap.contacts.view', 'assigned'), ('legacy_outreach_worker', 'snap.contacts.create', 'assigned'),
  ('legacy_outreach_worker', 'snap.contacts.edit', 'assigned'),
  ('legacy_outreach_worker', 'snap.cases.view', 'assigned'), ('legacy_outreach_worker', 'snap.cases.create', 'assigned'),
  ('legacy_outreach_worker', 'snap.cases.edit', 'assigned'), ('legacy_outreach_worker', 'snap.cases.notes.view', 'assigned'),
  ('legacy_outreach_worker', 'snap.tasks.view', 'assigned'), ('legacy_outreach_worker', 'snap.tasks.manage', 'assigned'),
  ('legacy_outreach_supervisor', 'snap.view', null), ('legacy_outreach_supervisor', 'snap.reports.view', null),
  ('legacy_outreach_supervisor', 'snap.contacts.view', 'program'), ('legacy_outreach_supervisor', 'snap.contacts.create', 'program'),
  ('legacy_outreach_supervisor', 'snap.contacts.edit', 'program'),
  ('legacy_outreach_supervisor', 'snap.cases.view', 'program'), ('legacy_outreach_supervisor', 'snap.cases.create', 'program'),
  ('legacy_outreach_supervisor', 'snap.cases.edit', 'program'), ('legacy_outreach_supervisor', 'snap.cases.review', 'program'),
  ('legacy_outreach_supervisor', 'snap.cases.notes.view', 'program'),
  ('legacy_outreach_supervisor', 'snap.tasks.view', 'program'), ('legacy_outreach_supervisor', 'snap.tasks.manage', 'program'),
  ('legacy_outreach_program_admin', 'snap.view', null), ('legacy_outreach_program_admin', 'snap.reports.view', null),
  ('legacy_outreach_program_admin', 'snap.staff.manage', null), ('legacy_outreach_program_admin', 'snap.settings.manage', null),
  ('legacy_outreach_program_admin', 'snap.contacts.view', 'program'), ('legacy_outreach_program_admin', 'snap.contacts.create', 'program'),
  ('legacy_outreach_program_admin', 'snap.contacts.edit', 'program'),
  ('legacy_outreach_program_admin', 'snap.cases.view', 'program'), ('legacy_outreach_program_admin', 'snap.cases.create', 'program'),
  ('legacy_outreach_program_admin', 'snap.cases.edit', 'program'), ('legacy_outreach_program_admin', 'snap.cases.review', 'program'),
  ('legacy_outreach_program_admin', 'snap.cases.notes.view', 'program'),
  ('legacy_outreach_program_admin', 'snap.tasks.view', 'program'), ('legacy_outreach_program_admin', 'snap.tasks.manage', 'program'),

  -- legacy Staff Reports roles.
  ('legacy_report_reviewer', 'staff_reports.review', null), ('legacy_report_reviewer', 'staff_reports.view_all', null),
  ('legacy_report_reviewer', 'staff_reports.export', null),
  ('legacy_report_program_admin', 'staff_reports.schedule.manage', null)
) as v(role_key, permission_key, scope)
join public.roles r on r.key = v.role_key;

-- ======================================================================
-- 11. Legacy sync: today's rules -> roles and program access
-- ======================================================================
-- Programs each old account role could use (src/lib/nav.js).
create or replace function public.legacy_role_programs(p_role text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_role
    when 'administrator' then array['workforce', 'snap', 'students', 'case_management', 'food_distribution']
    when 'staff' then array['food_distribution']
    when 'case_manager' then array['students', 'case_management']
    when 'job_developer' then array['students', 'workforce']
    else array[]::text[]
  end;
$$;

-- Brings one user's legacy_sync rows in line with profiles.role,
-- workforce_role_access and program_staff. Rows an administrator created
-- (source 'admin') are never touched.
create or replace function public.sync_legacy_access(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  want_roles jsonb := '[]'::jsonb;   -- [{role, program}]
  want_programs text[] := '{}';
begin
  select role into v_role from public.profiles where id = p_user;
  if v_role is null then return; end if;

  want_roles := want_roles || jsonb_build_object('role', 'legacy_' || v_role, 'program', null);
  want_programs := public.legacy_role_programs(v_role);

  if v_role <> 'administrator' and exists (
    select 1 from public.workforce_role_access w where w.role = v_role and w.enabled
  ) then
    want_roles := want_roles || jsonb_build_object('role', 'legacy_workforce_access', 'program', null);
    want_programs := want_programs || array['workforce'];
  end if;

  -- Outreach program roles, per program.
  select want_roles || coalesce(jsonb_agg(jsonb_build_object('role', 'legacy_outreach_' || ps.program_role, 'program', m.key)), '[]'::jsonb),
         want_programs || coalesce(array_agg(m.key), '{}')
    into want_roles, want_programs
  from public.program_staff ps
  join public.app_modules m on m.outreach_program = ps.program
  where ps.user_id = p_user and ps.active;

  -- Staff Reports roles (organization-wide).
  select want_roles || coalesce(jsonb_agg(jsonb_build_object('role', 'legacy_report_' || ps.program_role, 'program', null)), '[]'::jsonb)
    into want_roles
  from public.program_staff ps
  where ps.user_id = p_user and ps.active and ps.program = 'staff_reports';

  -- Roles: revoke legacy rows no longer wanted, add missing ones.
  update public.user_roles ur set revoked_at = now(), revoked_by = auth.uid()
  where ur.user_id = p_user and ur.source = 'legacy_sync' and ur.revoked_at is null
    and not exists (
      select 1 from jsonb_array_elements(want_roles) w join public.roles r on r.key = w->>'role'
      where r.id = ur.role_id and coalesce(w->>'program', '') = coalesce(ur.program_key, '')
    );
  insert into public.user_roles (user_id, role_id, program_key, source, granted_by)
  select distinct p_user, r.id, w->>'program', 'legacy_sync', auth.uid()
  from jsonb_array_elements(want_roles) w
  join public.roles r on r.key = w->>'role'
  where not exists (
    select 1 from public.user_roles ur
    where ur.user_id = p_user and ur.role_id = r.id and ur.revoked_at is null
      and coalesce(ur.program_key, '') = coalesce(w->>'program', '')
  );

  -- Program access: same idea, one row per (user, program).
  update public.user_program_access upa set revoked_at = now(), revoked_by = auth.uid()
  where upa.user_id = p_user and upa.source = 'legacy_sync' and upa.revoked_at is null
    and not (upa.program_key = any (want_programs));
  insert into public.user_program_access (user_id, program_key, source, granted_by)
  select distinct p_user, k, 'legacy_sync', auth.uid() from unnest(want_programs) k
  on conflict (user_id, program_key) do update
    set revoked_at = null, revoked_by = null, granted_at = now(), granted_by = excluded.granted_by
    where user_program_access.source = 'legacy_sync' and user_program_access.revoked_at is not null;
end;
$$;
revoke all on function public.sync_legacy_access(uuid) from public, anon, authenticated;

create or replace function public.sync_legacy_access_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  if tg_table_name = 'profiles' then
    perform public.sync_legacy_access(new.id);
    perform public.refresh_effective_permissions(new.id);
  elsif tg_table_name = 'program_staff' then
    perform public.sync_legacy_access(coalesce(new.user_id, old.user_id));
  elsif tg_table_name = 'workforce_role_access' then
    for u in select id from public.profiles where role = new.role loop
      perform public.sync_legacy_access(u);
    end loop;
  end if;
  return null;
end;
$$;
revoke all on function public.sync_legacy_access_trigger() from public, anon, authenticated;

create trigger profiles_sync_legacy_access after insert or update of role, active on public.profiles
  for each row execute function public.sync_legacy_access_trigger();
create trigger program_staff_sync_legacy_access after insert or update or delete on public.program_staff
  for each row execute function public.sync_legacy_access_trigger();
create trigger workforce_role_access_sync_legacy_access after update of enabled on public.workforce_role_access
  for each row execute function public.sync_legacy_access_trigger();

-- ======================================================================
-- 12. Keeping user_effective_permissions current
-- ======================================================================
create or replace function public.refresh_effective_permissions_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
begin
  if tg_table_name in ('user_roles', 'user_program_access', 'user_permission_overrides') then
    perform public.refresh_effective_permissions(coalesce(new.user_id, old.user_id));
    if tg_op = 'UPDATE' and old.user_id <> new.user_id then
      perform public.refresh_effective_permissions(old.user_id);
    end if;
  elsif tg_table_name = 'role_permissions' then
    for u in select distinct ur.user_id from public.user_roles ur
             where ur.role_id = coalesce(new.role_id, old.role_id) and ur.revoked_at is null loop
      perform public.refresh_effective_permissions(u);
    end loop;
  elsif tg_table_name = 'roles' then
    for u in select distinct ur.user_id from public.user_roles ur
             where ur.role_id = coalesce(new.id, old.id) and ur.revoked_at is null loop
      perform public.refresh_effective_permissions(u);
    end loop;
  else -- app_modules, permissions
    perform public.refresh_all_effective_permissions();
    return null;
  end if;
  return null;
end;
$$;
revoke all on function public.refresh_effective_permissions_trigger() from public, anon, authenticated;

create trigger user_roles_refresh after insert or update or delete on public.user_roles
  for each row execute function public.refresh_effective_permissions_trigger();
create trigger user_program_access_refresh after insert or update or delete on public.user_program_access
  for each row execute function public.refresh_effective_permissions_trigger();
create trigger user_permission_overrides_refresh after insert or update or delete on public.user_permission_overrides
  for each row execute function public.refresh_effective_permissions_trigger();
create trigger role_permissions_refresh after insert or update or delete on public.role_permissions
  for each row execute function public.refresh_effective_permissions_trigger();
create trigger roles_refresh after update of archived_at on public.roles
  for each row execute function public.refresh_effective_permissions_trigger();
create trigger app_modules_refresh after update of active, implemented, parent_key on public.app_modules
  for each statement execute function public.refresh_effective_permissions_trigger();

-- ======================================================================
-- 13. Safeguards: escalation, protected roles, last System Administrator
-- ======================================================================
-- Applies to signed-in clients only (current_user = 'authenticated').
-- Trusted server code -- this migration, the legacy sync, future admin RPCs
-- that do their own checks -- runs as the table owner (SECURITY DEFINER), so
-- the guard itself must run as the invoker to tell the two apart.
create or replace function public.guard_access_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target_user uuid;
  v_role_id uuid;
  v_protected boolean;
  missing text;
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'roles' then
    if tg_op = 'DELETE' then
      raise exception 'roles are archived, not deleted' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and old.protected then
      raise exception 'built-in role % cannot be changed', old.key using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.kind <> old.kind or new.protected <> old.protected or new.key <> old.key) then
      raise exception 'a role''s key, kind and protection are fixed' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' and (new.kind <> 'custom' or new.protected) then
      raise exception 'only custom roles can be created' using errcode = '42501';
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'role_permissions' then
    v_role_id := coalesce(new.role_id, old.role_id);
    select protected into v_protected from public.roles where id = v_role_id;
    if v_protected then
      raise exception 'built-in role permissions cannot be changed' using errcode = '42501';
    end if;
    if tg_op <> 'DELETE' and not public.is_system_admin(me) then
      if (select sensitivity from public.permissions where key = new.permission_key) = 'system' then
        raise exception 'only a System Administrator can add administration permissions' using errcode = '42501';
      end if;
      if not exists (
        select 1 from public.user_effective_permissions e
        where e.user_id = me and e.permission_key = new.permission_key
          and public.access_scope_rank(e.scope) >= public.access_scope_rank(new.scope)
      ) then
        raise exception 'you can only grant permissions you hold yourself (%)', new.permission_key using errcode = '42501';
      end if;
    end if;
    return coalesce(new, old);
  end if;

  -- user_roles, user_program_access, user_permission_overrides
  target_user := coalesce(new.user_id, old.user_id);
  if target_user = me then
    raise exception 'you cannot change your own access' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'access is revoked, not deleted' using errcode = '42501';
  end if;
  if new.source = 'legacy_sync' and (tg_op = 'INSERT' or old.source <> 'legacy_sync') then
    raise exception 'legacy rows are maintained automatically' using errcode = '42501';
  end if;

  if not public.is_system_admin(me) then
    if tg_table_name = 'user_roles' and new.revoked_at is null then
      select string_agg(rp.permission_key, ', ') into missing
      from public.role_permissions rp
      join public.permissions p on p.key = rp.permission_key
      where rp.role_id = new.role_id
        and (p.sensitivity = 'system' or not exists (
          select 1 from public.user_effective_permissions e
          where e.user_id = me and e.permission_key = rp.permission_key
            and public.access_scope_rank(e.scope) >= public.access_scope_rank(rp.scope)
        ));
      if missing is not null then
        raise exception 'this role includes permissions you do not hold: %', missing using errcode = '42501';
      end if;
    elsif tg_table_name = 'user_permission_overrides' and new.effect = 'grant' and new.revoked_at is null then
      if (select sensitivity from public.permissions where key = new.permission_key) = 'system'
         or not exists (
           select 1 from public.user_effective_permissions e
           where e.user_id = me and e.permission_key = new.permission_key
             and public.access_scope_rank(e.scope) >= public.access_scope_rank(new.scope)
         ) then
        raise exception 'you can only grant permissions you hold yourself (%)', new.permission_key using errcode = '42501';
      end if;
    elsif tg_table_name = 'user_program_access' and new.revoked_at is null then
      if not exists (
        select 1 from public.user_program_access mine
        where mine.user_id = me and mine.program_key = new.program_key and mine.revoked_at is null
      ) then
        raise exception 'you can only grant access to programs you can access yourself' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_access_change() from public, anon;

create trigger roles_guard before insert or update or delete on public.roles
  for each row execute function public.guard_access_change();
create trigger role_permissions_guard before insert or update or delete on public.role_permissions
  for each row execute function public.guard_access_change();
create trigger user_roles_guard before insert or update or delete on public.user_roles
  for each row execute function public.guard_access_change();
create trigger user_program_access_guard before insert or update or delete on public.user_program_access
  for each row execute function public.guard_access_change();
create trigger user_permission_overrides_guard before insert or update or delete on public.user_permission_overrides
  for each row execute function public.guard_access_change();

-- At least one active account must keep the right to assign access.
create or replace function public.assert_system_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A brand-new database has no administrator to protect: no active account
  -- and none that was ever made an administrator. Without this the later
  -- migrations can't be replayed from scratch, and the first sign-up on a new
  -- project fails. A deactivated administrator still counts, so switching
  -- off the last active one stays refused.
  if not exists (select 1 from public.profiles where active or role = 'administrator') then
    return null;
  end if;
  if not exists (
    select 1 from public.user_effective_permissions e
    join public.profiles p on p.id = e.user_id and p.active
    where e.permission_key = 'admin.permissions.assign'
  ) then
    raise exception 'this would leave no active System Administrator' using errcode = '42501';
  end if;
  return null;
end;
$$;
revoke all on function public.assert_system_admin_remains() from public, anon, authenticated;


-- ======================================================================
-- 14. Row-level security on the new tables
-- ======================================================================
alter table public.app_modules enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_program_access enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.positions enable row level security;
alter table public.user_positions enable row level security;
alter table public.position_role_suggestions enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.user_effective_permissions enable row level security;

-- The catalog is readable by any active staff member; it holds no personal data.
create policy app_modules_select on public.app_modules for select to authenticated using (public.is_staff());
create policy app_modules_update on public.app_modules for update to authenticated
  using (public.has_permission('admin.programs.manage')) with check (public.has_permission('admin.programs.manage'));
create policy permissions_select on public.permissions for select to authenticated using (public.is_staff());
create policy roles_select on public.roles for select to authenticated using (public.is_staff());
create policy roles_insert on public.roles for insert to authenticated with check (public.has_permission('admin.roles.manage'));
create policy roles_update on public.roles for update to authenticated
  using (public.has_permission('admin.roles.manage')) with check (public.has_permission('admin.roles.manage'));
create policy role_permissions_select on public.role_permissions for select to authenticated using (public.is_staff());
create policy role_permissions_insert on public.role_permissions for insert to authenticated with check (public.has_permission('admin.roles.manage'));
create policy role_permissions_update on public.role_permissions for update to authenticated
  using (public.has_permission('admin.roles.manage')) with check (public.has_permission('admin.roles.manage'));
create policy role_permissions_delete on public.role_permissions for delete to authenticated using (public.has_permission('admin.roles.manage'));

-- Someone's access: themselves, or account administrators.
create policy user_roles_select on public.user_roles for select to authenticated
  using ((user_id = auth.uid() and public.is_staff()) or public.has_permission('admin.users.view'));
create policy user_roles_insert on public.user_roles for insert to authenticated with check (public.has_permission('admin.permissions.assign'));
create policy user_roles_update on public.user_roles for update to authenticated
  using (public.has_permission('admin.permissions.assign')) with check (public.has_permission('admin.permissions.assign'));
create policy user_program_access_select on public.user_program_access for select to authenticated
  using ((user_id = auth.uid() and public.is_staff()) or public.has_permission('admin.users.view'));
create policy user_program_access_insert on public.user_program_access for insert to authenticated with check (public.has_permission('admin.permissions.assign'));
create policy user_program_access_update on public.user_program_access for update to authenticated
  using (public.has_permission('admin.permissions.assign')) with check (public.has_permission('admin.permissions.assign'));
create policy user_permission_overrides_select on public.user_permission_overrides for select to authenticated
  using ((user_id = auth.uid() and public.is_staff()) or public.has_permission('admin.users.view'));
create policy user_permission_overrides_insert on public.user_permission_overrides for insert to authenticated with check (public.has_permission('admin.permissions.assign'));
create policy user_permission_overrides_update on public.user_permission_overrides for update to authenticated
  using (public.has_permission('admin.permissions.assign')) with check (public.has_permission('admin.permissions.assign'));
create policy user_effective_permissions_select on public.user_effective_permissions for select to authenticated
  using ((user_id = auth.uid() and public.is_staff()) or public.has_permission('admin.users.view'));

-- Positions and teams are visible to staff (they appear on profiles).
create policy positions_select on public.positions for select to authenticated using (public.is_staff());
create policy positions_insert on public.positions for insert to authenticated with check (public.has_permission('admin.positions.manage'));
create policy positions_update on public.positions for update to authenticated
  using (public.has_permission('admin.positions.manage')) with check (public.has_permission('admin.positions.manage'));
create policy user_positions_select on public.user_positions for select to authenticated using (public.is_staff());
create policy user_positions_insert on public.user_positions for insert to authenticated with check (public.has_permission('admin.positions.manage'));
create policy user_positions_update on public.user_positions for update to authenticated
  using (public.has_permission('admin.positions.manage')) with check (public.has_permission('admin.positions.manage'));
create policy user_positions_delete on public.user_positions for delete to authenticated using (public.has_permission('admin.positions.manage'));
create policy position_role_suggestions_select on public.position_role_suggestions for select to authenticated using (public.is_staff());
create policy position_role_suggestions_write on public.position_role_suggestions for all to authenticated
  using (public.has_permission('admin.roles.manage')) with check (public.has_permission('admin.roles.manage'));
create policy teams_select on public.teams for select to authenticated using (public.is_staff());
create policy teams_write on public.teams for all to authenticated
  using (public.has_permission('admin.permissions.assign')) with check (public.has_permission('admin.permissions.assign'));
create policy team_members_select on public.team_members for select to authenticated using (public.is_staff());
create policy team_members_write on public.team_members for all to authenticated
  using (public.has_permission('admin.permissions.assign')) with check (public.has_permission('admin.permissions.assign'));

-- The audit log: administrators as before, plus holders of admin.audit.view
-- and the person whose access an entry is about.
drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events for select to authenticated
  using (
    public.is_admin()
    or (program is not null and public.has_program_role(program, array['program_admin']))
    or public.has_permission('admin.audit.view')
    or (subject_user_id = auth.uid() and public.is_staff())
  );

-- ======================================================================
-- 15. Audit the new administration tables
-- ======================================================================
create trigger app_modules_audit after insert or update or delete on public.app_modules
  for each row execute function public.audit_row_change();
create trigger roles_audit after insert or update or delete on public.roles
  for each row execute function public.audit_row_change();
create trigger role_permissions_audit after insert or update or delete on public.role_permissions
  for each row execute function public.audit_row_change();
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function public.audit_row_change();
create trigger user_program_access_audit after insert or update or delete on public.user_program_access
  for each row execute function public.audit_row_change();
create trigger user_permission_overrides_audit after insert or update or delete on public.user_permission_overrides
  for each row execute function public.audit_row_change();
create trigger positions_audit after insert or update or delete on public.positions
  for each row execute function public.audit_row_change();
create trigger user_positions_audit after insert or update or delete on public.user_positions
  for each row execute function public.audit_row_change();
create trigger position_role_suggestions_audit after insert or update or delete on public.position_role_suggestions
  for each row execute function public.audit_row_change();
create trigger teams_audit after insert or update or delete on public.teams
  for each row execute function public.audit_row_change();
create trigger team_members_audit after insert or update or delete on public.team_members
  for each row execute function public.audit_row_change();

-- ======================================================================
-- 16. Backfill: everyone gets exactly today's access
-- ======================================================================
do $$
declare
  u uuid;
begin
  for u in select id from public.profiles loop
    perform public.sync_legacy_access(u);
  end loop;
  perform public.refresh_all_effective_permissions();
end;
$$;

-- Created only after the backfill (on an empty user_roles table they would
-- refuse it). Statement-level, so they run after every row-level refresh.
create trigger zz_profiles_admin_remains after update of role, active on public.profiles
  for each statement execute function public.assert_system_admin_remains();
create trigger zz_user_roles_admin_remains after update or delete on public.user_roles
  for each statement execute function public.assert_system_admin_remains();
create trigger zz_user_permission_overrides_admin_remains after insert or update on public.user_permission_overrides
  for each statement execute function public.assert_system_admin_remains();
create trigger zz_role_permissions_admin_remains after update or delete on public.role_permissions
  for each statement execute function public.assert_system_admin_remains();
create trigger zz_roles_admin_remains after update on public.roles
  for each statement execute function public.assert_system_admin_remains();

-- ======================================================================
-- 17. Preview a change without saving it (admin screens, Phase 5)
-- ======================================================================
-- Applies the proposed changes inside a subtransaction as the caller (so every
-- policy and safeguard above applies), computes the result, then rolls the
-- changes back. Returns before/after rows for the user.
--   p_changes: { "add_roles": [{"role_id": uuid, "program_key": text|null}],
--                "revoke_role_assignments": [uuid],
--                "grant_programs": [text], "revoke_programs": [text],
--                "add_overrides": [{"permission_key","effect","scope","program_key","reason"}],
--                "revoke_overrides": [uuid] }
create or replace function public.preview_effective_permissions(p_user uuid, p_changes jsonb)
returns table (permission_key text, program_key text, before_scope text, after_scope text, change text)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  before_rows jsonb;
  after_rows jsonb;
begin
  if not public.has_permission('admin.users.view') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('k', e.permission_key, 'p', e.program_key, 's', e.scope)), '[]')
    into before_rows from public.user_permissions(p_user) e;

  begin
    insert into public.user_roles (user_id, role_id, program_key)
    select p_user, (x->>'role_id')::uuid, x->>'program_key' from jsonb_array_elements(coalesce(p_changes->'add_roles', '[]')) x;
    update public.user_roles set revoked_at = now(), revoked_by = auth.uid()
    where user_id = p_user and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_changes->'revoke_role_assignments', '[]')) x);
    insert into public.user_program_access (user_id, program_key)
    select p_user, x #>> '{}' from jsonb_array_elements(coalesce(p_changes->'grant_programs', '[]')) x
    on conflict (user_id, program_key) do update set revoked_at = null, revoked_by = null, source = 'admin';
    update public.user_program_access set revoked_at = now(), revoked_by = auth.uid()
    where user_id = p_user and program_key in (select x #>> '{}' from jsonb_array_elements(coalesce(p_changes->'revoke_programs', '[]')) x);
    insert into public.user_permission_overrides (user_id, permission_key, effect, scope, program_key, reason)
    select p_user, x->>'permission_key', x->>'effect', x->>'scope', x->>'program_key', coalesce(x->>'reason', 'preview')
    from jsonb_array_elements(coalesce(p_changes->'add_overrides', '[]')) x;
    update public.user_permission_overrides set revoked_at = now(), revoked_by = auth.uid()
    where user_id = p_user and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(p_changes->'revoke_overrides', '[]')) x);

    select coalesce(jsonb_agg(jsonb_build_object('k', e.permission_key, 'p', e.program_key, 's', e.scope)), '[]')
      into after_rows from public.user_permissions(p_user) e;  -- refreshed by the triggers above
    raise exception 'nb4hs_preview_rollback';
  exception when raise_exception then
    if sqlerrm <> 'nb4hs_preview_rollback' then raise; end if;
  end;

  return query
    with b as (select x->>'k' k, x->>'p' p, x->>'s' s from jsonb_array_elements(before_rows) x),
         a as (select x->>'k' k, x->>'p' p, x->>'s' s from jsonb_array_elements(after_rows) x)
    select coalesce(a.k, b.k), coalesce(a.p, b.p), b.s, a.s,
           case when b.k is null then 'added' when a.k is null then 'removed'
                when a.s is distinct from b.s then 'scope_changed' else 'unchanged' end
    from a full join b on a.k = b.k and a.p = b.p;
end;
$$;
revoke all on function public.preview_effective_permissions(uuid, jsonb) from public, anon;
grant execute on function public.preview_effective_permissions(uuid, jsonb) to authenticated;
