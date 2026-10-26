-- Phase 3, part F -- the shared tables move from account-type checks to
-- permissions (plans/unified-access-architecture.md §4, §13 Phase 3). The
-- last Phase 3 part. NOT YET APPLIED.
--
-- NOBODY'S ACCESS CHANGES. Several of these policies look at the row (a
-- note's visibility and department, who created an event, whose
-- appointment it is), so the parity test runs in row mode with probe rows
-- for every combination (supabase/tests/p3f_probes.sql).
--
--   visits                   front desk: check-in / check-out / search (read), check-in or
--                            check-out (add), check-out or correct visits (change) -- or participants.edit
--   appointments             read calendar.view · add calendar.events.create ·
--                            change / remove: your own (assigned to your email) with calendar.view,
--                            or calendar.events.manage_all
--   calendar_events          the same, "your own" = you created it
--   client_notes             everyone-visible notes: participants.notes.view · department notes: the
--                            department's own permission (job: workforce.participants.view, case:
--                            case_management.notes.view) · private notes: the author, or
--                            participants.notes.view_private · add: participants.notes.create
--   communications           read participants.notes.view · log participants.notes.create
--   client_documents and     participants.documents.view / .manage
--   the client-documents bucket
--   grants (write)           lists.manage
--   service_grant_tags,      writes: lists.manage, the module's own permission, or participants.edit
--   custom_options,          (today every staff account can change them)
--   disabled_options,
--   courses, case_resources
--   workforce_role_access    change: workforce.settings.manage
--
-- Reads of organization-wide reference data -- option lists, grants and
-- their tags, the resource directory, the Workforce access setting -- stay
-- open to every active staff account (is_staff()): that is the rule, not a
-- leftover. Classes and courses stay readable by the kiosk too.
--
-- New permissions, granted at organization scope to the legacy account
-- types that have this access today (administrator, staff, case manager,
-- job developer -- not receptionist, as now), all marked sensitive:
--   participants.notes.view          notes and the communications log
--   participants.notes.create        add notes, log communications
--   participants.notes.view_private  read others' private notes (administrators today)
--   participants.documents.view      client documents
--   participants.documents.manage    upload and remove client documents
--
-- Rollback: supabase/rollback/p3f_shared_policies_down.sql (p3 rollbacks
-- undo newest first).

-- ======================================================================
-- 1. New participant permissions and their legacy grants
-- ======================================================================
insert into public.permissions (key, module_key, scoped, sensitivity, sort_order, description) values
  ('participants.notes.view', 'participants', true, 'sensitive', 5, 'Client notes and communications log'),
  ('participants.notes.create', 'participants', true, 'sensitive', 6, 'Add client notes and log communications'),
  ('participants.notes.view_private', 'participants', true, 'sensitive', 7, 'Read other staff''s private client notes'),
  ('participants.documents.view', 'participants', true, 'sensitive', 8, 'Client documents'),
  ('participants.documents.manage', 'participants', true, 'sensitive', 9, 'Upload and remove client documents');

insert into public.role_permissions (role_id, permission_key, scope)
select r.id, v.permission_key, 'org'
from (values
  ('legacy_administrator', 'participants.notes.view'), ('legacy_administrator', 'participants.notes.create'),
  ('legacy_administrator', 'participants.notes.view_private'),
  ('legacy_administrator', 'participants.documents.view'), ('legacy_administrator', 'participants.documents.manage'),
  ('legacy_staff', 'participants.notes.view'), ('legacy_staff', 'participants.notes.create'),
  ('legacy_staff', 'participants.documents.view'), ('legacy_staff', 'participants.documents.manage'),
  ('legacy_case_manager', 'participants.notes.view'), ('legacy_case_manager', 'participants.notes.create'),
  ('legacy_case_manager', 'participants.documents.view'), ('legacy_case_manager', 'participants.documents.manage'),
  ('legacy_job_developer', 'participants.notes.view'), ('legacy_job_developer', 'participants.notes.create'),
  ('legacy_job_developer', 'participants.documents.view'), ('legacy_job_developer', 'participants.documents.manage')
) as v(role_key, permission_key)
join public.roles r on r.key = v.role_key;

