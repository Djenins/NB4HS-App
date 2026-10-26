-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

alter table public.clients
  add column intake_form jsonb,
  add column intake_form_saved_at timestamptz;
