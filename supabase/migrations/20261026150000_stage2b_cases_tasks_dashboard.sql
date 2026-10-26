-- SNAP Outreach Stage 2b -- assistance cases, case notes, stage history,
-- follow-up tasks, the dashboard aggregate and task reminders
-- (plans/snap-outreach-architecture.md §4, §5, §7). ADDITIVE ONLY. NOT YET APPLIED.
-- The pg_cron schedule that calls snap_send_task_reminders() is a separate
-- migration (stage2b_schedule_task_reminders).
--
-- Scope rules (2026-10-26 decisions):
-- * NB4HS assists; it does not decide eligibility. Nothing here records an
--   approval/denial/enrollment status -- stages describe NB4HS's own work.
--   (Recording a participant-reported DHS outcome is an open decision.)
-- * Workers see and work only the cases assigned to them; supervisors and
--   program admins see the whole program. Case notes follow case access, so a
--   system administrator without a SNAP role reads none.
-- * Closing a case requires a closure reason, and supervisor approval when
--   the closing stage is configured to require review.
-- * Automation is idempotent (unique automation_key) and audited.

-- ============ shared helpers ============
-- NB4HS's local date. Supabase runs in UTC; "due today" must mean Providence's today.
create or replace function public.snap_today()
returns date
language sql stable set search_path = public
as $$ select (now() at time zone 'America/New_York')::date $$;
grant execute on function public.snap_today() to authenticated;

create or replace function public.is_program_lead(p_program text)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.has_program_role(p_program, array['supervisor', 'program_admin']) $$;
revoke all on function public.is_program_lead(text) from public, anon;
grant execute on function public.is_program_lead(text) to authenticated;

-- ============ program_case_stages (configurable) ============
create table public.program_case_stages (
  program text not null check (program in ('snap')),
  key text not null,
  label_en text not null,
  label_ht text not null,
  label_fr text not null,
  sort_order int not null,
  is_terminal boolean not null default false,
  requires_review boolean not null default false,
  active boolean not null default true,
  primary key (program, key)
);
alter table public.program_case_stages enable row level security;
create policy program_case_stages_select on public.program_case_stages for select to authenticated
  using (has_program_role(program, array['worker', 'supervisor', 'program_admin']));
create policy program_case_stages_write on public.program_case_stages for all to authenticated
  using (has_program_role(program, array['program_admin'])) with check (has_program_role(program, array['program_admin']));

insert into public.program_case_stages (program, key, label_en, label_ht, label_fr, sort_order, is_terminal) values
  ('snap', 'new_inquiry',          'New inquiry',                     'Nouvo demann',                     'Nouvelle demande',                     10, false),
  ('snap', 'contact_attempted',    'Contact attempted',               'Eseye kontakte',                   'Tentative de contact',                 20, false),
  ('snap', 'initial_consultation', 'Initial consultation',            'Premye konsiltasyon',              'Première consultation',                30, false),
  ('snap', 'assistance_planned',   'Application assistance planned',  'Asistans pou aplikasyon planifye', 'Aide à la demande prévue',             40, false),
  ('snap', 'assistance_provided',  'Application assistance provided', 'Asistans pou aplikasyon bay',      'Aide à la demande fournie',            50, false),
  ('snap', 'awaiting_participant', 'Awaiting participant action',     'Ap tann aksyon patisipan an',      'En attente du participant',            60, false),
  ('snap', 'referred_to_dhs',      'Referred to Rhode Island DHS',    'Refere bay DHS Rhode Island',      'Orienté vers le DHS de Rhode Island',  70, false),
  ('snap', 'follow_up_required',   'Follow-up required',              'Bezwen swivi',                     'Suivi nécessaire',                     80, false),
  ('snap', 'assistance_completed', 'Assistance completed',            'Asistans fini',                    'Aide terminée',                        90, false),
  ('snap', 'closed',               'Closed',                          'Fèmen',                            'Clôturé',                             100, true);

-- ============ assistance_cases ============
create sequence public.snap_case_number_seq;
create or replace function public.next_snap_case_number()
returns text
language sql volatile security definer set search_path = public
as $$ select 'SNAP-' || to_char(public.snap_today(), 'YYYY') || '-' || lpad(nextval('public.snap_case_number_seq')::text, 5, '0') $$;
revoke all on function public.next_snap_case_number() from public, anon;
grant execute on function public.next_snap_case_number() to authenticated;

