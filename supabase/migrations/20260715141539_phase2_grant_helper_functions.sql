-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- has_role/is_admin are SECURITY DEFINER helpers read directly by RLS
-- policies (case_client_notes, profiles) -- Postgres requires the calling
-- role to have EXECUTE on them even though they run as the definer, and
-- phase2_lock_down_functions's blanket "revoke from anon, public" also
-- stripped authenticated's execute grant, breaking every RLS check that
-- calls them (case managers couldn't see their own case_clients).
grant execute on function public.has_role(text[]) to authenticated;
grant execute on function public.is_admin() to authenticated;