-- Organization-wide permission at program scope or wider.
create or replace function public.has_org(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission_at(p_key, 'program');
$$;
revoke all on function public.has_org(text) from public, anon;
grant execute on function public.has_org(text) to authenticated;

-- ======================================================================
-- 2. Visits (front desk)
-- ======================================================================
drop policy visits_select on public.visits;
drop policy visits_insert on public.visits;
drop policy visits_update on public.visits;
create policy visits_select on public.visits for select to authenticated
  using ((select public.has_permission('front_desk.checkin')) or (select public.has_permission('front_desk.checkout'))
         or (select public.has_permission('front_desk.visits.search')) or (select public.has_org('participants.view')));
create policy visits_insert on public.visits for insert to authenticated
  with check ((select public.has_permission('front_desk.checkin')) or (select public.has_permission('front_desk.checkout'))
              or (select public.has_org('participants.edit')));
create policy visits_update on public.visits for update to authenticated
  using ((select public.has_permission('front_desk.checkout')) or (select public.has_permission('front_desk.visits.edit'))
         or (select public.has_org('participants.edit')))
  with check ((select public.has_permission('front_desk.checkout')) or (select public.has_permission('front_desk.visits.edit'))
              or (select public.has_org('participants.edit')));

-- ======================================================================
-- 3. Appointments and calendar events
-- ======================================================================
drop policy appointments_select on public.appointments;
drop policy appointments_insert on public.appointments;
drop policy appointments_update on public.appointments;
drop policy appointments_delete on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using ((select public.has_permission('calendar.view')));
create policy appointments_insert on public.appointments for insert to authenticated
  with check ((select public.has_permission('calendar.events.create')));
create policy appointments_update on public.appointments for update to authenticated
  using ((assigned_email = auth.email() and (select public.has_permission('calendar.view')))
         or (select public.has_permission('calendar.events.manage_all')))
  with check ((assigned_email = auth.email() and (select public.has_permission('calendar.view')))
              or (select public.has_permission('calendar.events.manage_all')));
create policy appointments_delete on public.appointments for delete to authenticated
  using ((assigned_email = auth.email() and (select public.has_permission('calendar.view')))
         or (select public.has_permission('calendar.events.manage_all')));

drop policy calendar_events_select_authenticated on public.calendar_events;
drop policy calendar_events_insert_authenticated on public.calendar_events;
drop policy calendar_events_update_own_or_admin on public.calendar_events;
drop policy calendar_events_delete_own_or_admin on public.calendar_events;
create policy calendar_events_select on public.calendar_events for select to authenticated
  using ((select public.has_permission('calendar.view')));
create policy calendar_events_insert on public.calendar_events for insert to authenticated
  with check ((select public.has_permission('calendar.events.create')));
create policy calendar_events_update on public.calendar_events for update to authenticated
  using ((created_by = auth.uid() and (select public.has_permission('calendar.view')))
         or (select public.has_permission('calendar.events.manage_all')))
  with check ((created_by = auth.uid() and (select public.has_permission('calendar.view')))
              or (select public.has_permission('calendar.events.manage_all')));
create policy calendar_events_delete on public.calendar_events for delete to authenticated
  using ((created_by = auth.uid() and (select public.has_permission('calendar.view')))
         or (select public.has_permission('calendar.events.manage_all')));

-- ======================================================================
-- 4. Client notes, communications, documents
-- ======================================================================
drop policy client_notes_select on public.client_notes;
drop policy client_notes_insert on public.client_notes;
create policy client_notes_select on public.client_notes for select to authenticated
  using (case coalesce(visibility, 'all')
    when 'private' then created_by = auth.uid() or (select public.has_org('participants.notes.view_private'))
    when 'department' then case coalesce(department, 'general')
      when 'job' then (select public.has_permission_at('workforce.participants.view', 'program', 'workforce'))
      when 'case' then (select public.has_permission_at('case_management.notes.view', 'program', 'case_management'))
      else (select public.has_org('participants.notes.view')) end
    else (select public.has_org('participants.notes.view')) end);
create policy client_notes_insert on public.client_notes for insert to authenticated
  with check ((select public.has_org('participants.notes.create')));

drop policy communications_select on public.communications;
drop policy communications_insert on public.communications;
create policy communications_select on public.communications for select to authenticated
  using ((select public.has_org('participants.notes.view')));
create policy communications_insert on public.communications for insert to authenticated
  with check ((select public.has_org('participants.notes.create')));

drop policy client_documents_select on public.client_documents;
drop policy client_documents_insert on public.client_documents;
drop policy client_documents_delete on public.client_documents;
create policy client_documents_select on public.client_documents for select to authenticated
  using ((select public.has_org('participants.documents.view')));
create policy client_documents_insert on public.client_documents for insert to authenticated
  with check ((select public.has_org('participants.documents.manage')));
create policy client_documents_delete on public.client_documents for delete to authenticated
  using ((select public.has_org('participants.documents.manage')));

drop policy client_documents_bucket_select on storage.objects;
drop policy client_documents_bucket_insert on storage.objects;
drop policy client_documents_bucket_delete on storage.objects;
create policy client_documents_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and (select public.has_org('participants.documents.view')));
create policy client_documents_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and (select public.has_org('participants.documents.manage')));
create policy client_documents_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and (select public.has_org('participants.documents.manage')));

