-- Phase 3 policy parity, part 2 of 2: run AFTER the p3 policy migration (and
-- optionally again after its rollback file, with p3.phase set to 'down').
-- Compares with what p3_policy_parity_before.sql recorded and fails on any
-- difference not listed in p3_expected. Ends by raising P3_PARITY_PASSED, so nothing is committed.
do $$
declare
  v_phase text := coalesce(nullif(current_setting('p3.phase', true), ''), 'after');
begin
  update public.workforce_role_access set enabled = false;
  perform pg_temp.p3_snapshot(v_phase, 'off');
  update public.workforce_role_access set enabled = true;
  perform pg_temp.p3_snapshot(v_phase, 'on');
  update public.workforce_role_access w set enabled = s.enabled from p3_wf_saved s where s.role = w.role;
  perform pg_temp.p3_snapshot(v_phase, 'live');
end $$;

do $$
declare
  v_phase text := coalesce(nullif(current_setting('p3.phase', true), ''), 'after');
  diffs text;
  n int;
  intended int;
  checked int;
begin
  select count(*), string_agg(format('%s (workforce %s) %s %s %s: was %s, now %s', b.persona, b.wf, b.tbl, b.cmd, b.kind, b.ok, a.ok), E'\n')
    into n, diffs
  from p3_snap b join p3_snap a
    on a.phase = v_phase and b.phase = 'before'
   and a.wf = b.wf and a.persona = b.persona and a.tbl = b.tbl and a.cmd = b.cmd and a.kind = b.kind
  where a.ok is distinct from b.ok
    and not exists (select 1 from p3_expected e
                    where e.role = split_part(b.persona, '/', 1) and e.wf = b.wf and e.tbl = b.tbl
                      and e.was = b.ok and e.now = a.ok);
  select count(*) into intended
  from p3_snap b join p3_snap a
    on a.phase = v_phase and b.phase = 'before'
   and a.wf = b.wf and a.persona = b.persona and a.tbl = b.tbl and a.cmd = b.cmd and a.kind = b.kind
  where a.ok is distinct from b.ok;
  select count(*) into checked from p3_snap where p3_snap.phase = v_phase;
  if checked = 0 or checked <> (select count(*) from p3_snap where p3_snap.phase = 'before') then
    raise exception 'FAIL: % checks recorded for %, % before', checked, v_phase, (select count(*) from p3_snap where p3_snap.phase = 'before');
  end if;
  if n > 0 then
    raise exception 'FAIL: % policy answers changed:%', n, E'\n' || diffs;
  end if;
  if current_setting('p3.keep_going', true) = 'on' then
    raise notice 'P3 parity ok for % (% checks, % intended changes)', v_phase, checked, intended;
  else
    raise exception 'P3_PARITY_PASSED % checks for % personas, Workforce access off / on / as set, no unintended changes, % intended (%)',
      checked, (select count(*) from p3_personas), intended, v_phase;
  end if;
end $$;
