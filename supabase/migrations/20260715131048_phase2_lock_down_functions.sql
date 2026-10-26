-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create or replace function public.next_nb_id()
returns text
language sql
set search_path = public
as $$
  select 'NB-' || lpad(nextval('public.client_number_seq')::text, 5, '0');
$$;

revoke execute on function public.create_case_client(jsonb, jsonb, uuid) from anon, public;
revoke execute on function public.create_job_client(jsonb, jsonb, uuid) from anon, public;
revoke execute on function public.create_food_client(jsonb, jsonb, uuid) from anon, public;
