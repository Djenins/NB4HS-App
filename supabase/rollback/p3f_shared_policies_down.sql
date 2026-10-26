-- Rollback for p3f_shared_policies: restores the shared tables' policies
-- (and the client-documents bucket's) exactly as they were (generated from
-- pg_policies on 2026-10-26), drops the policies p3f added under new names,
-- and removes its permissions and helper. Not a migration -- run by hand only
-- if p3f has to be undone.
-- Order: p3 rollbacks undo in reverse (newest first: p3f, p3e, p3d, p3c, p3b, p3a) -- later
-- parts' policies use helpers the earlier parts created.

-- p3f renamed the calendar_events policies; drop the new names first.
drop policy if exists calendar_events_select on public.calendar_events;
drop policy if exists calendar_events_insert on public.calendar_events;
drop policy if exists calendar_events_update on public.calendar_events;
drop policy if exists calendar_events_delete on public.calendar_events;

drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments for delete to authenticated using ((((assigned_email = auth.email()) AND is_staff()) OR is_admin()));
drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert to authenticated with check (is_staff());
drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated using (is_staff());
drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments for update to authenticated using ((((assigned_email = auth.email()) AND is_staff()) OR is_admin())) with check ((((assigned_email = auth.email()) AND is_staff()) OR is_admin()));
drop policy if exists calendar_events_delete_own_or_admin on public.calendar_events;
create policy calendar_events_delete_own_or_admin on public.calendar_events for delete to authenticated using ((((created_by = auth.uid()) AND is_staff()) OR is_admin()));
drop policy if exists calendar_events_insert_authenticated on public.calendar_events;
create policy calendar_events_insert_authenticated on public.calendar_events for insert to authenticated with check (is_staff());
drop policy if exists calendar_events_select_authenticated on public.calendar_events;
create policy calendar_events_select_authenticated on public.calendar_events for select to authenticated using (is_staff());
drop policy if exists calendar_events_update_own_or_admin on public.calendar_events;
create policy calendar_events_update_own_or_admin on public.calendar_events for update to authenticated using ((((created_by = auth.uid()) AND is_staff()) OR is_admin())) with check ((((created_by = auth.uid()) AND is_staff()) OR is_admin()));
drop policy if exists case_resources_delete on public.case_resources;
create policy case_resources_delete on public.case_resources for delete to authenticated using (is_staff());
drop policy if exists case_resources_insert on public.case_resources;
create policy case_resources_insert on public.case_resources for insert to authenticated with check (is_staff());
drop policy if exists case_resources_update on public.case_resources;
create policy case_resources_update on public.case_resources for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists client_documents_delete on public.client_documents;
create policy client_documents_delete on public.client_documents for delete to authenticated using (has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists client_documents_insert on public.client_documents;
create policy client_documents_insert on public.client_documents for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists client_documents_select on public.client_documents;
create policy client_documents_select on public.client_documents for select to authenticated using (has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists client_notes_insert on public.client_notes;
create policy client_notes_insert on public.client_notes for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists client_notes_select on public.client_notes;
create policy client_notes_select on public.client_notes for select to authenticated using (
CASE COALESCE(visibility, 'all'::text)
    WHEN 'private'::text THEN ((created_by = auth.uid()) OR is_admin())
    WHEN 'department'::text THEN
    CASE COALESCE(department, 'general'::text)
        WHEN 'job'::text THEN has_role(ARRAY['administrator'::text, 'job_developer'::text])
        WHEN 'case'::text THEN has_role(ARRAY['administrator'::text, 'case_manager'::text])
        ELSE has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text])
    END
    ELSE has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text])
END);
drop policy if exists communications_insert on public.communications;
create policy communications_insert on public.communications for insert to authenticated with check (has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists communications_select on public.communications;
create policy communications_select on public.communications for select to authenticated using (has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists courses_delete on public.courses;
create policy courses_delete on public.courses for delete to authenticated using (is_staff());
drop policy if exists courses_insert on public.courses;
create policy courses_insert on public.courses for insert to authenticated with check (is_staff());
drop policy if exists courses_update on public.courses;
create policy courses_update on public.courses for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists custom_options_delete on public.custom_options;
create policy custom_options_delete on public.custom_options for delete to authenticated using (is_staff());
drop policy if exists custom_options_insert on public.custom_options;
create policy custom_options_insert on public.custom_options for insert to authenticated with check (is_staff());
drop policy if exists disabled_options_delete on public.disabled_options;
create policy disabled_options_delete on public.disabled_options for delete to authenticated using (is_staff());
drop policy if exists disabled_options_insert on public.disabled_options;
create policy disabled_options_insert on public.disabled_options for insert to authenticated with check (is_staff());
drop policy if exists grants_write on public.grants;
create policy grants_write on public.grants for all to authenticated using (has_role(ARRAY['administrator'::text, 'case_manager'::text, 'job_developer'::text])) with check (has_role(ARRAY['administrator'::text, 'case_manager'::text, 'job_developer'::text]));
drop policy if exists service_grant_tags_write on public.service_grant_tags;
create policy service_grant_tags_write on public.service_grant_tags for all to authenticated using (is_staff()) with check (is_staff());
drop policy if exists visits_insert on public.visits;
create policy visits_insert on public.visits for insert to authenticated with check (is_staff());
drop policy if exists visits_select on public.visits;
create policy visits_select on public.visits for select to authenticated using (is_staff());
drop policy if exists visits_update on public.visits;
create policy visits_update on public.visits for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists workforce_role_access_update on public.workforce_role_access;
create policy workforce_role_access_update on public.workforce_role_access for update to authenticated using (has_role(ARRAY['administrator'::text])) with check (has_role(ARRAY['administrator'::text]));
drop policy if exists client_documents_bucket_delete on storage.objects;
create policy client_documents_bucket_delete on storage.objects for delete to authenticated using (((bucket_id = 'client-documents'::text) AND has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text])));
drop policy if exists client_documents_bucket_insert on storage.objects;
create policy client_documents_bucket_insert on storage.objects for insert to authenticated with check (((bucket_id = 'client-documents'::text) AND has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text])));
drop policy if exists client_documents_bucket_select on storage.objects;
create policy client_documents_bucket_select on storage.objects for select to authenticated using (((bucket_id = 'client-documents'::text) AND has_role(ARRAY['administrator'::text, 'staff'::text, 'case_manager'::text, 'job_developer'::text])));

delete from public.permissions where key in ('participants.notes.view', 'participants.notes.create',
  'participants.notes.view_private', 'participants.documents.view', 'participants.documents.manage');  -- cascades
drop function public.has_org(text);
