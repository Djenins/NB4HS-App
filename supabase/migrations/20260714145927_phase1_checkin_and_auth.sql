-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create extension if not exists pgcrypto;

-- ============ profiles ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  role text not null default 'staff' check (role in ('administrator','staff','receptionist','case_manager','job_developer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'administrator' and active = true
  );
$$;

create policy "profiles_update_own_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'staff'),
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ classes ============
create table public.classes (
  key text primary key,
  name text not null,
  days int[] not null default '{}',
  service text,
  staff text,
  active boolean not null default true
);

alter table public.classes enable row level security;

create policy "classes_select" on public.classes for select using (true);
create policy "classes_insert" on public.classes for insert to authenticated with check (true);
create policy "classes_update" on public.classes for update to authenticated using (true) with check (true);
create policy "classes_delete" on public.classes for delete to authenticated using (true);

-- ============ students ============
create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text,
  class_key text references public.classes(key) on delete set null,
  active boolean not null default true,
  student_display_id text,
  street text,
  city text,
  zip text,
  state text default 'RI',
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;

create policy "students_select" on public.students for select using (true);
create policy "students_insert" on public.students for insert to authenticated with check (true);
create policy "students_update" on public.students for update to authenticated using (true) with check (true);
create policy "students_delete" on public.students for delete to authenticated using (true);

-- ============ visits ============
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone text,
  email text,
  street text,
  city text,
  state text,
  zip text,
  service text,
  service_other text,
  staff text,
  staff_other text,
  notes text,
  visit_date date not null default current_date,
  time_in timestamptz not null default now(),
  time_out timestamptz,
  student_id uuid references public.students(id) on delete set null,
  class_name text
);

alter table public.visits enable row level security;

create policy "visits_select" on public.visits for select using (true);
create policy "visits_insert" on public.visits for insert with check (true);
-- Deliberately no update/delete policy: checkout goes through the
-- check_out_visit() RPC below so an anonymous kiosk client can only ever
-- set time_out on its own row, never rewrite arbitrary visit fields.

create or replace function public.check_out_visit(visit_id uuid)
returns public.visits
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.visits;
begin
  update public.visits
    set time_out = now()
    where id = visit_id and time_out is null
    returning * into updated;
  return updated;
end;
$$;

grant execute on function public.check_out_visit(uuid) to anon, authenticated;

create index visits_time_out_idx on public.visits (time_out);
create index visits_visit_date_idx on public.visits (visit_date);
create index students_class_key_idx on public.students (class_key);
