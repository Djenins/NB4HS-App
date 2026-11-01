-- Applied on live (vkbzarlkqzvhsfdmxyyq) 2026-11-01 as version 20261101091506:
-- 3 clients re-numbered NB-00003/05/06 -> NB26-0001/02/03.
-- i1: client IDs become NB<yy>-<nnnn> (NB26-0001): the year the client joined,
-- then a counter that restarts each year. Replaces NB-#####.
--
-- Every existing client is re-numbered: by the year their record was created
-- (New York time), in creation order within that year. The old ID is kept in
-- clients.legacy_nb_id so old links (/clients/NB-00046) and searches still
-- find the person. Student display IDs (next_student_display_id) are not
-- touched; they keep NB-#####, which also keeps the two kinds of ID apart.
--
-- Every screen reads nb_id through a join on clients, and nothing stores a
-- copy of it, so updating the column re-labels the client everywhere.

-- ============ per-year counter ============
-- One row per year. Only next_nb_id() (security definer) touches it, so RLS
-- is on with no policies and the API roles get no grants.
create table public.client_id_counters (
  year int primary key,
  last_number int not null default 0
);
alter table public.client_id_counters enable row level security;
revoke all on public.client_id_counters from public, anon, authenticated;

-- NB26-0001. Past 9,999 in a year the number simply grows (NB26-10000):
-- lpad() would truncate it instead.
create or replace function public.format_nb_id(p_year int, p_n int)
returns text
language sql
immutable
set search_path = public
as $$
  select 'NB' || lpad((p_year % 100)::text, 2, '0') || '-'
    || case when p_n < 10000 then lpad(p_n::text, 4, '0') else p_n::text end;
$$;
revoke execute on function public.format_nb_id(int, int) from public, anon;

-- The column default for clients.nb_id. The upsert takes a row lock on the
-- year's counter, so two clients created at once can't get the same number.
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

-- ============ keep the old ID ============
alter table public.clients add column legacy_nb_id text unique;

-- ============ re-number existing clients ============
-- Only rows still carrying an NB-##### ID, so a re-run touches nothing.
-- New IDs (NB26-…) can't collide with old ones (NB-…) mid-update.
with ordered as (
  select id, nb_id,
         extract(year from (created_at at time zone 'America/New_York'))::int as y,
         row_number() over (
           partition by extract(year from (created_at at time zone 'America/New_York'))
           order by created_at, nb_id
         )::int as n
  from public.clients
  where legacy_nb_id is null and nb_id ~ '^NB-[0-9]+$'
)
update public.clients c
set legacy_nb_id = o.nb_id, nb_id = public.format_nb_id(o.y, o.n)
from ordered o
where c.id = o.id;

-- Start each year's counter after the highest number handed out above.
insert into public.client_id_counters (year, last_number)
select (2000 + split_part(substr(nb_id, 3), '-', 1)::int), max(split_part(nb_id, '-', 2)::int)
from public.clients
where nb_id ~ '^NB[0-9]{2}-[0-9]+$'
group by 1
on conflict (year) do update set last_number = greatest(public.client_id_counters.last_number, excluded.last_number);

-- The old sequence is no longer used by anything; kept so the rollback can
-- restore it without renumbering.
comment on sequence public.client_number_seq is 'Retired by i1_client_id_format; NB-##### IDs now live in clients.legacy_nb_id.';
