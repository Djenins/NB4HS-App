-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

alter table public.students add column client_id uuid references public.clients(id) on delete cascade;
create index students_client_id_idx on public.students (client_id);
