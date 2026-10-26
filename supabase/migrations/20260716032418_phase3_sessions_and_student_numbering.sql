-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- ---- sessions ----
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index sessions_one_current on public.sessions (is_current) where is_current;

alter table public.sessions enable row level security;
create policy sessions_select on public.sessions for select using (has_role(array['administrator','case_manager','job_developer']));
create policy sessions_insert on public.sessions for insert with check (has_role(array['administrator','case_manager','job_developer']));
create policy sessions_update on public.sessions for update using (has_role(array['administrator','case_manager','job_developer'])) with check (has_role(array['administrator','case_manager','job_developer']));
create policy sessions_delete on public.sessions for delete using (has_role(array['administrator','case_manager','job_developer']));

-- ---- past_session_students ----
create table public.past_session_students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  street text,
  city text,
  zip text,
  state text default 'RI',
  class_key text references public.classes(key) on delete set null,
  class_name text,
  created_at timestamptz not null default now()
);
create index past_session_students_session_id_idx on public.past_session_students (session_id);

alter table public.past_session_students enable row level security;
create policy past_session_students_select on public.past_session_students for select using (has_role(array['administrator','case_manager','job_developer']));
create policy past_session_students_insert on public.past_session_students for insert with check (has_role(array['administrator','case_manager','job_developer']));
create policy past_session_students_update on public.past_session_students for update using (has_role(array['administrator','case_manager','job_developer'])) with check (has_role(array['administrator','case_manager','job_developer']));
create policy past_session_students_delete on public.past_session_students for delete using (has_role(array['administrator','case_manager','job_developer']));

-- ---- student numbering, mirroring next_nb_id()/client_number_seq ----
create sequence public.student_number_seq;
create function public.next_student_display_id()
returns text
language sql
set search_path to 'public'
as $$
  select 'NB-' || lpad(nextval('public.student_number_seq')::text, 5, '0');
$$;
alter table public.students alter column student_display_id set default public.next_student_display_id();

-- ---- start_new_session RPC ----
create function public.start_new_session(new_start date, new_end date)
returns public.sessions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  new_row public.sessions;
begin
  if not has_role(array['administrator','case_manager','job_developer']) then
    raise exception 'not authorized';
  end if;

  update public.sessions set is_current = false where is_current = true;

  insert into public.sessions (start_date, end_date, is_current)
  values (new_start, new_end, true)
  returning * into new_row;

  update public.students set class_key = null where class_key is not null and active = true;

  return new_row;
end;
$$;

-- Seed one current session so the app never sees a null current session.
insert into public.sessions (start_date, end_date, is_current)
values (current_date, current_date + interval '3 months', true);
