-- Phase 3, part C -- Case Management tables on permissions, and the fix for
-- audit finding S8 (plans/unified-access-architecture.md §2.1, §13 Phase 3).
-- APPLIED to vkbzarlkqzvhsfdmxyyq 2026-10-26 (version 20261026210000), after
-- rolled-back dry runs (parity up and down, p3c_s8_check, an intake round
-- trip through the rollback). Afterwards on live: reverse parity matched the
-- old rules on all 1,440 answers, p3c_s8_check passed, and the p1, p2 and
-- p3a checks passed.
--
-- S8: the client intake form (household, income, immigration and health
-- questions) is shown only to administrators and case managers -- but only
-- by the screen. It was stored in clients.intake_form, and every staff
-- account can read clients, so anyone signed in could fetch it.
--
-- The fix moves intake into its own table, readable and saveable only with
-- case_management.intake.view / .edit (today: administrators and case
-- managers, the same people the screen shows it to):
--   * client_intakes(client_id, form, saved_at, saved_by), audited (field
--     names only -- the form's contents never go into the audit log)
--   * existing intake forms are copied there and cleared from clients
--   * a trigger on clients sends any write to the old columns to
--     client_intakes instead (under its rules), so an older copy of the app
--     still saves intake correctly and can never put it back on clients
--
-- Everything else: NOBODY'S ACCESS CHANGES (parity-tested):
--   clients            read: participants.view   write: participants.edit
--                      (the master record every program shares; all staff today)
--   case_clients       case_management.view / clients.create / edit / delete
--   case_client_notes  case_management.notes.view / notes.create (create also removes)
--
-- Still open, deliberately not changed here: clients' demographic columns
-- (race and ethnicity, gender, household income and size) stay readable by
-- every staff account, as today. Narrowing them to participants.demographics.view
-- is a separate decision.
--
-- Rollback: supabase/rollback/p3c_case_management_policies_down.sql
-- restores the old policies, copies intake back onto clients and drops the
-- new table.

-- ======================================================================
-- 1. client_intakes
-- ======================================================================
create table public.client_intakes (
  client_id uuid primary key references public.clients(id) on delete cascade,
  form jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by uuid references public.profiles(id) on delete set null default auth.uid()
);
alter table public.client_intakes enable row level security;

create policy client_intakes_select on public.client_intakes for select to authenticated
  using ((select public.has_cm_at('case_management.intake.view')));
create policy client_intakes_insert on public.client_intakes for insert to authenticated
  with check ((select public.has_cm_at('case_management.intake.edit')));
create policy client_intakes_update on public.client_intakes for update to authenticated
  using ((select public.has_cm_at('case_management.intake.edit')))
  with check ((select public.has_cm_at('case_management.intake.edit')));
-- No delete policy: an intake is replaced, not deleted (the client's removal cascades).

-- saved_by is whoever saved last, never what the browser claims.
create or replace function public.client_intakes_stamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.saved_by := coalesce(auth.uid(), new.saved_by);
  return new;
end;
$$;
revoke all on function public.client_intakes_stamp() from public, anon, authenticated;
create trigger client_intakes_stamp before insert or update on public.client_intakes
  for each row execute function public.client_intakes_stamp();
create trigger client_intakes_audit after insert or update or delete on public.client_intakes
  for each row execute function public.audit_row_change();

insert into public.client_intakes (client_id, form, saved_at, saved_by)
select id, intake_form, coalesce(intake_form_saved_at, updated_at, now()), null
from public.clients where intake_form is not null;

-- ======================================================================
-- 2. clients: intake columns are write-through only
-- ======================================================================
-- Runs as the person saving, so client_intakes' own rules decide: someone
-- without case_management.intake.edit is refused, as they should be.
create or replace function public.clients_route_intake()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.intake_form is not null then
      raise exception 'save the intake form after the client exists' using errcode = '22023';
    end if;
    new.intake_form_saved_at := null;
    return new;
  end if;
  if new.intake_form is distinct from old.intake_form and new.intake_form is not null then
    insert into public.client_intakes (client_id, form, saved_at)
    values (new.id, new.intake_form, coalesce(new.intake_form_saved_at, now()))
    on conflict (client_id) do update set form = excluded.form, saved_at = excluded.saved_at;
  end if;
  new.intake_form := null;
  new.intake_form_saved_at := null;
  return new;
end;
$$;
revoke all on function public.clients_route_intake() from public, anon, authenticated;

-- Clear the copies (the trigger isn't there yet, so this is a plain update).
update public.clients set intake_form = null, intake_form_saved_at = null
where intake_form is not null or intake_form_saved_at is not null;

create trigger clients_route_intake before insert or update on public.clients
  for each row execute function public.clients_route_intake();

-- ======================================================================
-- 3. clients (master participant record)
-- ======================================================================
drop policy clients_select on public.clients;
drop policy clients_insert on public.clients;
drop policy clients_update on public.clients;
create policy clients_select on public.clients for select to authenticated
  using ((select public.has_permission_at('participants.view', 'program')));
create policy clients_insert on public.clients for insert to authenticated
  with check ((select public.has_permission_at('participants.edit', 'program')));
create policy clients_update on public.clients for update to authenticated
  using ((select public.has_permission_at('participants.edit', 'program')))
  with check ((select public.has_permission_at('participants.edit', 'program')));

-- ======================================================================
-- 4. case_clients and case_client_notes
-- ======================================================================
drop policy case_clients_select on public.case_clients;
drop policy case_clients_insert on public.case_clients;
drop policy case_clients_update on public.case_clients;
drop policy case_clients_delete on public.case_clients;
create policy case_clients_select on public.case_clients for select to authenticated
  using ((select public.has_cm_at('case_management.view')));
create policy case_clients_insert on public.case_clients for insert to authenticated
  with check ((select public.has_cm_at('case_management.clients.create')));
create policy case_clients_update on public.case_clients for update to authenticated
  using ((select public.has_cm_at('case_management.clients.edit')))
  with check ((select public.has_cm_at('case_management.clients.edit')));
create policy case_clients_delete on public.case_clients for delete to authenticated
  using ((select public.has_cm_at('case_management.clients.delete')));

drop policy case_client_notes_select on public.case_client_notes;
drop policy case_client_notes_insert on public.case_client_notes;
drop policy case_client_notes_delete on public.case_client_notes;
create policy case_client_notes_select on public.case_client_notes for select to authenticated
  using ((select public.has_cm_at('case_management.notes.view')));
create policy case_client_notes_insert on public.case_client_notes for insert to authenticated
  with check ((select public.has_cm_at('case_management.notes.create')));
create policy case_client_notes_delete on public.case_client_notes for delete to authenticated
  using ((select public.has_cm_at('case_management.notes.create')));