create table public.assistance_cases (
  id uuid primary key default gen_random_uuid(),
  program text not null default 'snap' check (program in ('snap')),
  case_number text not null unique default public.next_snap_case_number(),
  client_id uuid not null references public.clients(id) on delete cascade,
  outreach_contact_id uuid not null references public.outreach_contacts(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  opened_at date not null default public.snap_today(),
  stage_key text not null default 'new_inquiry',
  assistance_requested text[] not null default '{}',
  assistance_provided text[] not null default '{}',
  application_assisted_at date,
  referred_to_dhs_at date,
  follow_up_date date,
  closure_reason text check (closure_reason in ('assistance_completed', 'participant_declined', 'unable_to_contact', 'referred_elsewhere', 'moved_away', 'duplicate_case', 'other')),
  closed_at timestamptz,
  supervisor_review_status text not null default 'not_requested'
    check (supervisor_review_status in ('not_requested', 'requested', 'approved', 'changes_requested')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (program, stage_key) references public.program_case_stages (program, key),
  check (assistance_requested <@ array['application_help', 'recertification', 'general_information', 'document_help', 'interview_preparation', 'ebt_card_help', 'other']::text[]),
  check (assistance_provided <@ array['application_help', 'recertification', 'general_information', 'document_help', 'interview_preparation', 'ebt_card_help', 'other']::text[])
);
create index assistance_cases_program_stage_idx on public.assistance_cases (program, stage_key);
create index assistance_cases_assigned_idx on public.assistance_cases (assigned_to) where closed_at is null;
create index assistance_cases_client_idx on public.assistance_cases (client_id);
create index assistance_cases_contact_idx on public.assistance_cases (outreach_contact_id);
create index assistance_cases_opened_idx on public.assistance_cases (program, opened_at);
create trigger assistance_cases_set_updated_at before update on public.assistance_cases
  for each row execute function public.set_updated_at();

alter table public.assistance_cases enable row level security;
create policy assistance_cases_select on public.assistance_cases for select to authenticated
  using (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])));
create policy assistance_cases_insert on public.assistance_cases for insert to authenticated
  with check (
    created_by = auth.uid()
    and (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])))
    and exists (select 1 from public.outreach_contacts oc
                where oc.id = outreach_contact_id and oc.client_id = assistance_cases.client_id and oc.program = assistance_cases.program)
  );
create policy assistance_cases_update on public.assistance_cases for update to authenticated
  using (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])))
  with check (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])));
-- No delete policy: cases are closed, never removed.

-- Case rules, enforced in the database so every client path obeys them.
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

  -- Record when NB4HS's own milestones first happened.
  if new.stage_key = 'assistance_provided' and new.application_assisted_at is null then
    new.application_assisted_at := public.snap_today();
  end if;
  if new.stage_key = 'referred_to_dhs' and new.referred_to_dhs_at is null then
    new.referred_to_dhs_at := public.snap_today();
  end if;
  return new;
end;
$$;
revoke all on function public.assistance_case_rules() from public, anon, authenticated;
create trigger assistance_cases_rules before insert or update on public.assistance_cases
  for each row execute function public.assistance_case_rules();

-- ============ case_stage_history ============
create table public.case_stage_history (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.assistance_cases(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index case_stage_history_case_idx on public.case_stage_history (case_id, changed_at);
alter table public.case_stage_history enable row level security;
create policy case_stage_history_select on public.case_stage_history for select to authenticated
  using (exists (select 1 from public.assistance_cases c where c.id = case_id));
-- Rows only arrive through the trigger below.

create or replace function public.record_case_stage_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.stage_key is distinct from old.stage_key then
    insert into public.case_stage_history (case_id, from_stage, to_stage, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.stage_key end, new.stage_key, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.record_case_stage_change() from public, anon, authenticated;
create trigger assistance_cases_stage_history after insert or update of stage_key on public.assistance_cases
  for each row execute function public.record_case_stage_change();

-- ============ assistance_case_notes ============
-- The most restricted data in the module: readable only by whoever can see
-- the case (assigned worker, supervisors, program admins). Append-only.
create table public.assistance_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.assistance_cases(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index assistance_case_notes_case_idx on public.assistance_case_notes (case_id, created_at desc);
alter table public.assistance_case_notes enable row level security;
create policy assistance_case_notes_select on public.assistance_case_notes for select to authenticated
  using (exists (select 1 from public.assistance_cases c where c.id = case_id));
create policy assistance_case_notes_insert on public.assistance_case_notes for insert to authenticated
  with check (created_by = auth.uid() and exists (select 1 from public.assistance_cases c where c.id = case_id));

-- ============ tasks (follow-ups) ============
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  program text not null default 'snap' check (program in ('snap')),
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 1000),
  assigned_to uuid references public.profiles(id) on delete set null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  completed_at timestamptz,
  completion_notes text check (char_length(completion_notes) <= 1000),
  client_id uuid references public.clients(id) on delete cascade,
  case_id uuid references public.assistance_cases(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'automation')),
  automation_key text unique,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assigned_open_idx on public.tasks (assigned_to, due_date) where status = 'open';
create index tasks_program_due_idx on public.tasks (program, due_date);
create index tasks_case_idx on public.tasks (case_id);
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create or replace function public.task_status_rules()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.task_status_rules() from public, anon, authenticated;
create trigger tasks_status_rules before insert or update on public.tasks
  for each row execute function public.task_status_rules();

alter table public.tasks enable row level security;
create policy tasks_select on public.tasks for select to authenticated
  using (is_program_lead(program)
         or ((assigned_to = auth.uid() or created_by = auth.uid()) and has_program_role(program, array['worker'])));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (
    created_by = auth.uid() and source = 'manual' and automation_key is null
    and (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])))
    and (case_id is null or exists (select 1 from public.assistance_cases c where c.id = case_id))
  );
