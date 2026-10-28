-- The "no active System Administrator" guard (p1b) against the three ways a
-- database can be short of administrators. Ends by raising
-- 'P1B_BOOTSTRAP_PASSED', so everything rolls back. Needs the local seed's
-- administrator 00000000-0000-4000-a000-000000000001; LOCAL STACK ONLY -- it
-- switches the guard triggers off inside its transaction to set up each case.
create or replace function pg_temp.guards(b boolean) returns void language plpgsql as $$
begin
  if b then
    alter table public.profiles enable trigger zz_profiles_admin_remains;
    alter table public.user_roles enable trigger zz_user_roles_admin_remains;
  else
    alter table public.profiles disable trigger zz_profiles_admin_remains;
    alter table public.user_roles disable trigger zz_user_roles_admin_remains;
  end if;
end $$;

do $$
declare
  admin uuid := '00000000-0000-4000-a000-000000000001';
  first_user uuid := '00000000-0000-4000-a000-0000000000ff';
  msg text;
begin
  -- 1. The only active account is an administrator: switching it off is refused.
  perform pg_temp.guards(false);
  update public.profiles set active = false where id <> admin;
  perform pg_temp.guards(true);
  msg := null;
  begin
    update public.profiles set active = false where id = admin;
  exception when others then msg := sqlerrm; end;
  if msg is distinct from 'this would leave no active System Administrator' then
    raise exception 'FAIL: the last active administrator could be deactivated (%)', msg;
  end if;

  -- 2. A database that never had an administrator (a new project): the first
  --    sign-up goes through with the guard on.
  perform pg_temp.guards(false);
  update public.profiles set role = 'staff', active = false;
  perform pg_temp.guards(true);
  insert into auth.users (id, email, raw_user_meta_data) values (first_user, 'first@example.test', '{}');

  -- 3. The bootstrap in plans/deploy-and-operations.md makes them a System Administrator.
  perform pg_temp.guards(false);
  update public.profiles set role = 'administrator', active = true where id = first_user;
  perform pg_temp.guards(true);
  if not public.is_system_admin(first_user) then
    raise exception 'FAIL: the bootstrapped account is not a System Administrator';
  end if;

  raise exception 'P1B_BOOTSTRAP_PASSED';
end $$;
