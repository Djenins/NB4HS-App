-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('visit', 'appointment')),
  title text not null,
  person_name text,
  notes text,
  event_date date not null,
  start_time time not null,
  end_time time,
  availability text check (availability in ('busy', 'available')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

create policy "calendar_events_select_authenticated"
  on public.calendar_events for select
  to authenticated
  using (true);

create policy "calendar_events_insert_authenticated"
  on public.calendar_events for insert
  to authenticated
  with check (true);

create policy "calendar_events_update_own_or_admin"
  on public.calendar_events for update
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'administrator')
  );

create policy "calendar_events_delete_own_or_admin"
  on public.calendar_events for delete
  to authenticated
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'administrator')
  );

create index calendar_events_event_date_idx on public.calendar_events (event_date);
