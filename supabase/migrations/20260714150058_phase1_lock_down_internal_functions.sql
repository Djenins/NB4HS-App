-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- handle_new_user and is_admin are internal helpers (trigger body / RLS
-- policy body respectively) and were never meant to be directly callable
-- as public RPC endpoints -- PostgREST auto-exposes any function in the
-- public schema by default, which the advisor correctly flagged.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, authenticated, public;
