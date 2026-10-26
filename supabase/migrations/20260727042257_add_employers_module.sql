-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Employer & Job Opportunity Management, Phase 1: Employers.
-- Mirrors job_clients (list-level table) + client_notes/communications/client_documents
-- (append-only detail tables) conventions already used elsewhere in this schema.

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  industry text,
  website text,
  street text,
  city text,
  zip text,
  state text default 'RI',
  contact_name text,
  contact_phone text,
  contact_email text,
  hr_contact_name text,
  hr_contact_phone text,
  hr_contact_email text,
  preferred_communication text,
  notes text,
  partnership_stage text not null default 'prospect',
  partner_since date,
  last_meeting_date date,
  next_follow_up_date date,
  assigned_job_developer_email text,
  preferred_hiring_method text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employer_notes (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  note_date date not null default current_date,
  content text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.employer_activity (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  activity_date date not null default current_date,
  type text not null default 'call',
  summary text,
  follow_up_required boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.employer_documents (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers(id) on delete cascade,
  file_name text not null,
  category text not null default 'other',
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index employer_notes_employer_id_idx on public.employer_notes(employer_id);
create index employer_activity_employer_id_idx on public.employer_activity(employer_id);
create index employer_documents_employer_id_idx on public.employer_documents(employer_id);

alter table public.employers enable row level security;
alter table public.employer_notes enable row level security;
alter table public.employer_activity enable row level security;
alter table public.employer_documents enable row level security;

create policy employers_select on public.employers for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy employers_insert on public.employers for insert to authenticated
  with check (has_role(array['administrator','job_developer']));
create policy employers_update on public.employers for update to authenticated
  using (has_role(array['administrator','job_developer'])) with check (has_role(array['administrator','job_developer']));
create policy employers_delete on public.employers for delete to authenticated
  using (has_role(array['administrator','job_developer']));

create policy employer_notes_select on public.employer_notes for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy employer_notes_insert on public.employer_notes for insert to authenticated
  with check (has_role(array['administrator','job_developer']));

create policy employer_activity_select on public.employer_activity for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy employer_activity_insert on public.employer_activity for insert to authenticated
  with check (has_role(array['administrator','job_developer']));

create policy employer_documents_select on public.employer_documents for select to authenticated
  using (has_role(array['administrator','job_developer']));
create policy employer_documents_insert on public.employer_documents for insert to authenticated
  with check (has_role(array['administrator','job_developer']));
create policy employer_documents_delete on public.employer_documents for delete to authenticated
  using (has_role(array['administrator','job_developer']));

alter publication supabase_realtime add table public.employers;
