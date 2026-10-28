-- t1 -- tasks (follow-ups) stop being SNAP-only, and the reminder job is
-- fixed (plans/launch-audit-2026-10-28.md, "P1 -- SNAP tasks" and
-- "Proposal: cross-program tasks").
-- NOT APPLIED to the hosted project. Tested on the local stack only:
-- SNAP policy parity (p3_policy_parity_before/after with p3d_probes, tables
-- 'tasks') and supabase/tests/t1_tasks_check.sql. Undo with
-- supabase/rollback/t1_cross_program_tasks_down.sql.
--
-- NOBODY'S ACCESS CHANGES. Every task today is an Outreach task (program
-- 'snap'), and an Outreach task keeps exactly today's rule: can_on_record()
-- on '<module>.tasks.view' / '.manage', where the module is the program's
-- Outreach module ('snap'). A task outside Outreach has no program; it is
-- checked against '<module>.tasks.view' / '.manage' with the same scope
-- rules (own / assigned / program-or-wider). No such permission exists yet,
-- so those tasks are closed to everyone until a later change adds the keys
-- and grants them -- turning tasks on for Case Management or Workforce is
-- that decision, not this one.
--
--   tasks.module                which module the task belongs to; filled in
--                               from the program for Outreach tasks, and
--                               fixed once the task exists
--   tasks.subject_type / _id    an optional record the task is about
--                               (a placement, an employer...), as a pair;
--                               client_id and case_id stay as they are
--
-- Reminders (send_task_reminders, replacing snap_send_task_reminders in the
-- 'snap-task-reminders' job):
--   * hourly from 7:00 to 19:59 NB4HS time instead of once at 11:00 UTC, so
--     a task added after the morning run and due today is still reminded
--   * one "due" reminder per task, assignee and due date (a reassigned or
--     re-dated task is reminded again; the old key had no assignee) and one
--     "overdue" nudge the day after the due date
--   * only to an assignee who can open the task
--   * the notification links to the program's Follow-ups page
-- Reminders already sent are carried over, so nobody is reminded twice for
-- the same task, assignee and date when this goes live. The old function and
-- task_reminders_sent stay, unused, for the rollback.

-- ======================================================================
-- 1. Columns
-- ======================================================================
alter table public.tasks
  add column module text references public.app_modules (key) on delete restrict,
  add column subject_type text check (subject_type ~ '^[a-z][a-z_]*$'),
  add column subject_id uuid,
  add constraint tasks_subject_pair check ((subject_type is null) = (subject_id is null)),
  alter column program drop not null;

-- The backfill isn't an edit: no updated_at bump and no audit row per task.
alter table public.tasks disable trigger user;
update public.tasks set module = public.outreach_module(program);
alter table public.tasks enable trigger user;
alter table public.tasks alter column module set not null;

create index tasks_module_due_idx on public.tasks (module, due_date);
create index tasks_subject_idx on public.tasks (subject_type, subject_id) where subject_type is not null;

-- An Outreach task's module is its program's module. A task created for any
-- other module has no program (this also undoes the column's 'snap'
-- default). Once a task exists it stays in its module.
create or replace function public.task_module_rules()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  pm text;
begin
  if tg_op = 'INSERT' and new.module is not null
     and not exists (select 1 from public.app_modules m where m.key = new.module and m.outreach_program is not null) then
    new.program := null;
  end if;
  if new.program is not null then
    pm := public.outreach_module(new.program);
    if pm is null then
      raise exception 'program % has no Outreach module', new.program using errcode = '23514';
    end if;
    if new.module is not null and new.module <> pm then
      raise exception 'task module % does not match program %', new.module, new.program using errcode = '23514';
    end if;
    new.module := pm;
  elsif new.module is null then
    raise exception 'a task needs a module or an Outreach program' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and new.module is distinct from old.module then
    raise exception 'a task cannot move to another module' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.task_module_rules() from public, anon, authenticated;
create trigger tasks_module_rules before insert or update on public.tasks
  for each row execute function public.task_module_rules();

