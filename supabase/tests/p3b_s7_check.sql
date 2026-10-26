-- S7 is fixed, not just unchanged: run after p3_policy_parity_before.sql,
-- p3b_expected.sql, the p3b migration and p3_policy_parity_after.sql (with
-- p3.keep_going on). Ends by raising P3B_S7_FIXED, so nothing is committed.
do $$
declare
  a boolean;
begin
  -- Setting on: a case manager and a staff member can read employers and job seekers.
  select ok into a from p3_snap where phase = 'after' and wf = 'on' and persona = 'case_manager' and tbl = 'employers' and cmd = 'SELECT';
  if a is not true then raise exception 'FAIL: case manager with Workforce access still refused employers'; end if;
  select ok into a from p3_snap where phase = 'after' and wf = 'on' and persona = 'staff' and tbl = 'job_clients' and cmd = 'SELECT';
  if a is not true then raise exception 'FAIL: staff with Workforce access still refused job seekers'; end if;
  -- ...but writing job seekers stays with the participant pages.
  select ok into a from p3_snap where phase = 'after' and wf = 'on' and persona = 'staff' and tbl = 'job_clients' and cmd = 'INSERT';
  if a is not false then raise exception 'FAIL: Workforce access let staff add job seekers'; end if;
  -- Setting off: a job developer is refused employers, keeps job seekers.
  select ok into a from p3_snap where phase = 'after' and wf = 'off' and persona = 'job_developer' and tbl = 'employers' and cmd = 'SELECT';
  if a is not false then raise exception 'FAIL: job developer without Workforce access still reads employers'; end if;
  select ok into a from p3_snap where phase = 'after' and wf = 'off' and persona = 'job_developer' and tbl = 'job_clients' and cmd = 'UPDATE';
  if a is not true then raise exception 'FAIL: job developer lost their job seekers'; end if;
  -- As set today: no answer changed at all.
  if exists (select 1 from p3_snap b join p3_snap n on n.phase = 'after' and b.phase = 'before' and n.wf = 'live' and b.wf = 'live'
             and n.persona = b.persona and n.tbl = b.tbl and n.cmd = b.cmd and n.kind = b.kind where n.ok is distinct from b.ok) then
    raise exception 'FAIL: an answer changed with the setting as it is today';
  end if;
  raise exception 'P3B_S7_FIXED: Workforce data follows the setting; % intended changes, none with today''s settings',
    (select count(*) from p3_snap b join p3_snap n on n.phase = 'after' and b.phase = 'before' and n.wf = b.wf
       and n.persona = b.persona and n.tbl = b.tbl and n.cmd = b.cmd and n.kind = b.kind where n.ok is distinct from b.ok);
end $$;
