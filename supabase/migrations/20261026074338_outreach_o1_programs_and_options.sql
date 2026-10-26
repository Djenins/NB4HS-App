-- Outreach Management O1 -- SNAP becomes one program inside Outreach
-- Management (plans/outreach-management-architecture.md §3.1, §6).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026074338) after PR #27
-- review. No new features: this replaces SNAP-only hardcoding with
-- configuration so a second outreach program is rows, not a schema change.
--
-- * `programs` registry; every `program` column now references it instead of
--   `check (program in ('snap'))`.
-- * `program_option_sets`: per-program option lists. Assistance types and
--   closure reasons move here from CHECK constraints, seeded with exactly the
--   values those CHECKs allowed.
-- * Case milestones (application assisted, referred out) are configured on
--   the stage instead of hardcoded stage keys in the trigger.
-- * Case numbers take the program's prefix (SNAP-2026-00001 unchanged).
-- * outreach_dashboard(program, from, to); snap_dashboard() stays as a wrapper.
--
-- Safe with the app version deployed today: column defaults stay 'snap',
-- snap_dashboard() still answers with the same keys, and the same option
-- values are accepted. Configuration is editable by program admins and
-- system administrators (decision 2026-10-26, permission matrix §5).

-- ============ programs ============
create table public.programs (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,30}$'),
  module text not null default 'outreach' check (module in ('outreach')),
  name_en text not null,
  name_ht text not null,
  name_fr text not null,
  case_number_prefix text not null check (case_number_prefix ~ '^[A-Z]{2,8}$'),
  -- What NB4HS does and doesn't do in this program, shown on its dashboard
  -- and every case (SNAP: eligibility is decided only by RI DHS).
  scope_note_en text,
  scope_note_ht text,
  scope_note_fr text,
  -- Which outreach workflows this program uses; the module shows a section
  -- only when it is listed here. Later phases add referrals/appointments/events.
  features text[] not null default '{}'
    check (features <@ array['contacts', 'cases', 'tasks', 'referrals', 'appointments', 'events']::text[]),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger programs_set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();

insert into public.programs (key, name_en, name_ht, name_fr, case_number_prefix, features, scope_note_en, scope_note_ht, scope_note_fr) values
  ('snap', 'SNAP', 'SNAP', 'SNAP', 'SNAP', array['contacts', 'cases', 'tasks'],
   'NB4HS helps community members learn about and apply for SNAP. Eligibility decisions are made only by Rhode Island DHS.',
   'NB4HS ede moun nan kominote a konnen ak aplike pou SNAP. Se sèlman DHS Rhode Island ki deside si yon moun kalifye.',
   'NB4HS aide les membres de la communauté à s''informer sur SNAP et à en faire la demande. Seul le DHS de Rhode Island décide de l''admissibilité.');

alter table public.programs enable row level security;
-- Names and features only -- no participant data -- so any active staff
-- member may read them (the sidebar needs them).
create policy programs_select on public.programs for select to authenticated using (is_staff());
create policy programs_insert on public.programs for insert to authenticated with check (is_admin());
create policy programs_update on public.programs for update to authenticated
  using (can_manage_program(key)) with check (can_manage_program(key));
-- No delete policy: programs are deactivated, never removed.

-- ============ program columns reference the registry ============
alter table public.program_staff drop constraint program_staff_program_check,
  add constraint program_staff_program_fkey foreign key (program) references public.programs (key);
alter table public.outreach_contacts drop constraint outreach_contacts_program_check,
  add constraint outreach_contacts_program_fkey foreign key (program) references public.programs (key);
alter table public.outreach_interactions drop constraint outreach_interactions_program_check,
  add constraint outreach_interactions_program_fkey foreign key (program) references public.programs (key);
alter table public.program_case_stages drop constraint program_case_stages_program_check,
  add constraint program_case_stages_program_fkey foreign key (program) references public.programs (key);
alter table public.assistance_cases drop constraint assistance_cases_program_check,
  add constraint assistance_cases_program_fkey foreign key (program) references public.programs (key);
alter table public.tasks drop constraint tasks_program_check,
  add constraint tasks_program_fkey foreign key (program) references public.programs (key);

-- Any active program role, in any program. Consent is person-level, so it's
-- shared by every outreach program rather than tied to SNAP.
create or replace function public.has_any_program_role(p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.program_staff ps join public.profiles p on p.id = ps.user_id
    where ps.user_id = auth.uid() and ps.active and p.active and ps.program_role = any(p_roles)
  )
