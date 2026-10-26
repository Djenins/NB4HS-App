-- Stage 0 security hardening, part B of 2 -- TIGHTENS POLICIES.
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026062909),
-- after part A and the kiosk RPC client (PR #22) were live: the old client
-- read visits/students directly as anon, which this removes.
--
-- * Policies that granted every authenticated user (`true`) now require an
--   active staff profile, so an inactive or self-registered account sees
--   nothing.
-- * The anonymous kiosk loses direct SELECT/INSERT on `visits` and SELECT
--   on `students`; it uses part A's kiosk_* RPCs instead.

-- ============ authenticated => active staff ============
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using (id = auth.uid() or is_staff());

drop policy if exists clients_select on public.clients;
drop policy if exists clients_insert on public.clients;
drop policy if exists clients_update on public.clients;
create policy clients_select on public.clients for select to authenticated using (is_staff());
create policy clients_insert on public.clients for insert to authenticated with check (is_staff());
create policy clients_update on public.clients for update to authenticated using (is_staff()) with check (is_staff());

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated using (is_staff());

drop policy if exists calendar_events_select_authenticated on public.calendar_events;
drop policy if exists calendar_events_insert_authenticated on public.calendar_events;
create policy calendar_events_select_authenticated on public.calendar_events for select to authenticated using (is_staff());
create policy calendar_events_insert_authenticated on public.calendar_events for insert to authenticated with check (is_staff());

drop policy if exists classes_insert on public.classes;
drop policy if exists classes_update on public.classes;
drop policy if exists classes_delete on public.classes;
create policy classes_insert on public.classes for insert to authenticated with check (is_staff());
create policy classes_update on public.classes for update to authenticated using (is_staff()) with check (is_staff());
create policy classes_delete on public.classes for delete to authenticated using (is_staff());
-- classes_select stays public: class names/days/instructor are not personal data and the kiosk renders them.

drop policy if exists custom_options_select on public.custom_options;
drop policy if exists custom_options_insert on public.custom_options;
drop policy if exists custom_options_delete on public.custom_options;
create policy custom_options_select on public.custom_options for select to authenticated using (is_staff());
create policy custom_options_insert on public.custom_options for insert to authenticated with check (is_staff());
create policy custom_options_delete on public.custom_options for delete to authenticated using (is_staff());

drop policy if exists disabled_options_select on public.disabled_options;
drop policy if exists disabled_options_insert on public.disabled_options;
drop policy if exists disabled_options_delete on public.disabled_options;
create policy disabled_options_select on public.disabled_options for select to authenticated using (is_staff());
create policy disabled_options_insert on public.disabled_options for insert to authenticated with check (is_staff());
create policy disabled_options_delete on public.disabled_options for delete to authenticated using (is_staff());

drop policy if exists food_clients_select on public.food_clients;
drop policy if exists food_clients_insert on public.food_clients;
drop policy if exists food_clients_update on public.food_clients;
drop policy if exists food_clients_delete on public.food_clients;
create policy food_clients_select on public.food_clients for select to authenticated using (is_staff());
create policy food_clients_insert on public.food_clients for insert to authenticated with check (is_staff());
create policy food_clients_update on public.food_clients for update to authenticated using (is_staff()) with check (is_staff());
create policy food_clients_delete on public.food_clients for delete to authenticated using (is_staff());

drop policy if exists food_distributions_select on public.food_distributions;
drop policy if exists food_distributions_insert on public.food_distributions;
drop policy if exists food_distributions_delete on public.food_distributions;
create policy food_distributions_select on public.food_distributions for select to authenticated using (is_staff());
create policy food_distributions_insert on public.food_distributions for insert to authenticated with check (is_staff());
create policy food_distributions_delete on public.food_distributions for delete to authenticated using (is_staff());

-- Grants are managed on the Manage page (administrator/case_manager/job_developer);
-- any active staff member can still tag a service record with a grant.
drop policy if exists "authenticated read grants" on public.grants;
drop policy if exists "authenticated write grants" on public.grants;
create policy grants_select on public.grants for select to authenticated using (is_staff());
create policy grants_write on public.grants for all to authenticated
  using (has_role(array['administrator', 'case_manager', 'job_developer']))
  with check (has_role(array['administrator', 'case_manager', 'job_developer']));

drop policy if exists "authenticated read service_grant_tags" on public.service_grant_tags;
drop policy if exists "authenticated write service_grant_tags" on public.service_grant_tags;
create policy service_grant_tags_select on public.service_grant_tags for select to authenticated using (is_staff());
create policy service_grant_tags_write on public.service_grant_tags for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists workforce_role_access_select on public.workforce_role_access;
create policy workforce_role_access_select on public.workforce_role_access for select to authenticated using (is_staff());

-- ============ kiosk tables: students / visits ============
drop policy if exists students_select on public.students;
drop policy if exists students_insert on public.students;
drop policy if exists students_update on public.students;
drop policy if exists students_delete on public.students;
create policy students_select on public.students for select to authenticated using (is_staff());
create policy students_insert on public.students for insert to authenticated with check (is_staff());
create policy students_update on public.students for update to authenticated using (is_staff()) with check (is_staff());
create policy students_delete on public.students for delete to authenticated using (is_staff());

drop policy if exists visits_select on public.visits;
drop policy if exists visits_insert on public.visits;
drop policy if exists visits_update on public.visits;
create policy visits_select on public.visits for select to authenticated using (is_staff());
create policy visits_insert on public.visits for insert to authenticated with check (is_staff());
create policy visits_update on public.visits for update to authenticated using (is_staff()) with check (is_staff());
