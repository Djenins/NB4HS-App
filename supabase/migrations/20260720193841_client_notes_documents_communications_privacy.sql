-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- client_notes: enforce the `visibility`/`department` columns the UI
-- already presents as privacy controls, but which RLS never checked.
-- "Full staff" = administrator/staff/case_manager/job_developer;
-- receptionist (check-in/out only per their role description) is excluded
-- from all client_notes/client_documents/communications access.
drop policy if exists client_notes_select on public.client_notes;
create policy client_notes_select on public.client_notes for select to authenticated
using (
  case coalesce(visibility, 'all')
    when 'private' then (created_by = auth.uid() or is_admin())
    when 'department' then (
      case coalesce(department, 'general')
        when 'job' then has_role(array['administrator','job_developer'])
        when 'case' then has_role(array['administrator','case_manager'])
        else has_role(array['administrator','staff','case_manager','job_developer'])
      end
    )
    else has_role(array['administrator','staff','case_manager','job_developer'])
  end
);

drop policy if exists client_notes_insert on public.client_notes;
create policy client_notes_insert on public.client_notes for insert to authenticated
with check (has_role(array['administrator','staff','case_manager','job_developer']));

-- client_documents: no visibility/department columns to key off of, so a
-- single "full staff" gate applies to every operation.
drop policy if exists client_documents_select on public.client_documents;
create policy client_documents_select on public.client_documents for select to authenticated
using (has_role(array['administrator','staff','case_manager','job_developer']));

drop policy if exists client_documents_insert on public.client_documents;
create policy client_documents_insert on public.client_documents for insert to authenticated
with check (has_role(array['administrator','staff','case_manager','job_developer']));

drop policy if exists client_documents_delete on public.client_documents;
create policy client_documents_delete on public.client_documents for delete to authenticated
using (has_role(array['administrator','staff','case_manager','job_developer']));

-- communications: same "full staff" gate.
drop policy if exists communications_select on public.communications;
create policy communications_select on public.communications for select to authenticated
using (has_role(array['administrator','staff','case_manager','job_developer']));

drop policy if exists communications_insert on public.communications;
create policy communications_insert on public.communications for insert to authenticated
with check (has_role(array['administrator','staff','case_manager','job_developer']));
