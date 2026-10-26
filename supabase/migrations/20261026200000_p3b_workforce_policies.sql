-- Phase 3, part B -- the Workforce program's tables move from account-type
-- checks to permissions, and that fixes audit finding S7
-- (plans/unified-access-architecture.md §1.2, §2.1, §13 Phase 3).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026200000), after
-- rolled-back dry runs (parity up and down, p3b_s7_check). Afterwards on
-- live: reverse parity (rollback inside a transaction) matched the old rules
-- with today's Workforce settings, differing only by the 780 intended S7
-- answers at all off / all on; the p1, p2 and p3a checks passed.
--
-- S7: the "Workforce Development Access" setting in Settings decides who
-- sees the seven Workforce pages, but the database was hard-coded to
-- administrators and job developers. So a case manager or staff member
-- given the setting saw the pages with no data, and a job developer with
-- the setting off was refused the pages but still let in by the database.
-- After this, the database follows the setting: it reads the same
-- permissions the pages do (legacy_workforce_access, from p1b).
--
-- With the setting as it is today (on for job developers only) NOBODY'S
-- ACCESS CHANGES. The parity test checks that, and checks that with the
-- setting all off or all on the only changes are the intended ones
-- (supabase/tests/p3b_expected.sql):
--   * setting on  -> staff, receptionists and case managers get the
--                    Workforce data their pages show
--   * setting off -> job developers lose employer, job, referral and
--                    placement data, as they already lose those pages
--
--   employers, employer_activity,     workforce.employers.view / create / edit / delete
--   employer_notes, employer_documents  (notes, activity, documents: view to read, edit to add or remove)
--   job_openings                      workforce.jobs.view / create / edit / delete
--   referrals                         workforce.referrals.view / create / edit (edit also removes)
--   placements, placement_checkins    workforce.placements.view / create / edit (edit also removes; check-ins: edit)
--   job_clients (job seekers)         read: workforce.participants.view, or the pages that show job
--                                       seekers (matching, referrals, placements), or case_management.view
--                                     write: workforce.participants.create / edit / delete, or the
--                                       case_management.clients ones (case managers keep what they have)
--   job_applications                  read: workforce.participants.view or case_management.view
--                                     write: workforce.participants.edit or case_management.clients.edit
--
-- Scoped permissions count at program scope or wider (none of these
-- tables has an owner or assignee column yet).
--
-- Rollback: supabase/rollback/p3b_workforce_policies_down.sql restores the
-- old policies verbatim.