-- ======================================================================
-- 2. Permissions
-- ======================================================================
-- p_action is 'view' or 'manage'. p_assigned is the task's assignee,
-- p_owner its creator where "own" applies (null where it doesn't), as in
-- can_on_record().
create or replace function public.can_on_task(p_action text, p_module text, p_program text, p_assigned uuid, p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_action not in ('view', 'manage') then false
    when p_program is not null then
      public.can_on_record(public.outreach_module(p_program) || '.tasks.' || p_action, p_program, p_assigned, p_owner)
    else coalesce((
      select s.rnk >= 4
          or (s.rnk >= 2 and p_assigned is not null and p_assigned = auth.uid())
          or (s.rnk >= 1 and p_owner is not null and p_owner = auth.uid())
      from (select public.access_scope_rank(public.permission_scope(p_module || '.tasks.' || p_action, p_module)) as rnk) s),
      false)
  end;
$$;
revoke all on function public.can_on_task(text, text, text, uuid, uuid) from public, anon;
grant execute on function public.can_on_task(text, text, text, uuid, uuid) to authenticated;

drop policy tasks_select on public.tasks;
drop policy tasks_insert on public.tasks;
drop policy tasks_update on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_on_task('view', module, program, assigned_to, created_by));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (created_by = auth.uid() and source = 'manual' and automation_key is null
              and public.can_on_task('manage', module, program, assigned_to, null)
              and (case_id is null or exists (select 1 from public.assistance_cases c where c.id = tasks.case_id)));
create policy tasks_update on public.tasks for update to authenticated
  using (public.can_on_task('manage', module, program, assigned_to, null))
  with check (public.can_on_task('manage', module, program, assigned_to, null));

-- ======================================================================
-- 3. Reminders
-- ======================================================================
create table public.task_notices_sent (
  notice_key text primary key,
  sent_at timestamptz not null default now()
);
alter table public.task_notices_sent enable row level security;
-- No policies: only send_task_reminders() (security definer) touches it.

insert into public.task_notices_sent (notice_key, sent_at)
select 'due:' || r.task_id || ':' || t.assigned_to || ':' || r.due_date, r.sent_at
from public.task_reminders_sent r
join public.tasks t on t.id = r.task_id
where t.assigned_to is not null
on conflict do nothing;

-- `p_now` exists so the checks can move the clock; the cron job always calls
-- it with the default. Returns how many notifications were sent.
create or replace function public.send_task_reminders(p_now timestamptz default now())
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  local_now timestamp := p_now at time zone 'America/New_York';
  today date := local_now::date;
  sent integer := 0;
  n integer;
  t record;
begin
  if extract(hour from local_now) not between 7 and 19 then
    return 0;
  end if;
  for t in
    select tk.id, tk.title, tk.due_date, tk.assigned_to, tk.program,
           case when tk.due_date < today then 'overdue' else 'due' end as kind
    from public.tasks tk
    join public.profiles p on p.id = tk.assigned_to and p.active
    where tk.status = 'open' and tk.due_date between today - 1 and today + 1
      and exists (select 1 from public.user_effective_permissions e
                  where e.user_id = tk.assigned_to and e.permission_key = tk.module || '.tasks.view'
                    and (e.program_key = tk.module or e.program_key = '')
                    and (public.access_scope_rank(e.scope) >= 2
                         or (public.access_scope_rank(e.scope) >= 1 and tk.created_by = tk.assigned_to)))
  loop
    insert into public.task_notices_sent (notice_key)
    values (t.kind || ':' || t.id || ':' || t.assigned_to || ':' || t.due_date)
    on conflict do nothing;
    get diagnostics n = row_count;
    continue when n = 0;
    insert into public.notifications (user_id, type, title, message, link)
    values (t.assigned_to,
            case t.kind when 'due' then 'snap_task_due' else 'task_overdue' end,
            case t.kind when 'due' then 'Follow-up due' else 'Follow-up overdue' end,
            left(t.title, 120) || ' — ' || to_char(t.due_date, 'YYYY-MM-DD'),
            case when t.program is not null then '/' || t.program || '/tasks' end);
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke all on function public.send_task_reminders(timestamptz) from public, anon, authenticated;

-- Five past each hour; the function itself skips the night.
select cron.schedule('snap-task-reminders', '5 * * * *', $$select public.send_task_reminders()$$);

-- ======================================================================
-- 4. Realtime
-- ======================================================================
-- Subscribers only receive rows their select policy lets them read.
alter publication supabase_realtime add table public.tasks;