-- ======================================================================
-- 5. Reference data: reads stay open to staff, writes move to permissions
-- ======================================================================
drop policy grants_write on public.grants;
create policy grants_write on public.grants for all to authenticated
  using ((select public.has_permission('lists.manage'))) with check ((select public.has_permission('lists.manage')));

drop policy service_grant_tags_write on public.service_grant_tags;
create policy service_grant_tags_write on public.service_grant_tags for all to authenticated
  using ((select public.has_permission('lists.manage')) or (select public.has_org('participants.edit')))
  with check ((select public.has_permission('lists.manage')) or (select public.has_org('participants.edit')));

drop policy custom_options_insert on public.custom_options;
drop policy custom_options_delete on public.custom_options;
create policy custom_options_insert on public.custom_options for insert to authenticated
  with check ((select public.has_permission('lists.manage')) or (select public.has_org('participants.edit')));
create policy custom_options_delete on public.custom_options for delete to authenticated
  using ((select public.has_permission('lists.manage')) or (select public.has_org('participants.edit')));

drop policy disabled_options_insert on public.disabled_options;
drop policy disabled_options_delete on public.disabled_options;
create policy disabled_options_insert on public.disabled_options for insert to authenticated
  with check ((select public.has_permission('lists.manage')) or (select public.has_org('participants.edit')));
create policy disabled_options_delete on public.disabled_options for delete to authenticated
  using ((select public.has_permission('lists.manage')) or (select public.has_org('participants.edit')));

drop policy courses_insert on public.courses;
drop policy courses_update on public.courses;
drop policy courses_delete on public.courses;
create policy courses_insert on public.courses for insert to authenticated
  with check ((select public.has_permission('students.classes.manage', 'students')) or (select public.has_org('participants.edit')));
create policy courses_update on public.courses for update to authenticated
  using ((select public.has_permission('students.classes.manage', 'students')) or (select public.has_org('participants.edit')))
  with check ((select public.has_permission('students.classes.manage', 'students')) or (select public.has_org('participants.edit')));
create policy courses_delete on public.courses for delete to authenticated
  using ((select public.has_permission('students.classes.manage', 'students')) or (select public.has_org('participants.edit')));

drop policy case_resources_insert on public.case_resources;
drop policy case_resources_update on public.case_resources;
drop policy case_resources_delete on public.case_resources;
create policy case_resources_insert on public.case_resources for insert to authenticated
  with check ((select public.has_cm_at('case_management.clients.edit')) or (select public.has_org('participants.edit')));
create policy case_resources_update on public.case_resources for update to authenticated
  using ((select public.has_cm_at('case_management.clients.edit')) or (select public.has_org('participants.edit')))
  with check ((select public.has_cm_at('case_management.clients.edit')) or (select public.has_org('participants.edit')));
create policy case_resources_delete on public.case_resources for delete to authenticated
  using ((select public.has_cm_at('case_management.clients.edit')) or (select public.has_org('participants.edit')));

drop policy workforce_role_access_update on public.workforce_role_access;
create policy workforce_role_access_update on public.workforce_role_access for update to authenticated
  using ((select public.has_wf('workforce.settings.manage'))) with check ((select public.has_wf('workforce.settings.manage')));
