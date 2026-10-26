-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create unique index visits_student_date_unique on public.visits (student_id, visit_date) where student_id is not null;
