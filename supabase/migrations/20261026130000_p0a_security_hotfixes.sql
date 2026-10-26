-- Phase 0, part A of 2 -- security hotfixes that break nothing the current
-- app does (plans/unified-access-architecture.md §2.1, §5).
-- NOT YET APPLIED. Safe to apply before the matching frontend is deployed:
-- every path the live app uses keeps working. Part B (p0b) removes the old
-- anonymous paths once the new appointment-request page is live.
--
-- S1  create_* RPCs: SECURITY DEFINER with no role check, so any signed-in
--     account (receptionist, an inactive self-signup's JWT) could create
--     case or job clients RLS would refuse. Each now requires exactly what
--     its program table's own INSERT policy requires.
-- S2  client-documents bucket: any authenticated user could read, upload and
--     delete every object. Now the same roles as the client_documents table.
--     The bucket's policies were dashboard-only; they are now in a migration.
-- S4  profiles.email: users could rewrite their own, and appointment
--     notifications are routed by email. Only an administrator changes it.
-- S5  staff_directory: an auto-updatable view with owner rights and full
--     privileges for anon -- anyone could rewrite the name and email of an
--     active case manager or job developer. Write privileges revoked here
--     (nothing writes through it); anon SELECT goes in part B.
-- S6  handle_new_user: a signup asking for 'administrator' is stored as
--     'staff'. Administrators now promote from the Users page.
-- S9  created_by / uploaded_by are stamped from the session, never trusted
--     from the client (a "private" note could be planted under a colleague's
--     name), and cannot be changed afterwards.
-- S10 calendar_events and appointments admin/owner checks require an active
--     profile, so a deactivated account's still-valid JWT stops working.
-- S12 the numbering functions are no longer callable anonymously.
-- Also: appointment notifications go to the *active* profile with that email.
-- New: public_appointment_staff() and request_appointment() -- the narrow
-- anonymous paths the appointment-request page moves to (used by part B).

-- ============ S1: role checks in the client-creation RPCs ============
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
  -- Same rule as case_clients' own policies.
  if not public.has_role(array['case_manager', 'administrator']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

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
  -- Same rule as job_clients' own policies.
  if not public.has_role(array['case_manager', 'job_developer', 'administrator']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

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
  -- Same rule as food_clients' own policies (stage0b).
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

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
  -- Same rule as students' own policies (stage0b).
  if not public.is_staff() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

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

-- ============ S2: client-documents bucket ============
-- Same roles as the client_documents table. The bucket holds client
-- documents and job-client resumes (path {client_id}/...).
insert into storage.buckets (id, name, public) values ('client-documents', 'client-documents', false)
on conflict (id) do update set public = false;

drop policy if exists client_documents_bucket_select on storage.objects;
drop policy if exists client_documents_bucket_insert on storage.objects;
drop policy if exists client_documents_bucket_delete on storage.objects;
create policy client_documents_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and public.has_role(array['administrator', 'staff', 'case_manager', 'job_developer']));
create policy client_documents_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and public.has_role(array['administrator', 'staff', 'case_manager', 'job_developer']));
create policy client_documents_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and public.has_role(array['administrator', 'staff', 'case_manager', 'job_developer']));

-- ============ S4: profiles.email (and id) only change by an administrator ============
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.active := old.active;
    new.email := old.email;
  end if;
  new.id := old.id;
  return new;
end;
$$;

-- ============ S5: nothing may write through staff_directory ============
revoke insert, update, delete, truncate, references, trigger on public.staff_directory from anon, authenticated, public;

-- ============ S6: signups never ask their way into administrator ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text := coalesce(new.raw_user_meta_data->>'role', 'staff');
begin
  if requested not in ('staff', 'receptionist', 'case_manager', 'job_developer') then
    requested := 'staff';
  end if;
  insert into public.profiles (id, name, email, role, active)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email, requested, false);
  return new;
end;
$$;

-- ============ S9: attribution comes from the session ============
-- On insert the column is set to the caller; on update it keeps its value.
-- Rows written with no session (cron, SQL editor) are left as given.
create or replace function public.stamp_actor_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], auth.uid()));
    end if;
  else
    new := jsonb_populate_record(new, jsonb_build_object(tg_argv[0], to_jsonb(old)->tg_argv[0]));
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_actor_column() from public, anon, authenticated;

create trigger client_notes_stamp_actor before insert or update on public.client_notes
  for each row execute function public.stamp_actor_column('created_by');
create trigger communications_stamp_actor before insert or update on public.communications
  for each row execute function public.stamp_actor_column('created_by');
create trigger client_documents_stamp_actor before insert or update on public.client_documents
  for each row execute function public.stamp_actor_column('uploaded_by');
create trigger case_client_notes_stamp_actor before insert or update on public.case_client_notes
  for each row execute function public.stamp_actor_column('created_by');
