-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Per-class waitlisting: a Waiting List student (class_key IS NULL) can
-- additionally record which specific class they're waiting for a seat in,
-- separate from the flat "not yet placed" bucket that already exists.
-- Cleared automatically if that class is ever deleted.
alter table public.students
  add column waitlisted_for_class_key text references public.classes(key) on delete set null,
  add column waitlisted_at timestamptz;
