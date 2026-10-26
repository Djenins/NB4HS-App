-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Recurring appointments: rather than an RRULE/cron system, generate one
-- concrete row per occurrence up front (simplest model that fits how
-- appointments are already scheduled/rescheduled/cancelled individually),
-- grouped by a shared series_id so the UI can label them and offer a
-- "cancel the rest of this series" action.
alter table public.appointments add column series_id uuid;
create index appointments_series_id_idx on public.appointments (series_id);
