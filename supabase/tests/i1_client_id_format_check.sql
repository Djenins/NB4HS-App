-- Checks for i1_client_id_format. Run AFTER the migration; ends by raising
-- 'I1_CHECKS_PASSED', so nothing is committed.
do $$
declare
  yy text := to_char(now() at time zone 'America/New_York', 'YY');
  before_max int;
  a text; b text;
  n int;
begin
  -- Every client has the new format, and every re-numbered one kept its old ID.
  select count(*) into n from public.clients where nb_id !~ '^NB[0-9]{2}-[0-9]{4,}$';
  if n > 0 then raise exception 'i1: % clients still have an old-format nb_id', n; end if;
  select count(*) into n from public.clients where legacy_nb_id is not null and legacy_nb_id !~ '^NB-[0-9]+$';
  if n > 0 then raise exception 'i1: % legacy_nb_id values are not NB-#####', n; end if;

  -- Formatting, including past 9,999.
  if public.format_nb_id(2026, 1) <> 'NB26-0001' then raise exception 'i1: format_nb_id(2026,1) = %', public.format_nb_id(2026, 1); end if;
  if public.format_nb_id(2026, 12345) <> 'NB26-12345' then raise exception 'i1: format_nb_id overflow = %', public.format_nb_id(2026, 12345); end if;

  -- New clients continue this year's counter, one apart, no gaps or repeats.
  select coalesce(max(split_part(nb_id, '-', 2)::int), 0) into before_max from public.clients where nb_id like 'NB' || yy || '-%';
  insert into public.clients (first_name, last_name, phone) values ('I1', 'Check one', '401-555-0100') returning nb_id into a;
  insert into public.clients (first_name, last_name, phone) values ('I1', 'Check two', '401-555-0101') returning nb_id into b;
  if a <> public.format_nb_id(2000 + yy::int, before_max + 1) then raise exception 'i1: first new id % (expected after %)', a, before_max; end if;
  if b <> public.format_nb_id(2000 + yy::int, before_max + 2) then raise exception 'i1: second new id %', b; end if;

  -- The counter table is not reachable through the API.
  if has_table_privilege('authenticated', 'public.client_id_counters', 'select') then raise exception 'i1: authenticated can read client_id_counters'; end if;
  if has_function_privilege('anon', 'public.next_nb_id()', 'execute') then raise exception 'i1: anon can call next_nb_id'; end if;

  raise exception 'I1_CHECKS_PASSED';
end $$;
