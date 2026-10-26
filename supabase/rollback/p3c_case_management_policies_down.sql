-- Rollback for p3c_case_management_policies: restores the policies on
-- clients, case_clients and case_client_notes exactly as they were
-- (generated from pg_policies on 2026-10-26), puts every intake form back on
-- clients, and drops client_intakes. Not a migration -- run by hand only if
-- p3c has to be undone. The dry run applies it and checks parity again.
-- Order: p3 rollbacks undo in reverse (newest first: p3f, p3e, p3d, p3c, p3b, p3a) -- later
-- parts' policies use helpers the earlier parts created.

drop trigger clients_route_intake on public.clients;
update public.clients c set intake_form = i.form, intake_form_saved_at = i.saved_at
from public.client_intakes i where i.client_id = c.id;
drop table public.client_intakes;
drop function public.clients_route_intake();
drop function public.client_intakes_stamp();

drop policy case_client_notes_delete on public.case_client_notes;
create policy case_client_notes_delete on public.case_client_notes for delete to authenticated using (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy case_client_notes_insert on public.case_client_notes;
create policy case_client_notes_insert on public.case_client_notes for insert to authenticated with check (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy case_client_notes_select on public.case_client_notes;
create policy case_client_notes_select on public.case_client_notes for select to authenticated using (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy case_clients_delete on public.case_clients;
create policy case_clients_delete on public.case_clients for delete to authenticated using (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy case_clients_insert on public.case_clients;
create policy case_clients_insert on public.case_clients for insert to authenticated with check (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy case_clients_select on public.case_clients;
create policy case_clients_select on public.case_clients for select to authenticated using (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy case_clients_update on public.case_clients;
create policy case_clients_update on public.case_clients for update to authenticated using (has_role(ARRAY['case_manager'::text, 'administrator'::text])) with check (has_role(ARRAY['case_manager'::text, 'administrator'::text]));
drop policy clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (is_staff());
drop policy clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (is_staff());
drop policy clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (is_staff()) with check (is_staff());
