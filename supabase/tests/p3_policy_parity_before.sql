-- Phase 3 policy parity, part 1 of 2: run BEFORE a p3 policy migration, in
-- the same transaction (then the migration, then p3_policy_parity_after.sql).
--
-- Creates throwaway accounts for every combination of account type and
-- program role (plus an inactive account and an anonymous visitor), then
-- records, for every policy on the tables in p3_tables, whether it lets each
-- of them through -- with Workforce Development Access both off and on. The
-- after script records the same with the new policies and fails on any
-- difference -- except changes a migration declares on purpose in
-- p3_expected (e.g. p3b's S7 fix). Everything is rolled back by the final raise.
--
-- Settings, read before this script runs:
--   p3.tables   comma-separated tables to compare (default: the Students tables);
--               another schema's table as 'storage.objects'
-- Probe rows may use '$me' (the person's id) and '$myemail' (their email);
-- the person's email is also in their claims, for auth.email().
-- Workforce Development Access is compared three ways: all off, all on, and
-- as it is set on the live database.
--
-- Policies that don't look at the row are evaluated as the person. For
-- tables whose policies do (assigned_to, created_by...), a module's test
-- first creates p3_probes (label, row as jsonb, '$me' standing for the person)
-- -- see p3d_probes.sql. Then each policy is evaluated against every probe
-- row with the person's identity (auth.uid()) but as the table owner, the way
-- a policy expression sees a candidate row. Exists-subqueries in a policy
-- then see every row; they're the same before and after, so the comparison
-- of the role part still holds.
--
--   p3.wf_modes  which Workforce settings to compare (default off,on,live)

create temp table p3_tables (tbl text primary key) on commit drop;
insert into p3_tables
select btrim(t) from unnest(string_to_array(coalesce(nullif(current_setting('p3.tables', true), ''),
  'students,classes,sessions,past_session_students'), ',')) t;
-- Answers a migration changes on purpose: (account type or '*', workforce
-- setting, table, was, now, and optionally a persona pattern such as
-- '%/staff_reports:program_admin'). Filled in by the migration's own test.
create temp table p3_expected (role text, wf text, tbl text, was boolean, now boolean, persona_like text) on commit drop;

create temp table p3_personas (persona text primary key, user_id uuid) on commit drop;
create temp table p3_snap (phase text, wf text, persona text, tbl text, cmd text, kind text, ok boolean) on commit drop;
-- Row mode writes each evaluation here (an ever-growing array is quadratic
-- at this size); the snapshot then folds them into p3_snap.
create temp table p3_raw (persona text, tbl text, cmd text, kind text, ok boolean) on commit drop;
-- Large row-mode runs outlast the default statement timeout.
set statement_timeout = 0;

do $$
declare
  r text;
  pr text;
  uid uuid;
begin
  foreach r in array array['administrator', 'staff', 'receptionist', 'case_manager', 'job_developer'] loop
    foreach pr in array array['', 'snap:worker', 'snap:supervisor', 'snap:program_admin', 'staff_reports:reviewer', 'staff_reports:program_admin'] loop
      uid := gen_random_uuid();
      insert into auth.users (id, email, raw_user_meta_data) values (uid, 'p3-' || uid || '@example.invalid', '{}');
      update public.profiles set role = r, active = true, name = 'P3 ' || r where id = uid;
      if pr <> '' then
        insert into public.program_staff (user_id, program, program_role, active)
        values (uid, split_part(pr, ':', 1), split_part(pr, ':', 2), true);
      end if;
      insert into p3_personas values (r || coalesce('/' || nullif(pr, ''), ''), uid);
    end loop;
  end loop;
  uid := gen_random_uuid();
  insert into auth.users (id, email, raw_user_meta_data) values (uid, 'p3-' || uid || '@example.invalid', '{}');
  update public.profiles set role = 'administrator', active = false where id = uid;
  insert into p3_personas values ('inactive administrator', uid);
  insert into p3_personas values ('anonymous', null);
end $$;

-- 'storage.objects' -> ('storage', 'objects'); 'visits' -> ('public', 'visits').
create function pg_temp.p3_schema(p_tbl text) returns text language sql immutable as $$
  select case when position('.' in p_tbl) > 0 then split_part(p_tbl, '.', 1) else 'public' end $$;
create function pg_temp.p3_name(p_tbl text) returns text language sql immutable as $$
  select case when position('.' in p_tbl) > 0 then split_part(p_tbl, '.', 2) else p_tbl end $$;

-- Evaluates every applicable policy on the p3 tables as every persona. The
-- policy list is read first (as the owner: the temp tables aren't visible to
-- the simulated roles); each expression is then evaluated as the persona.
create function pg_temp.p3_snapshot(p_phase text, p_wf text)
returns void
language plpgsql
as $$
declare
  per record;
  pr record;
  aud text;
  c_tbl text[]; c_cmd text[]; c_kind text[]; c_expr text[];
  res boolean;
  out_rows text[] := '{}';
begin
  for per in select * from p3_personas loop
    aud := case when per.user_id is null then 'anon' else 'authenticated' end;
    -- One row per (table, command, using|check, policy expression); a check
    -- no policy covers gets one row with no expression (= refused).
    select array_agg(x.tbl), array_agg(x.cmd), array_agg(x.kind), array_agg(x.expr)
      into c_tbl, c_cmd, c_kind, c_expr
    from (
      select t.tbl, c.cmd, k.kind, e.expr
      from p3_tables t
      cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) c(cmd)
      cross join (values ('using'), ('check')) k(kind)
      left join lateral (
        -- A policy's WITH CHECK falls back to its USING expression, as in Postgres.
        select case when k.kind = 'using' then p.qual else coalesce(p.with_check, p.qual) end as expr
        from pg_policies p
        where p.schemaname = pg_temp.p3_schema(t.tbl) and p.tablename = pg_temp.p3_name(t.tbl)
          and (p.cmd = c.cmd or p.cmd = 'ALL')
          and (aud = any (p.roles) or 'public' = any (p.roles))
          and (case when k.kind = 'using' then p.qual else coalesce(p.with_check, p.qual) end) is not null
      ) e on true
      where (c.cmd in ('SELECT', 'DELETE') and k.kind = 'using')
         or (c.cmd = 'INSERT' and k.kind = 'check')
         or c.cmd = 'UPDATE'
    ) x;

    if per.user_id is null then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', per.user_id, 'role', 'authenticated',
        'email', (select email from public.profiles where id = per.user_id))::text, true);
    end if;

    if to_regclass('pg_temp.p3_probes') is not null then
      -- Row mode: every expression against every probe row, as the owner.
      for i in 1 .. array_length(c_tbl, 1) loop
        for pr in select * from p3_probes loop
          res := false;
          if c_expr[i] is not null then
            begin
              execute format('select coalesce((%s), false) from (select (jsonb_populate_record(null::%I.%I, $1)).*) as %I',
                             c_expr[i], pg_temp.p3_schema(c_tbl[i]), pg_temp.p3_name(c_tbl[i]), pg_temp.p3_name(c_tbl[i]))
                into res
                using replace(replace(pr.data::text,
                  '"$me"', coalesce(to_json(per.user_id::text)::text, 'null')),
                  '"$myemail"', coalesce(to_json((select email from public.profiles where id = per.user_id))::text, 'null'))::jsonb;
            exception when others then
              res := false;
            end;
          end if;
          insert into p3_raw values (per.persona, c_tbl[i], c_cmd[i], c_kind[i] || '@' || pr.label, coalesce(res, false));
        end loop;
      end loop;
      continue;
    end if;

    if per.user_id is null then
      set local role anon;
    else
      set local role authenticated;
    end if;
    for i in 1 .. array_length(c_tbl, 1) loop
      res := false;
      if c_expr[i] is not null then
        -- An error (e.g. anon may not call has_role) refuses the request in
        -- real life too, so it counts as "no".
        begin
          execute 'select coalesce((' || c_expr[i] || '), false)' into res;
        exception when others then
          res := false;
        end;
      end if;
      out_rows := out_rows || array[per.persona || '|' || c_tbl[i] || '|' || c_cmd[i] || '|' || c_kind[i] || '|' || res];
    end loop;
    reset role;
  end loop;
  insert into p3_snap (phase, wf, persona, tbl, cmd, kind, ok)
  select p_phase, p_wf, split_part(x, '|', 1), split_part(x, '|', 2), split_part(x, '|', 3), split_part(x, '|', 4),
         bool_or(split_part(x, '|', 5)::boolean)
  from unnest(out_rows) x
  group by 1, 2, 3, 4, 5, 6;
  insert into p3_snap (phase, wf, persona, tbl, cmd, kind, ok)
  select p_phase, p_wf, persona, tbl, cmd, kind, bool_or(ok) from p3_raw group by persona, tbl, cmd, kind;
  truncate p3_raw;
end;
$$;

-- All off, all on, then as it is set now.
create temp table p3_wf_saved on commit drop as select role, enabled from public.workforce_role_access;
create function pg_temp.p3_snapshot_all(p_phase text)
returns void
language plpgsql
as $$
declare
  modes text[] := string_to_array(coalesce(nullif(current_setting('p3.wf_modes', true), ''), 'off,on,live'), ',');
begin
  if 'off' = any (modes) then
    update public.workforce_role_access set enabled = false;
    perform pg_temp.p3_snapshot(p_phase, 'off');
  end if;
  if 'on' = any (modes) then
    update public.workforce_role_access set enabled = true;
    perform pg_temp.p3_snapshot(p_phase, 'on');
  end if;
  update public.workforce_role_access w set enabled = s.enabled from p3_wf_saved s where s.role = w.role;
  if 'live' = any (modes) then
    perform pg_temp.p3_snapshot(p_phase, 'live');
  end if;
end;
$$;
select pg_temp.p3_snapshot_all('before');
