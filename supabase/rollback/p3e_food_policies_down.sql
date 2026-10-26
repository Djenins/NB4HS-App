-- Rollback for p3e_food_policies: restores the Food Distribution tables'
-- policies exactly as they were (generated from pg_policies on 2026-10-26).
-- Not a migration -- run by hand only if p3e has to be undone.
-- Order: p3 rollbacks undo in reverse (newest first: p3e, p3d, p3c, p3b, p3a) -- later
-- parts' policies use helpers the earlier parts created.

drop policy food_clients_delete on public.food_clients;
create policy food_clients_delete on public.food_clients for delete to authenticated using (is_staff());
drop policy food_clients_insert on public.food_clients;
create policy food_clients_insert on public.food_clients for insert to authenticated with check (is_staff());
drop policy food_clients_select on public.food_clients;
create policy food_clients_select on public.food_clients for select to authenticated using (is_staff());
drop policy food_clients_update on public.food_clients;
create policy food_clients_update on public.food_clients for update to authenticated using (is_staff()) with check (is_staff());
drop policy food_distributions_delete on public.food_distributions;
create policy food_distributions_delete on public.food_distributions for delete to authenticated using (is_staff());
drop policy food_distributions_insert on public.food_distributions;
create policy food_distributions_insert on public.food_distributions for insert to authenticated with check (is_staff());
drop policy food_distributions_select on public.food_distributions;
create policy food_distributions_select on public.food_distributions for select to authenticated using (is_staff());
