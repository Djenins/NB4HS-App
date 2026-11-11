-- a1_switch_keeps_access_check.sql -- switching anyone to access levels,
-- with the levels the Access tab fills in from what they have today
-- (src/lib/accessLevels.js), takes nothing away. Run in a transaction
-- that is rolled back; needs the seeded accounts. Prints what each person
-- gains, and raises if anyone loses anything.
--   psql ... -X --single-transaction -v ON_ERROR_STOP=1 -f supabase/tests/a1_switch_keeps_access_check.sql
create temp table _before as
  select user_id, permission_key, program_key from public.user_effective_permissions;

-- The Access tab's reading of a person's levels (accessFromPermissionRows).
create or replace function pg_temp.levels_of(u uuid) returns jsonb language sql as $$
  select jsonb_object_agg(m.prog, case
    when exists (select 1 from public.user_effective_permissions e where e.user_id = u and e.program_key = m.prog and e.permission_key = m.manager) then 'manager'
    when exists (select 1 from public.user_effective_permissions e where e.user_id = u and e.program_key = m.prog and e.permission_key = m.staff) then 'staff'
    else 'none' end)
  from (values ('case_management', 'case_management.view', 'case_management.reports.view'),
               ('students', 'students.view', 'students.delete'),
               ('workforce', 'workforce.view', 'workforce.reports.view'),
               ('food_distribution', 'food_distribution.view', 'food_distribution.reports.view'),
               ('snap', 'snap.view', 'snap.reports.view')) as m(prog, staff, manager);
$$;
create or replace function pg_temp.holds_any(u uuid, k text) returns boolean language sql as $$
  select exists (select 1 from public.user_effective_permissions where user_id = u and permission_key = k and program_key = '');
$$;

-- Act as the first administrator; switch everyone else who is active.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-a000-000000000001', 'role', 'authenticated')::text, true);
create temp table _who as
  select id from public.profiles where active and id <> '00000000-0000-4000-a000-000000000001';
create temp table _levels as
  select id, pg_temp.levels_of(id) as levels, pg_temp.holds_any(id, 'front_desk.checkin') as front_desk,
         pg_temp.holds_any(id, 'admin.permissions.assign') as admin
  from _who;
select public.admin_set_access_levels(id, levels, front_desk, admin, 'parity check') from _levels;

-- Gains, for the record.
select p.email, string_agg(a.permission_key || coalesce(nullif(' (' || a.program_key || ')', ' ()'), ''), ', ' order by a.permission_key) as gains
from (select user_id, permission_key, program_key from public.user_effective_permissions
      except select * from _before) a
join public.profiles p on p.id = a.user_id
where a.user_id in (select id from _who)
group by p.email order by p.email;

do $$
declare lost text;
begin
  select string_agg(p.email || ': ' || b.permission_key || coalesce(nullif(' (' || b.program_key || ')', ' ()'), ''), E'\n')
    into lost
  from (select * from _before where user_id in (select id from _who)
        except select user_id, permission_key, program_key from public.user_effective_permissions) b
  join public.profiles p on p.id = b.user_id;
  if lost is not null then raise exception E'switching took access away:\n%', lost; end if;
end $$;
\echo a1 switch check passed: nobody lost access
