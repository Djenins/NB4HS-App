-- Recovered verbatim from supabase_migrations.schema_migrations (already applied to project vkbzarlkqzvhsfdmxyyq).

-- Notifications for staff, one row per appointment assignment/update.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  type text not null default 'appointment_assigned',
  title text,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inserts happen only via the trigger below (security definer, runs as
-- table owner), so no INSERT policy is granted to client roles directly.

-- Public-safe staff directory: lets the anon kiosk appointment-request form
-- offer a "who would you like to meet with" picker (name + role) without
-- exposing the full profiles table (which holds no extra PII here, but
-- keeping the anon-visible surface minimal/explicit is the safer default).
create view public.staff_directory
  with (security_invoker = false) as
  select id, name, email, role
  from public.profiles
  where active = true and role in ('case_manager', 'job_developer');

grant select on public.staff_directory to anon, authenticated;

-- Notify the assigned staff member whenever an appointment is created with
-- (or reassigned to) an assigned_email -- covers both the client-facing
-- kiosk request form and staff scheduling a client directly.
create or replace function public.notify_appointment_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if new.assigned_email is not null and new.assigned_email <> '' and
     (tg_op = 'INSERT' or new.assigned_email is distinct from old.assigned_email) then
    select id into target_id from public.profiles where lower(email) = lower(new.assigned_email) limit 1;
    if target_id is not null then
      insert into public.notifications (user_id, appointment_id, type, title, message)
      values (
        target_id,
        new.id,
        'appointment_assigned',
        'New appointment',
        trim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')) ||
          case when new.appt_date is not null then ' — ' || to_char(new.appt_date, 'Mon DD, YYYY') else '' end ||
          case when new.appt_time is not null and new.appt_time <> '' then ' ' || new.appt_time else '' end
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_notify_appointment_assignment
  after insert or update on public.appointments
  for each row execute function public.notify_appointment_assignment();