create trigger employer_notes_stamp_actor before insert or update on public.employer_notes
  for each row execute function public.stamp_actor_column('created_by');
create trigger employer_activity_stamp_actor before insert or update on public.employer_activity
  for each row execute function public.stamp_actor_column('created_by');
create trigger employer_documents_stamp_actor before insert or update on public.employer_documents
  for each row execute function public.stamp_actor_column('uploaded_by');
create trigger calendar_events_stamp_actor before insert or update on public.calendar_events
  for each row execute function public.stamp_actor_column('created_by');

-- ============ S10: owner/admin checks require an active profile ============
drop policy calendar_events_update_own_or_admin on public.calendar_events;
drop policy calendar_events_delete_own_or_admin on public.calendar_events;
create policy calendar_events_update_own_or_admin on public.calendar_events for update to authenticated
  using ((created_by = auth.uid() and public.is_staff()) or public.is_admin())
  with check ((created_by = auth.uid() and public.is_staff()) or public.is_admin());
create policy calendar_events_delete_own_or_admin on public.calendar_events for delete to authenticated
  using ((created_by = auth.uid() and public.is_staff()) or public.is_admin());

drop policy appointments_update on public.appointments;
drop policy appointments_delete on public.appointments;
create policy appointments_update on public.appointments for update to authenticated
  using ((assigned_email = auth.email() and public.is_staff()) or public.is_admin())
  with check ((assigned_email = auth.email() and public.is_staff()) or public.is_admin());
create policy appointments_delete on public.appointments for delete to authenticated
  using ((assigned_email = auth.email() and public.is_staff()) or public.is_admin());

-- Notifications go to the active account holding that email.
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
    select id into target_id from public.profiles
      where lower(email) = lower(new.assigned_email) and active
      order by created_at
      limit 1;
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

-- ============ S12: numbering functions are not anonymous RPCs ============
-- Column defaults still work: authenticated keeps EXECUTE, and the kiosk
-- writes through SECURITY DEFINER functions owned by postgres.
revoke execute on function public.next_nb_id() from public, anon;
revoke execute on function public.next_student_display_id() from public, anon;
revoke execute on function public.snap_today() from public, anon;

-- ============ New narrow paths for the public appointment request ============
-- The staff picker: names and roles only, never emails.
create or replace function public.public_appointment_staff()
returns table (id uuid, name text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.role
  from public.profiles p
  where p.active and p.role in ('case_manager', 'job_developer')
  order by p.name;
$$;
revoke all on function public.public_appointment_staff() from public;
grant execute on function public.public_appointment_staff() to anon, authenticated;

-- A client's request: always 'requested' from source 'client'; the assignee is
-- resolved from the picked staff id server-side, so a caller can no longer
-- route a request (and its notification) to any address they like.
create or replace function public.request_appointment(
  p_first_name text, p_last_name text, p_phone text, p_email text,
  p_date date, p_time text, p_reason text,
  p_staff_id uuid default null, p_meeting_with text default 'case_manager'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := '';
  v_meeting text := coalesce(nullif(p_meeting_with, ''), 'case_manager');
begin
  if coalesce(btrim(p_first_name), '') = '' or coalesce(btrim(p_last_name), '') = ''
     or coalesce(btrim(p_phone), '') = '' or p_date is null or coalesce(btrim(p_time), '') = '' then
    raise exception 'missing required fields' using errcode = '22023';
  end if;
  if char_length(p_first_name) > 100 or char_length(p_last_name) > 100 or char_length(p_phone) > 40
     or char_length(coalesce(p_email, '')) > 254 or char_length(p_time) > 20
     or char_length(coalesce(p_reason, '')) > 1000 then
    raise exception 'field too long' using errcode = '22001';
  end if;
  if p_date < current_date - 1 or p_date > current_date + 366 then
    raise exception 'date out of range' using errcode = '22008';
  end if;

  if p_staff_id is not null then
    select p.email, p.role into v_email, v_meeting
    from public.profiles p
    where p.id = p_staff_id and p.active and p.role in ('case_manager', 'job_developer');
    if not found then
      raise exception 'unknown staff member' using errcode = '22023';
    end if;
  elsif v_meeting not in ('case_manager', 'job_developer') then
    raise exception 'invalid meeting type' using errcode = '22023';
  end if;

  insert into public.appointments (first_name, last_name, phone, email, appt_date, appt_time, reason,
                                   assigned_email, meeting_with, status, source)
  values (btrim(p_first_name), btrim(p_last_name), btrim(p_phone), btrim(coalesce(p_email, '')), p_date, btrim(p_time),
          coalesce(p_reason, ''), coalesce(v_email, ''), v_meeting, 'requested', 'client');
end;
$$;
revoke all on function public.request_appointment(text, text, text, text, date, text, text, uuid, text) from public;
grant execute on function public.request_appointment(text, text, text, text, date, text, text, uuid, text) to anon, authenticated;
