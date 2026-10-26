-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- 1. Prevent self-role-escalation: a BEFORE UPDATE trigger silently
-- reverts role/active to their previous value on any self-update unless
-- the actor is already an administrator. The existing UPDATE policy
-- (profiles_update_own_or_admin) has no column restriction, so any signed
-- in user could otherwise PATCH their own row's role to 'administrator'.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_self_escalation on public.profiles;
create trigger profiles_prevent_self_escalation
before update on public.profiles
for each row
execute function public.prevent_self_role_escalation();

-- 2. job_clients/job_applications: gate to case_manager/job_developer/
-- administrator, matching how case_clients is already restricted to
-- case_manager/administrator. Previously any authenticated user (staff,
-- receptionist) could read/write full job-seeker case data.
drop policy if exists job_clients_select on public.job_clients;
drop policy if exists job_clients_insert on public.job_clients;
drop policy if exists job_clients_update on public.job_clients;
drop policy if exists job_clients_delete on public.job_clients;

create policy job_clients_select on public.job_clients for select to authenticated
  using (has_role(array['case_manager','job_developer','administrator']));
create policy job_clients_insert on public.job_clients for insert to authenticated
  with check (has_role(array['case_manager','job_developer','administrator']));
create policy job_clients_update on public.job_clients for update to authenticated
  using (has_role(array['case_manager','job_developer','administrator']))
  with check (has_role(array['case_manager','job_developer','administrator']));
create policy job_clients_delete on public.job_clients for delete to authenticated
  using (has_role(array['case_manager','job_developer','administrator']));

drop policy if exists job_applications_select on public.job_applications;
drop policy if exists job_applications_insert on public.job_applications;
drop policy if exists job_applications_update on public.job_applications;
drop policy if exists job_applications_delete on public.job_applications;

create policy job_applications_select on public.job_applications for select to authenticated
  using (has_role(array['case_manager','job_developer','administrator']));
create policy job_applications_insert on public.job_applications for insert to authenticated
  with check (has_role(array['case_manager','job_developer','administrator']));
create policy job_applications_update on public.job_applications for update to authenticated
  using (has_role(array['case_manager','job_developer','administrator']))
  with check (has_role(array['case_manager','job_developer','administrator']));
create policy job_applications_delete on public.job_applications for delete to authenticated
  using (has_role(array['case_manager','job_developer','administrator']));

-- 3. appointments: SELECT/INSERT stay open (calendar visibility across
-- staff, and public client-side appointment requests both depend on that),
-- but UPDATE/DELETE are now limited to the assigned staffer or an admin,
-- backing up the "My Caseload" ownership model with real enforcement.
drop policy if exists appointments_update on public.appointments;
drop policy if exists appointments_delete on public.appointments;

create policy appointments_update on public.appointments for update to authenticated
  using (assigned_email = auth.email() or is_admin())
  with check (assigned_email = auth.email() or is_admin());
create policy appointments_delete on public.appointments for delete to authenticated
  using (assigned_email = auth.email() or is_admin());
