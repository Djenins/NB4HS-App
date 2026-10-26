-- Rollback for p3b_workforce_policies: restores the Workforce tables'
-- policies exactly as they were before it (generated from pg_policies on
-- 2026-10-26) and drops its helpers. Not a migration -- run by hand only if
-- p3b has to be undone. The dry run applies it and checks parity again.
-- Order: p3 rollbacks undo in reverse (newest first: p3e, p3d, p3c, p3b, p3a) -- later
-- parts' policies use helpers the earlier parts created.

drop policy employer_activity_insert on public.employer_activity;
create policy employer_activity_insert on public.employer_activity for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employer_activity_select on public.employer_activity;
create policy employer_activity_select on public.employer_activity for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employer_documents_delete on public.employer_documents;
create policy employer_documents_delete on public.employer_documents for delete to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employer_documents_insert on public.employer_documents;
create policy employer_documents_insert on public.employer_documents for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employer_documents_select on public.employer_documents;
create policy employer_documents_select on public.employer_documents for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employer_notes_insert on public.employer_notes;
create policy employer_notes_insert on public.employer_notes for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employer_notes_select on public.employer_notes;
create policy employer_notes_select on public.employer_notes for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employers_delete on public.employers;
create policy employers_delete on public.employers for delete to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employers_insert on public.employers;
create policy employers_insert on public.employers for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employers_select on public.employers;
create policy employers_select on public.employers for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy employers_update on public.employers;
create policy employers_update on public.employers for update to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text])) with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy job_applications_delete on public.job_applications;
create policy job_applications_delete on public.job_applications for delete to authenticated using (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_applications_insert on public.job_applications;
create policy job_applications_insert on public.job_applications for insert to authenticated with check (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_applications_select on public.job_applications;
create policy job_applications_select on public.job_applications for select to authenticated using (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_applications_update on public.job_applications;
create policy job_applications_update on public.job_applications for update to authenticated using (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text])) with check (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_clients_delete on public.job_clients;
create policy job_clients_delete on public.job_clients for delete to authenticated using (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_clients_insert on public.job_clients;
create policy job_clients_insert on public.job_clients for insert to authenticated with check (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_clients_select on public.job_clients;
create policy job_clients_select on public.job_clients for select to authenticated using (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_clients_update on public.job_clients;
create policy job_clients_update on public.job_clients for update to authenticated using (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text])) with check (has_role(ARRAY['case_manager'::text, 'job_developer'::text, 'administrator'::text]));
drop policy job_openings_delete on public.job_openings;
create policy job_openings_delete on public.job_openings for delete to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy job_openings_insert on public.job_openings;
create policy job_openings_insert on public.job_openings for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy job_openings_select on public.job_openings;
create policy job_openings_select on public.job_openings for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy job_openings_update on public.job_openings;
create policy job_openings_update on public.job_openings for update to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text])) with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placement_checkins_delete on public.placement_checkins;
create policy placement_checkins_delete on public.placement_checkins for delete to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placement_checkins_insert on public.placement_checkins;
create policy placement_checkins_insert on public.placement_checkins for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placement_checkins_select on public.placement_checkins;
create policy placement_checkins_select on public.placement_checkins for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placement_checkins_update on public.placement_checkins;
create policy placement_checkins_update on public.placement_checkins for update to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text])) with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placements_delete on public.placements;
create policy placements_delete on public.placements for delete to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placements_insert on public.placements;
create policy placements_insert on public.placements for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placements_select on public.placements;
create policy placements_select on public.placements for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy placements_update on public.placements;
create policy placements_update on public.placements for update to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text])) with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy referrals_delete on public.referrals;
create policy referrals_delete on public.referrals for delete to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy referrals_insert on public.referrals;
create policy referrals_insert on public.referrals for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy referrals_select on public.referrals;
create policy referrals_select on public.referrals for select to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text]));
drop policy referrals_update on public.referrals;
create policy referrals_update on public.referrals for update to authenticated using (has_role(ARRAY['administrator'::text, 'job_developer'::text])) with check (has_role(ARRAY['administrator'::text, 'job_developer'::text]));

drop function public.has_wf(text);
drop function public.has_wf_at(text);
drop function public.has_cm_at(text);
