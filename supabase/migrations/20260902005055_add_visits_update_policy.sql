-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create policy visits_update on public.visits for update to authenticated using (true) with check (true);
