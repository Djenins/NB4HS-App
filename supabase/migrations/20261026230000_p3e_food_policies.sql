-- Phase 3, part E -- the Food Distribution program's tables move from
-- is_staff() to permissions (plans/unified-access-architecture.md §4, §13
-- Phase 3). NOT YET APPLIED.
--
-- NOBODY'S ACCESS CHANGES (parity-tested, as for p3a). Today every staff
-- account can read and edit households and distributions -- reports and the
-- client profile read them beyond the Food Distribution page -- so, like the
-- Students tables, the legacy roles keep that through participants.view /
-- participants.edit, and a custom role now opens only what it includes:
--
--   food_clients        read   food_distribution.view, or participants.view
--   (households)        add    food_distribution.clients.create, or participants.edit
--                       change / remove  food_distribution.clients.edit, or participants.edit
--   food_distributions  read   food_distribution.view, or participants.view
--                       record / remove  food_distribution.distributions.record, or participants.edit
--
-- Scoped permissions count at program scope or wider (no owner or assignee
-- columns on these tables).
--
-- Rollback: supabase/rollback/p3e_food_policies_down.sql (p3 rollbacks undo
-- in reverse order).

drop policy food_clients_select on public.food_clients;
drop policy food_clients_insert on public.food_clients;
drop policy food_clients_update on public.food_clients;
drop policy food_clients_delete on public.food_clients;
create policy food_clients_select on public.food_clients for select to authenticated
  using ((select public.has_permission_at('food_distribution.view', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.view', 'program')));
create policy food_clients_insert on public.food_clients for insert to authenticated
  with check ((select public.has_permission_at('food_distribution.clients.create', 'program', 'food_distribution'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy food_clients_update on public.food_clients for update to authenticated
  using ((select public.has_permission_at('food_distribution.clients.edit', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.edit', 'program')))
  with check ((select public.has_permission_at('food_distribution.clients.edit', 'program', 'food_distribution'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy food_clients_delete on public.food_clients for delete to authenticated
  using ((select public.has_permission_at('food_distribution.clients.edit', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.edit', 'program')));

drop policy food_distributions_select on public.food_distributions;
drop policy food_distributions_insert on public.food_distributions;
drop policy food_distributions_delete on public.food_distributions;
create policy food_distributions_select on public.food_distributions for select to authenticated
  using ((select public.has_permission_at('food_distribution.view', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.view', 'program')));
create policy food_distributions_insert on public.food_distributions for insert to authenticated
  with check ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
              or (select public.has_permission_at('participants.edit', 'program')));
create policy food_distributions_delete on public.food_distributions for delete to authenticated
  using ((select public.has_permission_at('food_distribution.distributions.record', 'program', 'food_distribution'))
         or (select public.has_permission_at('participants.edit', 'program')));
