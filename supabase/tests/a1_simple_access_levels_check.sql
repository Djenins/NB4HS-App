-- a1_simple_access_levels_check.sql -- run inside a transaction that is
-- rolled back; needs the seeded accounts (admin1, casemgr, staff, ...).
--   psql ... -X --single-transaction -v ON_ERROR_STOP=1 -f supabase/tests/a1_simple_access_levels_check.sql
-- Raises on the first failed check; prints "a1 checks passed" at the end.
\set admin1 '00000000-0000-4000-a000-000000000001'
\set casemgr '00000000-0000-4000-a000-000000000005'
\set staff '00000000-0000-4000-a000-000000000003'
\set frontdesk '00000000-0000-4000-a000-000000000004'

create temp table _eff_before as
  select user_id, permission_key, program_key from public.user_effective_permissions;
create temp table _ps_before as select * from public.program_staff;

create or replace function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.holds(u uuid, k text, prog text default '') returns boolean language sql as $$
  select exists (select 1 from public.user_effective_permissions where user_id = u and permission_key = k and program_key = prog);
$$;
create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if; end; $$;

-- 1. Nothing changes for anyone on its own.
select pg_temp.check((select count(*) from public.profiles where access_mode <> 'account_type') = 0, 'everyone starts on account_type');

-- 2. Staff can't call it; nobody can call it on themselves.
select pg_temp.as_user(:'staff');
do $$ begin
  perform public.admin_set_access_levels('00000000-0000-4000-a000-000000000005', '{"students":"staff"}', false, false, 'test');
  raise exception 'FAILED: staff could set levels';
exception when insufficient_privilege then null; end $$;
select pg_temp.as_user(:'admin1');
do $$ begin
  perform public.admin_set_access_levels('00000000-0000-4000-a000-000000000001', '{}', false, true, 'test');
  raise exception 'FAILED: admin could set own levels';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform public.admin_set_access_levels('00000000-0000-4000-a000-000000000005', '{"students":"boss"}', false, false, 'test');
  raise exception 'FAILED: unknown level accepted';
exception when invalid_parameter_value then null; end $$;

-- 3. Case manager -> levels: Case Management Manager, Students Staff, front desk.
select public.admin_set_access_levels(:'casemgr',
  '{"workforce":"none","snap":"none","students":"staff","case_management":"manager","food_distribution":"none"}', true, false, 'moving to levels');
select pg_temp.check((select access_mode = 'levels' and role = 'case_manager' from public.profiles where id = :'casemgr'), 'mode and account type');
select pg_temp.check(not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = :'casemgr' and ur.revoked_at is null and r.key like 'legacy_%'), 'legacy roles gone');
select pg_temp.check(pg_temp.holds(:'casemgr', 'case_management.reports.view', 'case_management'), 'CM manager has reports');
select pg_temp.check(pg_temp.holds(:'casemgr', 'students.view', 'students'), 'students staff can view');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'students.delete', 'students'), 'students staff cannot delete');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'students.sessions.manage', ''), 'students staff cannot run sessions');
select pg_temp.check(pg_temp.holds(:'casemgr', 'front_desk.checkin', ''), 'front desk on');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'workforce.view', 'workforce'), 'no workforce');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'admin.view', ''), 'not an admin');
-- Changing the account type in levels mode adds nothing back.
reset role;
update public.profiles set role = 'administrator' where id = :'casemgr';
select pg_temp.check(not pg_temp.holds(:'casemgr', 'admin.view', ''), 'account type ignored in levels mode');
update public.profiles set role = 'case_manager' where id = :'casemgr';

-- 4. Lower a level and turn things off.
select pg_temp.as_user(:'admin1');
select public.admin_set_access_levels(:'casemgr', '{"case_management":"staff","snap":"staff"}', false, false, 'adjust');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'case_management.reports.view', 'case_management'), 'CM lowered to staff');
select pg_temp.check(pg_temp.holds(:'casemgr', 'case_management.view', 'case_management'), 'CM staff can view');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'students.view', 'students'), 'students removed');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'front_desk.checkin', ''), 'front desk off');
select pg_temp.check(pg_temp.holds(:'casemgr', 'snap.view', 'snap'), 'snap staff through program_staff');
select pg_temp.check((select program_role = 'worker' and active from public.program_staff where user_id = :'casemgr' and program = 'snap'), 'snap worker row');
select pg_temp.check(not pg_temp.holds(:'casemgr', 'snap.reports.view', 'snap'), 'snap worker has no reports');

