-- Phase 3, part D -- the SNAP (Outreach) tables move from program-role
-- checks (has_program_role / is_program_lead / can_manage_program) to
-- permissions (plans/unified-access-architecture.md §4, §13 Phase 3).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026220000), after
-- rolled-back dry runs (row-mode parity up and down, mutation tests).
-- Afterwards on live: reverse row-mode parity matched the old rules on all
-- 6,720 answers except the 45 intended consent answers, and the p1, p2 and
-- p3a checks passed.
--
-- NOBODY'S ACCESS CHANGES. These policies look at the row (who a record is
-- assigned to, who created it), so the parity test evaluates every policy
-- against probe rows covering each combination (supabase/tests/p3d_probes.sql)
-- for every simulated person, before and after.
--
-- A permission's scope decides which rows it opens, per §4 rule 8:
--   program (or org)  every row in the program
--   assigned / team   rows assigned to you (team = assigned until teams exist)
--   own               rows you created -- only where today's rule counts that
--                     (tasks); elsewhere "own" opens nothing yet
-- can_on_record() implements that; can_in_program() is the unscoped check.
-- Both take the row's program ('snap'), so a second Outreach program later
-- gets its own permissions without new policies.
--
--   outreach_contacts      read snap.contacts.view · add .create · change .edit
--   outreach_interactions  read snap.contacts.view (program scope) · log: .create, as yourself
--   assistance_cases       read snap.cases.view · change .edit · open .create (as yourself, real contact)
--   tasks                  read snap.tasks.view (assigned to you or created by you) · add / change .manage
--   contact_consents       read snap.contacts.view · record .create, as yourself
--   program_case_stages,   read snap.view or snap.settings.manage · change snap.settings.manage
--   program_option_sets
--
-- One legacy grant changes to mirror today: an outreach worker can read
-- every contact in their program (the old rule was any program role), so
-- legacy_outreach_worker's snap.contacts.view goes from 'assigned' to
-- 'program'. Changing contacts stays limited to their assigned ones.
--
-- Unchanged here: case notes and stage history (their policies only defer to
-- the case's own), program_staff and programs (the legacy role sources,
-- shared with Staff Reports -- retired in Phase 8).
--
-- Rollback: supabase/rollback/p3d_snap_policies_down.sql.