-- Unscoped permission in the Workforce program.
create or replace function public.has_wf(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission(p_key, 'workforce');
$$;

-- Scoped Workforce permission at program scope or wider.
create or replace function public.has_wf_at(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission_at(p_key, 'program', 'workforce');
$$;

-- Scoped Case Management permission at program scope or wider.
create or replace function public.has_cm_at(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission_at(p_key, 'program', 'case_management');
$$;

revoke all on function public.has_wf(text) from public, anon;
revoke all on function public.has_wf_at(text) from public, anon;
revoke all on function public.has_cm_at(text) from public, anon;
grant execute on function public.has_wf(text) to authenticated;
grant execute on function public.has_wf_at(text) to authenticated;
grant execute on function public.has_cm_at(text) to authenticated;

-- ======================================================================
-- Employers and what hangs off them
-- ======================================================================
drop policy employers_select on public.employers;
drop policy employers_insert on public.employers;
drop policy employers_update on public.employers;
drop policy employers_delete on public.employers;
create policy employers_select on public.employers for select to authenticated using ((select public.has_wf('workforce.employers.view')));
create policy employers_insert on public.employers for insert to authenticated with check ((select public.has_wf('workforce.employers.create')));
create policy employers_update on public.employers for update to authenticated
  using ((select public.has_wf('workforce.employers.edit'))) with check ((select public.has_wf('workforce.employers.edit')));
create policy employers_delete on public.employers for delete to authenticated using ((select public.has_wf('workforce.employers.delete')));

drop policy employer_activity_select on public.employer_activity;
drop policy employer_activity_insert on public.employer_activity;
create policy employer_activity_select on public.employer_activity for select to authenticated using ((select public.has_wf('workforce.employers.view')));
create policy employer_activity_insert on public.employer_activity for insert to authenticated with check ((select public.has_wf('workforce.employers.edit')));

drop policy employer_notes_select on public.employer_notes;
drop policy employer_notes_insert on public.employer_notes;
create policy employer_notes_select on public.employer_notes for select to authenticated using ((select public.has_wf('workforce.employers.view')));
create policy employer_notes_insert on public.employer_notes for insert to authenticated with check ((select public.has_wf('workforce.employers.edit')));

drop policy employer_documents_select on public.employer_documents;
drop policy employer_documents_insert on public.employer_documents;
drop policy employer_documents_delete on public.employer_documents;
create policy employer_documents_select on public.employer_documents for select to authenticated using ((select public.has_wf('workforce.employers.view')));
create policy employer_documents_insert on public.employer_documents for insert to authenticated with check ((select public.has_wf('workforce.employers.edit')));
create policy employer_documents_delete on public.employer_documents for delete to authenticated using ((select public.has_wf('workforce.employers.edit')));

-- ======================================================================
-- Job openings
-- ======================================================================
drop policy job_openings_select on public.job_openings;
drop policy job_openings_insert on public.job_openings;
drop policy job_openings_update on public.job_openings;
drop policy job_openings_delete on public.job_openings;
create policy job_openings_select on public.job_openings for select to authenticated using ((select public.has_wf('workforce.jobs.view')));
create policy job_openings_insert on public.job_openings for insert to authenticated with check ((select public.has_wf('workforce.jobs.create')));
create policy job_openings_update on public.job_openings for update to authenticated
  using ((select public.has_wf('workforce.jobs.edit'))) with check ((select public.has_wf('workforce.jobs.edit')));
create policy job_openings_delete on public.job_openings for delete to authenticated using ((select public.has_wf('workforce.jobs.delete')));

-- ======================================================================
-- Referrals
-- ======================================================================
drop policy referrals_select on public.referrals;
drop policy referrals_insert on public.referrals;
drop policy referrals_update on public.referrals;
drop policy referrals_delete on public.referrals;
create policy referrals_select on public.referrals for select to authenticated using ((select public.has_wf_at('workforce.referrals.view')));
create policy referrals_insert on public.referrals for insert to authenticated with check ((select public.has_wf_at('workforce.referrals.create')));
create policy referrals_update on public.referrals for update to authenticated
  using ((select public.has_wf_at('workforce.referrals.edit'))) with check ((select public.has_wf_at('workforce.referrals.edit')));
create policy referrals_delete on public.referrals for delete to authenticated using ((select public.has_wf_at('workforce.referrals.edit')));

-- ======================================================================
-- Placements and their check-ins
-- ======================================================================
drop policy placements_select on public.placements;
drop policy placements_insert on public.placements;
drop policy placements_update on public.placements;
drop policy placements_delete on public.placements;
create policy placements_select on public.placements for select to authenticated using ((select public.has_wf_at('workforce.placements.view')));
create policy placements_insert on public.placements for insert to authenticated with check ((select public.has_wf_at('workforce.placements.create')));
create policy placements_update on public.placements for update to authenticated
  using ((select public.has_wf_at('workforce.placements.edit'))) with check ((select public.has_wf_at('workforce.placements.edit')));
create policy placements_delete on public.placements for delete to authenticated using ((select public.has_wf_at('workforce.placements.edit')));

drop policy placement_checkins_select on public.placement_checkins;
drop policy placement_checkins_insert on public.placement_checkins;
drop policy placement_checkins_update on public.placement_checkins;
drop policy placement_checkins_delete on public.placement_checkins;
create policy placement_checkins_select on public.placement_checkins for select to authenticated using ((select public.has_wf_at('workforce.placements.view')));
create policy placement_checkins_insert on public.placement_checkins for insert to authenticated with check ((select public.has_wf_at('workforce.placements.edit')));
create policy placement_checkins_update on public.placement_checkins for update to authenticated
  using ((select public.has_wf_at('workforce.placements.edit'))) with check ((select public.has_wf_at('workforce.placements.edit')));
create policy placement_checkins_delete on public.placement_checkins for delete to authenticated using ((select public.has_wf_at('workforce.placements.edit')));

-- ======================================================================
-- Job seekers and their applications
-- ======================================================================
drop policy job_clients_select on public.job_clients;
drop policy job_clients_insert on public.job_clients;
drop policy job_clients_update on public.job_clients;
drop policy job_clients_delete on public.job_clients;
create policy job_clients_select on public.job_clients for select to authenticated
  using ((select public.has_wf_at('workforce.participants.view')) or (select public.has_wf('workforce.matching.view'))
         or (select public.has_wf_at('workforce.referrals.view')) or (select public.has_wf_at('workforce.placements.view'))
         or (select public.has_cm_at('case_management.view')));
create policy job_clients_insert on public.job_clients for insert to authenticated
  with check ((select public.has_wf_at('workforce.participants.create')) or (select public.has_cm_at('case_management.clients.create')));
create policy job_clients_update on public.job_clients for update to authenticated
  using ((select public.has_wf_at('workforce.participants.edit')) or (select public.has_cm_at('case_management.clients.edit')))
  with check ((select public.has_wf_at('workforce.participants.edit')) or (select public.has_cm_at('case_management.clients.edit')));
create policy job_clients_delete on public.job_clients for delete to authenticated
  using ((select public.has_wf_at('workforce.participants.delete')) or (select public.has_cm_at('case_management.clients.delete')));

drop policy job_applications_select on public.job_applications;
drop policy job_applications_insert on public.job_applications;
drop policy job_applications_update on public.job_applications;
drop policy job_applications_delete on public.job_applications;
create policy job_applications_select on public.job_applications for select to authenticated
  using ((select public.has_wf_at('workforce.participants.view')) or (select public.has_cm_at('case_management.view')));
create policy job_applications_insert on public.job_applications for insert to authenticated
  with check ((select public.has_wf_at('workforce.participants.edit')) or (select public.has_cm_at('case_management.clients.edit')));
create policy job_applications_update on public.job_applications for update to authenticated
  using ((select public.has_wf_at('workforce.participants.edit')) or (select public.has_cm_at('case_management.clients.edit')))
  with check ((select public.has_wf_at('workforce.participants.edit')) or (select public.has_cm_at('case_management.clients.edit')));
create policy job_applications_delete on public.job_applications for delete to authenticated
  using ((select public.has_wf_at('workforce.participants.edit')) or (select public.has_cm_at('case_management.clients.edit')));
