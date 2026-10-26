-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- prevent_self_role_escalation is a trigger function, not meant to be
-- called directly via PostgREST RPC. Revoke the default execute grants the
-- new function picked up automatically.
revoke execute on function public.prevent_self_role_escalation() from anon, authenticated;