$$;
revoke all on function public.has_any_program_role(text[]) from public, anon;
grant execute on function public.has_any_program_role(text[]) to authenticated;

drop policy contact_consents_select on public.contact_consents;
drop policy contact_consents_insert on public.contact_consents;
create policy contact_consents_select on public.contact_consents for select to authenticated
  using (has_any_program_role(array['worker', 'supervisor', 'program_admin']));
create policy contact_consents_insert on public.contact_consents for insert to authenticated
  with check (captured_by = auth.uid() and has_any_program_role(array['worker', 'supervisor', 'program_admin']));

-- ============ program_option_sets (configurable lists) ============
create table public.program_option_sets (
  id uuid primary key default gen_random_uuid(),
  program text not null references public.programs (key),
  set_key text not null check (set_key in ('assistance_type', 'closure_reason')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,40}$'),
  label_en text not null,
  label_ht text not null,
  label_fr text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program, set_key, key)
);
create trigger program_option_sets_set_updated_at before update on public.program_option_sets
  for each row execute function public.set_updated_at();

alter table public.program_option_sets enable row level security;
create policy program_option_sets_select on public.program_option_sets for select to authenticated
  using (has_program_role(program, array['worker', 'supervisor', 'program_admin']) or can_manage_program(program));
create policy program_option_sets_insert on public.program_option_sets for insert to authenticated
  with check (can_manage_program(program));
create policy program_option_sets_update on public.program_option_sets for update to authenticated
  using (can_manage_program(program)) with check (can_manage_program(program));
-- No delete policy: retire an option by setting active = false; cases that
-- already use it keep it.

insert into public.program_option_sets (program, set_key, key, label_en, label_ht, label_fr, sort_order) values
  ('snap', 'assistance_type', 'application_help',      'SNAP application help',                 'Èd pou aplikasyon SNAP',                 'Aide à la demande SNAP',                          10),
  ('snap', 'assistance_type', 'recertification',       'Recertification / renewal',             'Resètifikasyon / renouvèlman',           'Recertification / renouvellement',                20),
  ('snap', 'assistance_type', 'general_information',   'General information',                   'Enfòmasyon jeneral',                     'Informations générales',                          30),
  ('snap', 'assistance_type', 'document_help',         'Help with documents',                   'Èd ak dokiman',                          'Aide pour les documents',                         40),
  ('snap', 'assistance_type', 'interview_preparation', 'Interview preparation',                 'Preparasyon pou entèvyou',               'Préparation à l''entretien',                      50),
  ('snap', 'assistance_type', 'ebt_card_help',         'EBT card help (never ask for the PIN)', 'Èd ak kat EBT (pa janm mande PIN nan)',  'Aide carte EBT (ne jamais demander le code PIN)', 60),
  ('snap', 'assistance_type', 'other',                 'Other',                                 'Lòt',                                    'Autre',                                           70),
  ('snap', 'closure_reason',  'assistance_completed',  'Assistance completed',                  'Asistans fini',                          'Aide terminée',                                   10),
  ('snap', 'closure_reason',  'participant_declined',  'Participant declined',                  'Patisipan an refize',                    'Le participant a refusé',                         20),
  ('snap', 'closure_reason',  'unable_to_contact',     'Unable to contact',                     'Pa t ka kontakte',                       'Impossible à joindre',                            30),
  ('snap', 'closure_reason',  'referred_elsewhere',    'Referred elsewhere',                    'Refere yon lòt kote',                    'Orienté ailleurs',                                40),
  ('snap', 'closure_reason',  'moved_away',            'Moved away',                            'Demenaje',                               'A déménagé',                                      50),
  ('snap', 'closure_reason',  'duplicate_case',        'Duplicate case',                        'Ka an doub',                             'Dossier en double',                               60),
  ('snap', 'closure_reason',  'other',                 'Other',                                 'Lòt',                                    'Autre',                                           70);

alter table public.assistance_cases
  drop constraint assistance_cases_closure_reason_check,
  drop constraint assistance_cases_assistance_requested_check,
  drop constraint assistance_cases_assistance_provided_check;

-- ============ stages: milestones + who configures them ============
alter table public.program_case_stages
  add column milestone text check (milestone in ('application_assisted', 'referred_external'));
create unique index program_case_stages_milestone_idx on public.program_case_stages (program, milestone) where milestone is not null;
update public.program_case_stages set milestone = 'application_assisted' where program = 'snap' and key = 'assistance_provided';
update public.program_case_stages set milestone = 'referred_external' where program = 'snap' and key = 'referred_to_dhs';
comment on column public.assistance_cases.referred_to_dhs_at is
  'Date the case first reached its program''s referred_external milestone stage (SNAP: Referred to Rhode Island DHS).';

