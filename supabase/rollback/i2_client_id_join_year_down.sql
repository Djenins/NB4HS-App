-- Undo i2_client_id_join_year: IDs go back to the current year at creation
-- (i1 behaviour). IDs already given out keep their year.
begin;
drop trigger clients_assign_nb_id on public.clients;
drop function public.clients_assign_nb_id();

create or replace function public.next_nb_id()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from (now() at time zone 'America/New_York'))::int;
  n int;
begin
  insert into public.client_id_counters as c (year, last_number) values (y, 1)
  on conflict (year) do update set last_number = c.last_number + 1
  returning c.last_number into n;
  return public.format_nb_id(y, n);
end;
$$;
revoke execute on function public.next_nb_id() from public, anon;
grant execute on function public.next_nb_id() to authenticated;

drop function public.next_nb_id_for_year(int);
alter table public.clients alter column nb_id set default public.next_nb_id();
commit;
