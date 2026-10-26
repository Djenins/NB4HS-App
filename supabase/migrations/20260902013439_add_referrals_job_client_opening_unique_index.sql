-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create unique index referrals_job_client_opening_unique on public.referrals (job_client_id, job_opening_id);