drop policy program_case_stages_select on public.program_case_stages;
drop policy program_case_stages_write on public.program_case_stages;
create policy program_case_stages_select on public.program_case_stages for select to authenticated
  using (has_program_role(program, array['worker', 'supervisor', 'program_admin']) or can_manage_program(program));
create policy program_case_stages_write on public.program_case_stages for all to authenticated
  using (can_manage_program(program)) with check (can_manage_program(program));

-- ============ new-case defaults: case number + first stage ============
-- Case numbers use one shared counter, so they're unique across programs
-- (SNAP-2026-00001, then e.g. MED-2026-00002); assigned on insert and never
-- editable. A case opened without a stage starts at its program's first
-- active stage (SNAP: new_inquiry, the old column default).
alter sequence public.snap_case_number_seq rename to outreach_case_number_seq;
alter table public.assistance_cases alter column case_number drop default;
alter table public.assistance_cases alter column stage_key drop default;
drop function public.next_snap_case_number();

create or replace function public.assistance_case_defaults()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  prefix text;
begin
  if tg_op = 'UPDATE' then
    new.case_number := old.case_number;
    return new;
  end if;
  select case_number_prefix into prefix from public.programs where key = new.program;
  new.case_number := prefix || '-' || to_char(public.snap_today(), 'YYYY') || '-'
    || lpad(nextval('public.outreach_case_number_seq')::text, 5, '0');
  if new.stage_key is null then
    select key into new.stage_key from public.program_case_stages
    where program = new.program and active and not is_terminal order by sort_order limit 1;
  end if;
  return new;
end;
$$;
revoke all on function public.assistance_case_defaults() from public, anon, authenticated;
-- Named to sort before assistance_cases_rules: BEFORE triggers fire alphabetically.
create trigger assistance_cases_defaults before insert or update on public.assistance_cases
  for each row execute function public.assistance_case_defaults();

-- ============ case rules: option lists + configured milestones ============
create or replace function public.assistance_case_rules()
returns trigger
language plpgsql set search_path = public
as $$
declare
  stage public.program_case_stages;
begin
  select * into stage from public.program_case_stages where program = new.program and key = new.stage_key;
  if not found or not stage.active then
    raise exception 'unknown or inactive case stage %', new.stage_key using errcode = '23514';
  end if;

  -- Only leads may approve or send back a review; workers may request one.
  if new.supervisor_review_status in ('approved', 'changes_requested')
     and (tg_op = 'INSERT' or new.supervisor_review_status is distinct from old.supervisor_review_status) then
    if not public.is_program_lead(new.program) then
      raise exception 'only a supervisor can review a case' using errcode = '42501';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;

  if stage.is_terminal then
    if new.closure_reason is null then
      raise exception 'a closure reason is required to close a case' using errcode = '23514';
    end if;
    if stage.requires_review and new.supervisor_review_status <> 'approved' then
      raise exception 'supervisor approval is required to close this case' using errcode = '23514';
    end if;
    new.closed_at := coalesce(new.closed_at, now());
  else
    new.closed_at := null;
    new.closure_reason := null;
  end if;

  -- Assistance types and closure reasons come from the program's option
  -- lists. Newly chosen values must be active; values already on the case
  -- stay valid after an option is retired.
  if exists (
    select 1 from (
      select v from unnest(new.assistance_requested) v
      where not (tg_op = 'UPDATE' and v = any(old.assistance_requested))
      union all
      select v from unnest(new.assistance_provided) v
      where not (tg_op = 'UPDATE' and v = any(old.assistance_provided))
    ) added
    where not exists (select 1 from public.program_option_sets o
                      where o.program = new.program and o.set_key = 'assistance_type' and o.key = added.v and o.active)
  ) then
    raise exception 'unknown assistance type for program %', new.program using errcode = '23514';
  end if;
  if new.closure_reason is not null
     and (tg_op = 'INSERT' or new.closure_reason is distinct from old.closure_reason)
     and not exists (select 1 from public.program_option_sets o
                     where o.program = new.program and o.set_key = 'closure_reason' and o.key = new.closure_reason and o.active) then
    raise exception 'unknown closure reason for program %', new.program using errcode = '23514';
  end if;

  -- Record when NB4HS's own milestones first happened, per the stage's
  -- configured milestone.
  if stage.milestone = 'application_assisted' and new.application_assisted_at is null then
    new.application_assisted_at := public.snap_today();
  end if;
  if stage.milestone = 'referred_external' and new.referred_to_dhs_at is null then
    new.referred_to_dhs_at := public.snap_today();
  end if;
  return new;