-- ======================================================================
-- 1. Helpers
-- ======================================================================
-- The app module an Outreach program runs as ('snap' -> 'snap').
create or replace function public.outreach_module(p_program text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select key from public.app_modules where outreach_program = p_program;
$$;

-- Unscoped (or any-scope) permission inside this Outreach program.
create or replace function public.can_in_program(p_key text, p_program text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select m.key is not null and public.has_permission(p_key, m.key)
  from (select public.outreach_module(p_program) as key) m;
$$;

-- Scoped permission on one record: p_assigned is the record's assignee,
-- p_owner its creator where "own" applies (null where it doesn't).
create or replace function public.can_on_record(p_key text, p_program text, p_assigned uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    s.rnk >= 4
    or (s.rnk >= 2 and p_assigned is not null and p_assigned = auth.uid())
    or (s.rnk >= 1 and p_owner is not null and p_owner = auth.uid()),
    false)
  from (select public.access_scope_rank(public.permission_scope(p_key, m.key)) as rnk
        from (select public.outreach_module(p_program) as key) m
        where m.key is not null) s;
$$;

revoke all on function public.outreach_module(text) from public, anon;
revoke all on function public.can_in_program(text, text) from public, anon;
revoke all on function public.can_on_record(text, text, uuid, uuid) from public, anon;
grant execute on function public.outreach_module(text) to authenticated;
grant execute on function public.can_in_program(text, text) to authenticated;
grant execute on function public.can_on_record(text, text, uuid, uuid) to authenticated;

-- ======================================================================
-- 2. The legacy worker reads every contact in the program, as today
-- ======================================================================
update public.role_permissions rp set scope = 'program'
from public.roles r
where r.id = rp.role_id and r.key = 'legacy_outreach_worker' and rp.permission_key = 'snap.contacts.view';

-- ======================================================================
-- 3. Contacts and interactions
-- ======================================================================
drop policy outreach_contacts_select on public.outreach_contacts;
drop policy outreach_contacts_insert on public.outreach_contacts;
drop policy outreach_contacts_update on public.outreach_contacts;
create policy outreach_contacts_select on public.outreach_contacts for select to authenticated
  using (public.can_on_record('snap.contacts.view', program, assigned_to, created_by));
create policy outreach_contacts_insert on public.outreach_contacts for insert to authenticated
  with check (public.can_in_program('snap.contacts.create', program));
create policy outreach_contacts_update on public.outreach_contacts for update to authenticated
  using (public.can_on_record('snap.contacts.edit', program, assigned_to, null))
  with check (public.can_on_record('snap.contacts.edit', program, assigned_to, null));

drop policy outreach_interactions_select on public.outreach_interactions;
drop policy outreach_interactions_insert on public.outreach_interactions;
create policy outreach_interactions_select on public.outreach_interactions for select to authenticated
  using (public.can_on_record('snap.contacts.view', program, null, null));
create policy outreach_interactions_insert on public.outreach_interactions for insert to authenticated
  with check (staff_id = auth.uid() and occurred_at <= now() + interval '1 day'
              and public.can_in_program('snap.contacts.create', program));

-- ======================================================================
-- 4. Cases and tasks
-- ======================================================================
drop policy assistance_cases_select on public.assistance_cases;
drop policy assistance_cases_insert on public.assistance_cases;
drop policy assistance_cases_update on public.assistance_cases;
create policy assistance_cases_select on public.assistance_cases for select to authenticated
  using (public.can_on_record('snap.cases.view', program, assigned_to, null));
create policy assistance_cases_insert on public.assistance_cases for insert to authenticated
  with check (created_by = auth.uid()
              and public.can_on_record('snap.cases.create', program, assigned_to, null)
              and exists (select 1 from public.outreach_contacts oc
                          where oc.id = assistance_cases.outreach_contact_id
                            and oc.client_id = assistance_cases.client_id
                            and oc.program = assistance_cases.program));
create policy assistance_cases_update on public.assistance_cases for update to authenticated
  using (public.can_on_record('snap.cases.edit', program, assigned_to, null))
  with check (public.can_on_record('snap.cases.edit', program, assigned_to, null));

drop policy tasks_select on public.tasks;
drop policy tasks_insert on public.tasks;
drop policy tasks_update on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_on_record('snap.tasks.view', program, assigned_to, created_by));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (created_by = auth.uid() and source = 'manual' and automation_key is null
              and public.can_on_record('snap.tasks.manage', program, assigned_to, null)
              and (case_id is null or exists (select 1 from public.assistance_cases c where c.id = tasks.case_id)));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_on_record('snap.tasks.manage', program, assigned_to, null))
  with check (public.can_on_record('snap.tasks.manage', program, assigned_to, null));

-- ======================================================================
-- 5. Consents (not per program: a client's consent covers every program)
-- ======================================================================
drop policy contact_consents_select on public.contact_consents;
drop policy contact_consents_insert on public.contact_consents;
create policy contact_consents_select on public.contact_consents for select to authenticated
  using ((select public.has_permission('snap.contacts.view')));
create policy contact_consents_insert on public.contact_consents for insert to authenticated
  with check (captured_by = auth.uid() and (select public.has_permission('snap.contacts.create')));

-- ======================================================================
-- 6. Program configuration: case stages and option lists
-- ======================================================================
drop policy program_case_stages_select on public.program_case_stages;
drop policy program_case_stages_write on public.program_case_stages;
create policy program_case_stages_select on public.program_case_stages for select to authenticated
  using (public.can_in_program('snap.view', program) or public.can_in_program('snap.settings.manage', program));
create policy program_case_stages_write on public.program_case_stages for all to authenticated
  using (public.can_in_program('snap.settings.manage', program))
  with check (public.can_in_program('snap.settings.manage', program));

drop policy program_option_sets_select on public.program_option_sets;
drop policy program_option_sets_insert on public.program_option_sets;
drop policy program_option_sets_update on public.program_option_sets;
create policy program_option_sets_select on public.program_option_sets for select to authenticated
  using (public.can_in_program('snap.view', program) or public.can_in_program('snap.settings.manage', program));
create policy program_option_sets_insert on public.program_option_sets for insert to authenticated
  with check (public.can_in_program('snap.settings.manage', program));
create policy program_option_sets_update on public.program_option_sets for update to authenticated
  using (public.can_in_program('snap.settings.manage', program))
  with check (public.can_in_program('snap.settings.manage', program));
