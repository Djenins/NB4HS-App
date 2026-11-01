-- Applied on live (vkbzarlkqzvhsfdmxyyq) 2026-11-01 as version 20261101092314.
-- i2: a client's ID carries the year they joined, not the year their record
-- was typed in. Someone imported now with an intake date in 2019 gets
-- NB19-0001, NB19-0002, …; a client with no intake date (or one in the
-- future) gets the current year, as before.
--
-- The ID moves from a column default to a BEFORE INSERT trigger, because a
-- default can't see the row's intake_date. Every path that creates a client
-- (create_*_client RPCs, self-registration, SNAP contacts, imports) inserts
-- intake_date in the same statement, so they all get this without changes.
-- An insert that sets nb_id itself keeps it.

-- Next number for a given year. Not an RPC: only the trigger below calls it,
-- so staff can't burn numbers in arbitrary years.
create or replace function public.next_nb_id_for_year(p_year int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.client_id_counters as c (year, last_number) values (p_year, 1)
  on conflict (year) do update set last_number = c.last_number + 1
  returning c.last_number into n;
  return public.format_nb_id(p_year, n);
end;
$$;
revoke execute on function public.next_nb_id_for_year(int) from public, anon, authenticated;

-- The current year, for anything that still asks for a plain next ID.
create or replace function public.next_nb_id()
returns text
language sql
security definer
set search_path = public
as $$
  select public.next_nb_id_for_year(extract(year from (now() at time zone 'America/New_York'))::int);
$$;
revoke execute on function public.next_nb_id() from public, anon;
grant execute on function public.next_nb_id() to authenticated;

create or replace function public.clients_assign_nb_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'America/New_York')::date;
begin
  if new.nb_id is null then
    new.nb_id := public.next_nb_id_for_year(extract(year from
      case when new.intake_date is not null and new.intake_date <= today then new.intake_date else today end)::int);
  end if;
  return new;
end;
$$;
revoke all on function public.clients_assign_nb_id() from public, anon, authenticated;

alter table public.clients alter column nb_id drop default;
create trigger clients_assign_nb_id before insert on public.clients
  for each row execute function public.clients_assign_nb_id();
