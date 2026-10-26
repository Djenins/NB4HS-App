-- SNAP Outreach Stage 2a -- outreach contacts, contact consent, activity log
-- (plans/snap-outreach-architecture.md §4). ADDITIVE ONLY. NOT YET APPLIED.
--
-- Decisions (2026-10-26):
-- * Every outreach contact is a minimal `clients` record (NB ID, name, one
--   way to reach them) -- never a second identity system. create_outreach_
--   contact() links to an existing client or creates one, same shape as
--   create_case_client(); the UI searches first and warns on likely
--   duplicates, and nothing is ever merged automatically.
-- * Any SNAP member can find and read any SNAP contact (duplicate checks,
--   covering for colleagues); workers change only contacts assigned to them.
--   Cases and case notes (Stage 2b) are assigned-only for workers.
-- * Nothing here asks for SSN, immigration status, income or account
--   credentials, and the activity summary is capped and labelled
--   non-sensitive in the UI.

-- ============ outreach_contacts ============
create table public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  program text not null default 'snap' check (program in ('snap')),
  client_id uuid not null references public.clients(id) on delete cascade,
  preferred_language text check (preferred_language in ('en', 'ht', 'fr', 'es', 'pt')),
  preferred_contact_method text check (preferred_contact_method in ('phone', 'sms', 'email', 'in_person', 'mail')),
  outreach_source text check (outreach_source in ('walk_in', 'phone', 'event', 'referral', 'partner', 'door_to_door', 'social_media', 'other')),
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  follow_up_status text not null default 'none' check (follow_up_status in ('none', 'needed', 'scheduled', 'done')),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program, client_id)
);
create index outreach_contacts_program_status_idx on public.outreach_contacts (program, status);
create index outreach_contacts_assigned_idx on public.outreach_contacts (assigned_to) where status = 'active';
create index outreach_contacts_client_idx on public.outreach_contacts (client_id);
create trigger outreach_contacts_set_updated_at before update on public.outreach_contacts
  for each row execute function public.set_updated_at();

alter table public.outreach_contacts enable row level security;
create policy outreach_contacts_select on public.outreach_contacts for select to authenticated
  using (has_program_role(program, array['worker', 'supervisor', 'program_admin']));
create policy outreach_contacts_insert on public.outreach_contacts for insert to authenticated
  with check (has_program_role(program, array['worker', 'supervisor', 'program_admin']));
create policy outreach_contacts_update on public.outreach_contacts for update to authenticated
  using (has_program_role(program, array['supervisor', 'program_admin'])
         or (assigned_to = auth.uid() and has_program_role(program, array['worker'])))
  with check (has_program_role(program, array['supervisor', 'program_admin'])
              or (assigned_to = auth.uid() and has_program_role(program, array['worker'])));
-- No delete policy: contacts are set inactive, never removed.

