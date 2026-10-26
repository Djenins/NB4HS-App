-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

alter table public.students
  add column pretest_reading text,
  add column posttest_reading text,
  add column dropped_out boolean not null default false,
  add column dropout_date date,
  add column outcome text;