end;
$$;
revoke all on function public.assistance_case_rules() from public, anon, authenticated;

-- ============ dashboard: any program ============
-- SECURITY INVOKER, as before: every count respects the caller's RLS.
create or replace function public.outreach_dashboard(p_program text, p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with
  inter as (select * from public.outreach_interactions where program = p_program and (occurred_at at time zone 'America/New_York')::date between p_from and p_to),
  cases as (select * from public.assistance_cases where program = p_program),
  tk as (select * from public.tasks where program = p_program and status <> 'cancelled')
  select jsonb_build_object(
    'individuals_contacted', (select count(distinct client_id) from inter),
    'interactions', (select count(*) from inter),
    'new_contacts', (select count(*) from public.outreach_contacts where program = p_program and (created_at at time zone 'America/New_York')::date between p_from and p_to),
    'cases_opened', (select count(*) from cases where opened_at between p_from and p_to),
    'applications_assisted', (select count(*) from cases where application_assisted_at between p_from and p_to),
    'referred_external', (select count(*) from cases where referred_to_dhs_at between p_from and p_to),
    'cases_closed', (select count(*) from cases where (closed_at at time zone 'America/New_York')::date between p_from and p_to),
    'open_cases', (select count(*) from cases where closed_at is null),
    'follow_ups_due', (select count(*) from tk where status = 'open' and due_date between public.snap_today() and public.snap_today() + 7),
    'overdue_tasks', (select count(*) from tk where status = 'open' and due_date < public.snap_today()),
    'tasks_due_in_range', (select count(*) from tk where due_date between p_from and p_to),
    'tasks_done_in_range', (select count(*) from tk where due_date between p_from and p_to and status = 'done'),
    'activity_by_week', coalesce((select jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w)
                          from (select to_char(date_trunc('week', occurred_at at time zone 'America/New_York'), 'YYYY-MM-DD') w, count(*) n from inter group by 1) x), '[]'::jsonb),
    'activity_by_type', coalesce((select jsonb_agg(jsonb_build_object('key', type, 'count', n) order by n desc)
                          from (select type, count(*) n from inter group by 1) x), '[]'::jsonb),
    'contacts_by_source', coalesce((select jsonb_agg(jsonb_build_object('key', coalesce(outreach_source, 'unknown'), 'count', n) order by n desc)
                          from (select outreach_source, count(*) n from public.outreach_contacts
                                where program = p_program and (created_at at time zone 'America/New_York')::date between p_from and p_to group by 1) x), '[]'::jsonb),
    'cases_by_stage', coalesce((select jsonb_agg(jsonb_build_object('key', s.key, 'count', coalesce(n, 0)) order by s.sort_order)
                          from public.program_case_stages s
                          left join (select stage_key, count(*) n from cases group by 1) c on c.stage_key = s.key
                          where s.program = p_program and s.active), '[]'::jsonb)
  );
$$;
revoke all on function public.outreach_dashboard(text, date, date) from public, anon;
grant execute on function public.outreach_dashboard(text, date, date) to authenticated;

-- Kept for the app version deployed before O1; same keys as before.
create or replace function public.snap_dashboard(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  select d || jsonb_build_object('referred_to_dhs', d -> 'referred_external')
  from (select public.outreach_dashboard('snap', p_from, p_to) d) x
$$;

-- ============ audit ============
-- Configuration tables keyed by `key` get a record id too, and a program
-- row's own key is its program.
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  the_row jsonb := coalesce(new_row, old_row);
  fields text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into fields
    from jsonb_each(new_row) n
    where n.key not in ('updated_at') and n.value is distinct from old_row -> n.key;
    if fields is null then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    select array_agg(key order by key) into fields from jsonb_object_keys(new_row) key;
  end if;

  insert into public.audit_events (actor_id, action, table_name, record_id, program, changed_fields)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce(the_row ->> 'id', the_row ->> 'user_id', the_row ->> 'key'),
          coalesce(the_row ->> 'program', case when tg_table_name = 'programs' then the_row ->> 'key' end),
          fields);
  return coalesce(new, old);
end;
$$;
revoke all on function public.audit_row_change() from public, anon, authenticated;

create trigger programs_audit after insert or update or delete on public.programs
  for each row execute function public.audit_row_change();
create trigger program_option_sets_audit after insert or update or delete on public.program_option_sets
  for each row execute function public.audit_row_change();