-- Link an existing client (matched_client_id) or create a minimal one, then
-- add the outreach contact. Security definer only so the clients insert and
-- the contact insert happen together; the program-role check is explicit.
create or replace function public.create_outreach_contact(master_fields jsonb, contact_fields jsonb, matched_client_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_program text := coalesce(contact_fields->>'program', 'snap');
  v_client_id uuid;
  v_row public.outreach_contacts;
begin
  if not public.has_program_role(v_program, array['worker', 'supervisor', 'program_admin']) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if matched_client_id is not null then
    v_client_id := matched_client_id;
  else
    if coalesce(trim(master_fields->>'first_name'), '') = '' or coalesce(trim(master_fields->>'last_name'), '') = '' then
      raise exception 'first and last name are required' using errcode = '23514';
    end if;
    insert into public.clients (first_name, last_name, phone, email)
    values (trim(master_fields->>'first_name'), trim(master_fields->>'last_name'),
            nullif(trim(master_fields->>'phone'), ''), nullif(trim(master_fields->>'email'), ''))
    returning id into v_client_id;
  end if;

  insert into public.outreach_contacts (program, client_id, preferred_language, preferred_contact_method,
                                        outreach_source, assigned_to, follow_up_status, created_by)
  values (v_program, v_client_id, nullif(contact_fields->>'preferred_language', ''),
          nullif(contact_fields->>'preferred_contact_method', ''), nullif(contact_fields->>'outreach_source', ''),
          coalesce(nullif(contact_fields->>'assigned_to', '')::uuid, auth.uid()),
          coalesce(nullif(contact_fields->>'follow_up_status', ''), 'none'), auth.uid())
  returning * into v_row;

  return jsonb_build_object('client_id', v_client_id, 'row', to_jsonb(v_row));
end;
$$;
revoke all on function public.create_outreach_contact(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.create_outreach_contact(jsonb, jsonb, uuid) to authenticated;

-- ============ contact_consents ============
-- Append-only history per person and channel/purpose; the newest row is the
-- current answer. Revoking (opt-out) is a new 'revoked' row, so who agreed
-- to what, when and how is never overwritten. Person-level, not
-- program-level: a later program can read the same history.
create table public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  channel text not null check (channel in ('phone', 'sms', 'email', 'mail')),
  purpose text not null check (purpose in ('program_updates', 'appointment_reminders')),
  status text not null check (status in ('granted', 'revoked')),
  method text not null check (method in ('verbal', 'written', 'electronic')),
  captured_by uuid references public.profiles(id) on delete set null default auth.uid(),
  captured_at timestamptz not null default now()
);
create index contact_consents_lookup_idx on public.contact_consents (client_id, channel, purpose, captured_at desc);

alter table public.contact_consents enable row level security;
-- Only SNAP uses consent today; widen to other programs' roles when they arrive.
create policy contact_consents_select on public.contact_consents for select to authenticated
  using (has_program_role('snap', array['worker', 'supervisor', 'program_admin']));
create policy contact_consents_insert on public.contact_consents for insert to authenticated
  with check (captured_by = auth.uid() and has_program_role('snap', array['worker', 'supervisor', 'program_admin']));
-- No update/delete policies: append-only.

-- ============ outreach_interactions (activity log) ============
create table public.outreach_interactions (
  id uuid primary key default gen_random_uuid(),
  program text not null default 'snap' check (program in ('snap')),
  client_id uuid not null references public.clients(id) on delete cascade,
  staff_id uuid not null references public.profiles(id) default auth.uid(),
  type text not null check (type in ('call', 'text', 'email', 'in_person', 'event', 'door_to_door', 'tabling', 'other')),
  direction text check (direction in ('outbound', 'inbound')),
  outcome text check (outcome in ('reached', 'no_answer', 'left_message', 'info_provided', 'follow_up_needed', 'not_interested')),
  summary text check (char_length(summary) <= 1000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index outreach_interactions_program_time_idx on public.outreach_interactions (program, occurred_at desc);
create index outreach_interactions_client_time_idx on public.outreach_interactions (client_id, occurred_at desc);
create index outreach_interactions_staff_time_idx on public.outreach_interactions (staff_id, occurred_at desc);

alter table public.outreach_interactions enable row level security;
create policy outreach_interactions_select on public.outreach_interactions for select to authenticated
  using (has_program_role(program, array['worker', 'supervisor', 'program_admin']));
create policy outreach_interactions_insert on public.outreach_interactions for insert to authenticated
  with check (staff_id = auth.uid() and occurred_at <= now() + interval '1 day'
              and has_program_role(program, array['worker', 'supervisor', 'program_admin']));
-- No update/delete policies for now: the log is a record of what happened.

-- ============ audit ============
create trigger outreach_contacts_audit after insert or update or delete on public.outreach_contacts
  for each row execute function public.audit_row_change();
create trigger contact_consents_audit after insert or update or delete on public.contact_consents
  for each row execute function public.audit_row_change();
create trigger outreach_interactions_audit after insert or update or delete on public.outreach_interactions
  for each row execute function public.audit_row_change();
