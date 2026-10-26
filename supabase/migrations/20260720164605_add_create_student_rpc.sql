-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create or replace function public.create_student(master_fields jsonb, program_fields jsonb, matched_client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_row public.students;
begin
  if matched_client_id is not null then
    v_client_id := matched_client_id;
  else
    insert into public.clients (first_name, last_name, phone, email, dob, street, city, zip, intake_date)
    values (
      master_fields->>'first_name', master_fields->>'last_name', master_fields->>'phone', master_fields->>'email',
      nullif(master_fields->>'dob','')::date, master_fields->>'street', master_fields->>'city', master_fields->>'zip',
      nullif(master_fields->>'intake_date','')::date
    ) returning id into v_client_id;
  end if;

  insert into public.students (client_id, first_name, last_name, phone, email, street, city, zip, class_key, active)
  values (
    v_client_id, program_fields->>'first_name', program_fields->>'last_name', program_fields->>'phone', program_fields->>'email',
    program_fields->>'street', program_fields->>'city', program_fields->>'zip',
    program_fields->>'class_key', coalesce((program_fields->>'active')::boolean, true)
  ) returning * into v_row;

  return jsonb_build_object('client_id', v_client_id, 'row', to_jsonb(v_row));
end;
$$;

grant execute on function public.create_student(jsonb, jsonb, uuid) to authenticated, service_role;
