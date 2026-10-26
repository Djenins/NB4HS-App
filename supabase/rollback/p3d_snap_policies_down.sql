-- Rollback for p3d_snap_policies: restores the SNAP / Outreach tables'
-- policies exactly as they were (generated from pg_policies on 2026-10-26),
-- returns the legacy worker's contacts.view to 'assigned' and drops the
-- helpers. Not a migration -- run by hand only if p3d has to be undone.
-- Order: p3 rollbacks undo in reverse (newest first: p3f, p3e, p3d, p3c, p3b, p3a) -- later
-- parts' policies use helpers the earlier parts created.

drop policy assistance_cases_insert on public.assistance_cases;
create policy assistance_cases_insert on public.assistance_cases for insert to authenticated with check (((created_by = auth.uid()) AND (is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text]))) AND (EXISTS ( SELECT 1
   FROM outreach_contacts oc
  WHERE ((oc.id = assistance_cases.outreach_contact_id) AND (oc.client_id = assistance_cases.client_id) AND (oc.program = assistance_cases.program))))));
drop policy assistance_cases_select on public.assistance_cases;
create policy assistance_cases_select on public.assistance_cases for select to authenticated using ((is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text]))));
drop policy assistance_cases_update on public.assistance_cases;
create policy assistance_cases_update on public.assistance_cases for update to authenticated using ((is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text])))) with check ((is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text]))));
drop policy contact_consents_insert on public.contact_consents;
create policy contact_consents_insert on public.contact_consents for insert to authenticated with check (((captured_by = auth.uid()) AND has_any_program_role(ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text])));
drop policy contact_consents_select on public.contact_consents;
create policy contact_consents_select on public.contact_consents for select to authenticated using (has_any_program_role(ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text]));
drop policy outreach_contacts_insert on public.outreach_contacts;
create policy outreach_contacts_insert on public.outreach_contacts for insert to authenticated with check (has_program_role(program, ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text]));
drop policy outreach_contacts_select on public.outreach_contacts;
create policy outreach_contacts_select on public.outreach_contacts for select to authenticated using (has_program_role(program, ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text]));
drop policy outreach_contacts_update on public.outreach_contacts;
create policy outreach_contacts_update on public.outreach_contacts for update to authenticated using ((has_program_role(program, ARRAY['supervisor'::text, 'program_admin'::text]) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text])))) with check ((has_program_role(program, ARRAY['supervisor'::text, 'program_admin'::text]) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text]))));
drop policy outreach_interactions_insert on public.outreach_interactions;
create policy outreach_interactions_insert on public.outreach_interactions for insert to authenticated with check (((staff_id = auth.uid()) AND (occurred_at <= (now() + '1 day'::interval)) AND has_program_role(program, ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text])));
drop policy outreach_interactions_select on public.outreach_interactions;
create policy outreach_interactions_select on public.outreach_interactions for select to authenticated using (has_program_role(program, ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text]));
drop policy program_case_stages_write on public.program_case_stages;
create policy program_case_stages_write on public.program_case_stages for all to authenticated using (can_manage_program(program)) with check (can_manage_program(program));
drop policy program_case_stages_select on public.program_case_stages;
create policy program_case_stages_select on public.program_case_stages for select to authenticated using ((has_program_role(program, ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text]) OR can_manage_program(program)));
drop policy program_option_sets_insert on public.program_option_sets;
create policy program_option_sets_insert on public.program_option_sets for insert to authenticated with check (can_manage_program(program));
drop policy program_option_sets_select on public.program_option_sets;
create policy program_option_sets_select on public.program_option_sets for select to authenticated using ((has_program_role(program, ARRAY['worker'::text, 'supervisor'::text, 'program_admin'::text]) OR can_manage_program(program)));
drop policy program_option_sets_update on public.program_option_sets;
create policy program_option_sets_update on public.program_option_sets for update to authenticated using (can_manage_program(program)) with check (can_manage_program(program));
drop policy tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert to authenticated with check (((created_by = auth.uid()) AND (source = 'manual'::text) AND (automation_key IS NULL) AND (is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text]))) AND ((case_id IS NULL) OR (EXISTS ( SELECT 1
   FROM assistance_cases c
  WHERE (c.id = tasks.case_id))))));
drop policy tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated using ((is_program_lead(program) OR (((assigned_to = auth.uid()) OR (created_by = auth.uid())) AND has_program_role(program, ARRAY['worker'::text]))));
drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated using ((is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text])))) with check ((is_program_lead(program) OR ((assigned_to = auth.uid()) AND has_program_role(program, ARRAY['worker'::text]))));

update public.role_permissions rp set scope = 'assigned'
from public.roles r
where r.id = rp.role_id and r.key = 'legacy_outreach_worker' and rp.permission_key = 'snap.contacts.view';
drop function public.can_on_record(text, text, uuid, uuid);
drop function public.can_in_program(text, text);
drop function public.outreach_module(text);