-- 5. Administrator switch on someone else, then the self-change guard on the column.
select public.admin_set_access_levels(:'staff', '{"food_distribution":"manager"}', false, true, 'make admin');
select pg_temp.check((select role = 'administrator' from public.profiles where id = :'staff'), 'admin account type');
select pg_temp.check(pg_temp.holds(:'staff', 'admin.permissions.assign', ''), 'admin powers');
select pg_temp.check(pg_temp.holds(:'staff', 'communications.newsletters.send', ''), 'organization tools');
select pg_temp.check(not pg_temp.holds(:'staff', 'case_management.view', 'case_management'), 'admin gets no case data by itself');
select public.admin_set_access_levels(:'staff', '{"food_distribution":"staff"}', false, false, 'not admin');
select pg_temp.check(not pg_temp.holds(:'staff', 'admin.view', ''), 'admin removed');
select pg_temp.check((select role = 'staff' from public.profiles where id = :'staff'), 'account type back to staff');

select pg_temp.as_user(:'casemgr');
set local role authenticated;
do $$ begin
  update public.profiles set access_mode = 'account_type' where id = '00000000-0000-4000-a000-000000000005';
  raise exception 'FAILED: user switched own access mode';
exception when insufficient_privilege then null; end $$;
reset role;

-- 6. Back to the account type restores the old access exactly.
select pg_temp.as_user(:'admin1');
select public.admin_use_account_type(:'casemgr', 'undo');
select public.admin_set_access_levels(:'staff', '{}', false, false, 'tmp');
select public.admin_use_account_type(:'staff', 'undo');
-- Step 4 changed SNAP on its own staff page row; put it back as it was.
delete from public.program_staff where user_id = :'casemgr';
insert into public.program_staff select * from _ps_before where user_id = :'casemgr';
select pg_temp.check(not exists (
  (select user_id, permission_key, program_key from public.user_effective_permissions where user_id in (:'casemgr', :'staff')
   except select * from _eff_before where user_id in (:'casemgr', :'staff'))
  union all
  (select * from _eff_before where user_id in (:'casemgr', :'staff')
   except select user_id, permission_key, program_key from public.user_effective_permissions where user_id in (:'casemgr', :'staff'))
), 'switching back restores the exact old access');

-- 6b. Going back restores the account type they had before, even though
-- the levels changed it (staff -> case_manager here).
select public.admin_set_access_levels(:'staff', '{"case_management":"staff"}', false, false, 'covering');
select pg_temp.check((select role = 'case_manager' and account_type_before_levels = 'staff' from public.profiles where id = :'staff'), 'type follows levels, old type kept');
select public.admin_use_account_type(:'staff', 'done covering');
select pg_temp.check((select role = 'staff' and account_type_before_levels is null and access_mode = 'account_type' from public.profiles where id = :'staff'), 'old type restored');
select pg_temp.check(not exists (select 1 from public.user_program_access where user_id = :'staff' and revoked_at is null and source = 'admin'),
  'no program access left over from the levels');
select pg_temp.check(not exists (
  (select user_id, permission_key, program_key from public.user_effective_permissions where user_id = :'staff'
   except select * from _eff_before where user_id = :'staff')
  union all
  (select * from _eff_before where user_id = :'staff'
   except select user_id, permission_key, program_key from public.user_effective_permissions where user_id = :'staff')
), 'old access restored after a type-changing switch');
select pg_temp.as_user(:'staff');
set local role authenticated;
do $$ begin
  update public.profiles set account_type_before_levels = 'administrator' where id = '00000000-0000-4000-a000-000000000003';
  raise exception 'FAILED: user planted an account type to come back to';
exception when insufficient_privilege then null; end $$;
reset role;
select pg_temp.as_user(:'admin1');

-- 7. A Students Manager whose account type is staff can start a session.
select public.admin_set_access_levels(:'frontdesk', '{"students":"manager"}', false, false, 'students lead');
select pg_temp.check((select role = 'staff' from public.profiles where id = :'frontdesk'), 'students-only -> staff');
select pg_temp.as_user(:'frontdesk');
set local role authenticated;
select pg_temp.check((select (public.start_new_session(current_date, current_date + 90)).is_current), 'students manager can start a session');
reset role;

\echo a1 checks passed
