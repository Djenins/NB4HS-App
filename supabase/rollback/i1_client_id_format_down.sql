-- Undo i1_client_id_format: every client gets their NB-##### ID back, and new
-- clients are numbered from client_number_seq again. Clients created after
-- c2 have no old ID, so they are given the next NB-##### numbers.
begin;
update public.clients set nb_id = legacy_nb_id where legacy_nb_id is not null;

create or replace function public.next_nb_id()
returns text
language sql
set search_path = public
as $$
  select 'NB-' || lpad(nextval('public.client_number_seq')::text, 5, '0');
$$;
revoke execute on function public.next_nb_id() from public, anon;

update public.clients set nb_id = public.next_nb_id() where nb_id !~ '^NB-[0-9]+$';

alter table public.clients drop column legacy_nb_id;
drop function public.format_nb_id(int, int);
drop table public.client_id_counters;
comment on sequence public.client_number_seq is null;
commit;
