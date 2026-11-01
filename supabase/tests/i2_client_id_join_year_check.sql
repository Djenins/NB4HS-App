-- Checks for i2_client_id_join_year. Run AFTER the migration; ends by raising
-- 'I2_CHECKS_PASSED', so nothing is committed.
do $$
declare
  yy text := to_char(now() at time zone 'America/New_York', 'YY');
  a text; b text; c text; d text; e text; f text;
begin
  -- Two clients who joined in 2019 get consecutive 2019 numbers.
  insert into public.clients (first_name, last_name, phone, intake_date) values ('I2', 'Old one', '401-555-0100', '2019-03-04') returning nb_id into a;
  insert into public.clients (first_name, last_name, phone, intake_date) values ('I2', 'Old two', '401-555-0101', '2019-11-30') returning nb_id into b;
  if a !~ '^NB19-[0-9]{4}$' or b !~ '^NB19-[0-9]{4}$' then raise exception 'i2: 2019 ids are % and %', a, b; end if;
  if split_part(b, '-', 2)::int <> split_part(a, '-', 2)::int + 1 then raise exception 'i2: 2019 ids not consecutive: % then %', a, b; end if;

  -- No intake date, or one in the future: the current year.
  insert into public.clients (first_name, last_name, phone) values ('I2', 'No date', '401-555-0102') returning nb_id into c;
  insert into public.clients (first_name, last_name, phone, intake_date) values ('I2', 'Future', '401-555-0103', current_date + 400) returning nb_id into d;
  if c !~ ('^NB' || yy || '-') or d !~ ('^NB' || yy || '-') then raise exception 'i2: current-year ids are % and %', c, d; end if;

  -- An insert that brings its own nb_id keeps it.
  insert into public.clients (nb_id, first_name, last_name, phone) values ('NB99-9999', 'I2', 'Explicit', '401-555-0104') returning nb_id into e;
  if e <> 'NB99-9999' then raise exception 'i2: explicit nb_id replaced with %', e; end if;

  -- Staff creating a client through the API path still get an ID.
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  if has_function_privilege('authenticated', 'public.next_nb_id_for_year(int)', 'execute') then raise exception 'i2: authenticated can call next_nb_id_for_year'; end if;
  select public.next_nb_id() into f;
  if f !~ ('^NB' || yy || '-') then raise exception 'i2: next_nb_id() gave %', f; end if;

  raise exception 'I2_CHECKS_PASSED';
end $$;
