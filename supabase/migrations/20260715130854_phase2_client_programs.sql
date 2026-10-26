-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- ============ helpers ============
create sequence if not exists public.client_number_seq start 1;

create or replace function public.next_nb_id()
returns text
language sql
as $$
  select 'NB-' || lpad(nextval('public.client_number_seq')::text, 5, '0');
$$;

create or replace function public.has_role(roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = any(roles) and active = true
  );
$$;
revoke execute on function public.has_role(text[]) from anon, authenticated, public;

-- ============ clients (master identity) ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  nb_id text unique not null default public.next_nb_id(),
  first_name text, last_name text, phone text, email text, dob date,
  street text, city text, zip text, state text default 'RI',
  intake_date date, status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clients enable row level security;
create policy "clients_select" on public.clients for select to authenticated using (true);
create policy "clients_insert" on public.clients for insert to authenticated with check (true);
create policy "clients_update" on public.clients for update to authenticated using (true) with check (true);

-- ============ case_clients + case_client_notes (privacy-restricted) ============
create table public.case_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  first_name text, last_name text, phone text, email text,
  street text, city text, zip text, state text default 'RI', intake_date date,
  immigration_status text, dob date, services text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.case_clients enable row level security;
create policy "case_clients_select" on public.case_clients for select to authenticated using (public.has_role(array['case_manager','administrator']));
create policy "case_clients_insert" on public.case_clients for insert to authenticated with check (public.has_role(array['case_manager','administrator']));
create policy "case_clients_update" on public.case_clients for update to authenticated using (public.has_role(array['case_manager','administrator'])) with check (public.has_role(array['case_manager','administrator']));
create policy "case_clients_delete" on public.case_clients for delete to authenticated using (public.has_role(array['case_manager','administrator']));

create table public.case_client_notes (
  id uuid primary key default gen_random_uuid(),
  case_client_id uuid references public.case_clients(id) on delete cascade,
  content text not null,
  note_date date not null default current_date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.case_client_notes enable row level security;
create policy "case_client_notes_select" on public.case_client_notes for select to authenticated using (public.has_role(array['case_manager','administrator']));
create policy "case_client_notes_insert" on public.case_client_notes for insert to authenticated with check (public.has_role(array['case_manager','administrator']));
create policy "case_client_notes_delete" on public.case_client_notes for delete to authenticated using (public.has_role(array['case_manager','administrator']));

-- ============ job_clients + job_applications ============
create table public.job_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  first_name text, last_name text, phone text, email text,
  street text, city text, zip text, state text default 'RI', intake_date date,
  work_permit boolean not null default false,
  work_permit_expiration date,
  has_resume boolean not null default false,
  resume_storage_path text,
  resume_file_name text,
  employment_status text default 'not_started',
  pipeline_stage text default 'resume',
  work_authorization text,
  work_authorization_expiration date,
  transportation text, preferred_language text, secondary_language text,
  barriers text[] not null default '{}',
  services_provided text[] not null default '{}',
  skills text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.job_clients enable row level security;
create policy "job_clients_select" on public.job_clients for select to authenticated using (true);
create policy "job_clients_insert" on public.job_clients for insert to authenticated with check (true);
create policy "job_clients_update" on public.job_clients for update to authenticated using (true) with check (true);
create policy "job_clients_delete" on public.job_clients for delete to authenticated using (true);

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_client_id uuid references public.job_clients(id) on delete cascade,
  company text, position text,
  applied_date date, status text default 'applied',
  next_step_date date, next_step_note text,
  interview_date date, interview_notes text,
  created_at timestamptz not null default now()
);
alter table public.job_applications enable row level security;
create policy "job_applications_select" on public.job_applications for select to authenticated using (true);
create policy "job_applications_insert" on public.job_applications for insert to authenticated with check (true);
create policy "job_applications_update" on public.job_applications for update to authenticated using (true) with check (true);
create policy "job_applications_delete" on public.job_applications for delete to authenticated using (true);

-- ============ food_clients + food_distributions ============
create table public.food_clients (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  first_name text, last_name text, phone text, email text,
  street text, city text, zip text, state text default 'RI', intake_date date,
  household_size text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.food_clients enable row level security;
create policy "food_clients_select" on public.food_clients for select to authenticated using (true);
create policy "food_clients_insert" on public.food_clients for insert to authenticated with check (true);
create policy "food_clients_update" on public.food_clients for update to authenticated using (true) with check (true);
create policy "food_clients_delete" on public.food_clients for delete to authenticated using (true);

create table public.food_distributions (
  id uuid primary key default gen_random_uuid(),
  food_client_id uuid references public.food_clients(id) on delete cascade,
  visit_date date not null default current_date,
  items text, quantity text,
  created_at timestamptz not null default now()
);
alter table public.food_distributions enable row level security;
create policy "food_distributions_select" on public.food_distributions for select to authenticated using (true);
create policy "food_distributions_insert" on public.food_distributions for insert to authenticated with check (true);
create policy "food_distributions_delete" on public.food_distributions for delete to authenticated using (true);

-- ============ appointments ============
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  first_name text, last_name text, phone text, email text,
  appt_date date, appt_time text, reason text,
  assigned_email text,
  meeting_with text check (meeting_with in ('case_manager','job_developer')),
  status text not null default 'requested' check (status in ('requested','scheduled','completed','cancelled')),
  source text not null default 'staff' check (source in ('staff','client')),
  created_at timestamptz not null default now()
);
alter table public.appointments enable row level security;
create policy "appointments_select" on public.appointments for select to authenticated using (true);
create policy "appointments_insert" on public.appointments for insert with check (true);
create policy "appointments_update" on public.appointments for update to authenticated using (true) with check (true);
create policy "appointments_delete" on public.appointments for delete to authenticated using (true);