create policy tasks_update on public.tasks for update to authenticated
  using (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])))
  with check (is_program_lead(program) or (assigned_to = auth.uid() and has_program_role(program, array['worker'])));

-- Automation rule 1: a new case gets an initial follow-up for its worker,
-- due two days after opening. Idempotent via automation_key.
create or replace function public.create_initial_case_task()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.tasks (program, title, assigned_to, due_date, client_id, case_id, source, automation_key, created_by)
  values (new.program, 'Initial follow-up: ' || new.case_number, coalesce(new.assigned_to, new.created_by),
          new.opened_at + 2, new.client_id, new.id, 'automation', 'case_opened:' || new.id, new.created_by)
  on conflict (automation_key) do nothing;
  return new;
end;
$$;
revoke all on function public.create_initial_case_task() from public, anon, authenticated;
create trigger assistance_cases_initial_task after insert on public.assistance_cases
  for each row execute function public.create_initial_case_task();

-- ============ reminders (called daily by pg_cron) ============
-- One in-app notification per task per due date, for open tasks due today
-- or tomorrow (NB4HS local time). The message carries only the task title
-- and due date -- never case details.
create table public.task_reminders_sent (
  task_id uuid not null references public.tasks(id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (task_id, due_date)
);
alter table public.task_reminders_sent enable row level security;
-- No policies: only snap_send_task_reminders() (security definer) touches it.

create or replace function public.snap_send_task_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  sent integer := 0;
  t record;
begin
  for t in
    select tk.id, tk.title, tk.due_date, tk.assigned_to
    from public.tasks tk
    join public.profiles p on p.id = tk.assigned_to and p.active
    where tk.status = 'open' and tk.due_date between public.snap_today() and public.snap_today() + 1
      and not exists (select 1 from public.task_reminders_sent r where r.task_id = tk.id and r.due_date = tk.due_date)
  loop
    insert into public.task_reminders_sent (task_id, due_date) values (t.id, t.due_date);
    insert into public.notifications (user_id, type, title, message)
    values (t.assigned_to, 'snap_task_due', 'Follow-up due',
            left(t.title, 120) || ' — ' || to_char(t.due_date, 'YYYY-MM-DD'));
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke all on function public.snap_send_task_reminders() from public, anon, authenticated;

-- ============ dashboard aggregate ============
-- SECURITY INVOKER on purpose: every count respects the caller's RLS, so a
-- worker's dashboard covers their own cases and tasks while contacts and
-- activity (readable by every member) are program-wide.
create or replace function public.snap_dashboard(p_from date, p_to date)
returns jsonb
language sql stable security invoker set search_path = public
as $$
  with
  inter as (select * from public.outreach_interactions where program = 'snap' and (occurred_at at time zone 'America/New_York')::date between p_from and p_to),
  cases as (select * from public.assistance_cases where program = 'snap'),
  tk as (select * from public.tasks where program = 'snap' and status <> 'cancelled')
  select jsonb_build_object(
    'individuals_contacted', (select count(distinct client_id) from inter),
    'interactions', (select count(*) from inter),
    'new_contacts', (select count(*) from public.outreach_contacts where program = 'snap' and (created_at at time zone 'America/New_York')::date between p_from and p_to),
    'cases_opened', (select count(*) from cases where opened_at between p_from and p_to),
    'applications_assisted', (select count(*) from cases where application_assisted_at between p_from and p_to),
    'referred_to_dhs', (select count(*) from cases where referred_to_dhs_at between p_from and p_to),
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
                                where program = 'snap' and (created_at at time zone 'America/New_York')::date between p_from and p_to group by 1) x), '[]'::jsonb),
    'cases_by_stage', coalesce((select jsonb_agg(jsonb_build_object('key', s.key, 'count', coalesce(n, 0)) order by s.sort_order)
                          from public.program_case_stages s
                          left join (select stage_key, count(*) n from cases group by 1) c on c.stage_key = s.key
                          where s.program = 'snap' and s.active), '[]'::jsonb)
  );
$$;
revoke all on function public.snap_dashboard(date, date) from public, anon;
grant execute on function public.snap_dashboard(date, date) to authenticated;

-- ============ audit ============
create trigger assistance_cases_audit after insert or update or delete on public.assistance_cases
  for each row execute function public.audit_row_change();
create trigger assistance_case_notes_audit after insert or update or delete on public.assistance_case_notes
  for each row execute function public.audit_row_change();
create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.audit_row_change();
create trigger program_case_stages_audit after insert or update or delete on public.program_case_stages
  for each row execute function public.audit_row_change();