-- ============ client_notes (unified, general-purpose) ============
create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  content text not null,
  note_date date not null default current_date,
  department text, type text, visibility text default 'all',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.client_notes enable row level security;
create policy "client_notes_select" on public.client_notes for select to authenticated using (true);
create policy "client_notes_insert" on public.client_notes for insert to authenticated with check (true);

-- ============ client_documents ============
create table public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  file_name text, category text,
  storage_path text,
  uploaded_by uuid references public.profiles(id),
  program text,
  created_at timestamptz not null default now()
);
alter table public.client_documents enable row level security;
create policy "client_documents_select" on public.client_documents for select to authenticated using (true);
create policy "client_documents_insert" on public.client_documents for insert to authenticated with check (true);
create policy "client_documents_delete" on public.client_documents for delete to authenticated using (true);

-- ============ communications ============
create table public.communications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  contact_date date not null default current_date,
  method text, direction text, summary text,
  follow_up_required boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.communications enable row level security;
create policy "communications_select" on public.communications for select to authenticated using (true);
create policy "communications_insert" on public.communications for insert to authenticated with check (true);

-- ============ custom_options / disabled_options ============
create table public.custom_options (
  id uuid primary key default gen_random_uuid(),
  option_type text not null check (option_type in ('service','staff')),
  key text not null,
  en text, ht text, es text, fr text,
  unique (option_type, key)
);
alter table public.custom_options enable row level security;
create policy "custom_options_select" on public.custom_options for select to authenticated using (true);
create policy "custom_options_insert" on public.custom_options for insert to authenticated with check (true);
create policy "custom_options_delete" on public.custom_options for delete to authenticated using (true);

create table public.disabled_options (
  option_type text not null check (option_type in ('service','staff')),
  key text not null,
  primary key (option_type, key)
);
alter table public.disabled_options enable row level security;
create policy "disabled_options_select" on public.disabled_options for select to authenticated using (true);
create policy "disabled_options_insert" on public.disabled_options for insert to authenticated with check (true);
create policy "disabled_options_delete" on public.disabled_options for delete to authenticated using (true);

-- ============ atomic "create master client + program row" RPCs ============
create or replace function public.create_case_client(master_fields jsonb, program_fields jsonb, matched_client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_row public.case_clients;
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

  insert into public.case_clients (client_id, first_name, last_name, phone, email, street, city, zip, intake_date, immigration_status, dob, services)
  values (
    v_client_id, program_fields->>'first_name', program_fields->>'last_name', program_fields->>'phone', program_fields->>'email',
    program_fields->>'street', program_fields->>'city', program_fields->>'zip', nullif(program_fields->>'intake_date','')::date,
    program_fields->>'immigration_status', nullif(program_fields->>'dob','')::date,
    coalesce((select array_agg(x) from jsonb_array_elements_text(program_fields->'services') x), '{}')
  ) returning * into v_row;

  return jsonb_build_object('client_id', v_client_id, 'row', to_jsonb(v_row));
end;
$$;
grant execute on function public.create_case_client(jsonb, jsonb, uuid) to authenticated;

create or replace function public.create_job_client(master_fields jsonb, program_fields jsonb, matched_client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_row public.job_clients;
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

  insert into public.job_clients (
    client_id, first_name, last_name, phone, email, street, city, zip, intake_date,
    work_permit, work_permit_expiration, has_resume, resume_storage_path, resume_file_name
  ) values (
    v_client_id, program_fields->>'first_name', program_fields->>'last_name', program_fields->>'phone', program_fields->>'email',
    program_fields->>'street', program_fields->>'city', program_fields->>'zip', nullif(program_fields->>'intake_date','')::date,
    coalesce((program_fields->>'work_permit')::boolean, false),
    nullif(program_fields->>'work_permit_expiration','')::date,
    coalesce((program_fields->>'has_resume')::boolean, false),
    program_fields->>'resume_storage_path', program_fields->>'resume_file_name'
  ) returning * into v_row;

  return jsonb_build_object('client_id', v_client_id, 'row', to_jsonb(v_row));
end;
$$;
grant execute on function public.create_job_client(jsonb, jsonb, uuid) to authenticated;

create or replace function public.create_food_client(master_fields jsonb, program_fields jsonb, matched_client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_row public.food_clients;
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

  insert into public.food_clients (client_id, first_name, last_name, phone, email, street, city, zip, intake_date, household_size)
  values (
    v_client_id, program_fields->>'first_name', program_fields->>'last_name', program_fields->>'phone', program_fields->>'email',
    program_fields->>'street', program_fields->>'city', program_fields->>'zip', nullif(program_fields->>'intake_date','')::date,
    program_fields->>'household_size'
  ) returning * into v_row;

  return jsonb_build_object('client_id', v_client_id, 'row', to_jsonb(v_row));
end;
$$;
grant execute on function public.create_food_client(jsonb, jsonb, uuid) to authenticated;

-- indexes
create index case_clients_client_id_idx on public.case_clients (client_id);
create index case_client_notes_case_client_id_idx on public.case_client_notes (case_client_id);
create index job_clients_client_id_idx on public.job_clients (client_id);
create index job_applications_job_client_id_idx on public.job_applications (job_client_id);
create index food_clients_client_id_idx on public.food_clients (client_id);
create index food_distributions_food_client_id_idx on public.food_distributions (food_client_id);
create index appointments_client_id_idx on public.appointments (client_id);
create index client_notes_client_id_idx on public.client_notes (client_id);
create index client_documents_client_id_idx on public.client_documents (client_id);
create index communications_client_id_idx on public.communications (client_id);
