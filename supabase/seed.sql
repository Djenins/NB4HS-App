-- seed.sql -- synthetic accounts for the LOCAL Supabase stack only.
-- `supabase db reset --local` runs this after replaying every migration.
-- Never run it against the hosted project: the names, emails and password
-- below are fake and the password is public in this repo.
--
-- One active account per account type (two administrators, because some
-- supabase/tests probes borrow a second one), plus one inactive account.
-- Every account signs in locally with the password: local-dev-only
-- Emails are on example.test, which can never receive mail.
--
-- No participant data: the probes in supabase/tests create and roll back
-- their own throwaway rows.

-- The "no active System Administrator" guards (p1b) fire mid-way through
-- activating the very first administrator, before that account's
-- permissions are refreshed. Seeding an empty database is the one case with
-- nobody to protect, so they are off for these statements only.
alter table public.profiles disable trigger zz_profiles_admin_remains;
alter table public.user_roles disable trigger zz_user_roles_admin_remains;
alter table public.user_permission_overrides disable trigger zz_user_permission_overrides_admin_remains;
alter table public.role_permissions disable trigger zz_role_permissions_admin_remains;
alter table public.roles disable trigger zz_roles_admin_remains;

do $$
declare
  acct record;
  uid uuid;
begin
  for acct in
    select * from (values
      ('00000000-0000-4000-a000-000000000001'::uuid, 'admin1@example.test',     'Ada Admin',        'administrator', true),
      ('00000000-0000-4000-a000-000000000002'::uuid, 'admin2@example.test',     'Ben Backup-Admin', 'administrator', true),
      ('00000000-0000-4000-a000-000000000003'::uuid, 'staff@example.test',      'Sam Staff',        'staff',         true),
      ('00000000-0000-4000-a000-000000000004'::uuid, 'frontdesk@example.test',  'Rae Reception',    'receptionist',  true),
      ('00000000-0000-4000-a000-000000000005'::uuid, 'casemgr@example.test',    'Cam Casemanager',  'case_manager',  true),
      ('00000000-0000-4000-a000-000000000006'::uuid, 'jobdev@example.test',     'Jo Jobdeveloper',  'job_developer', true),
      ('00000000-0000-4000-a000-000000000007'::uuid, 'inactive@example.test',   'Ina Inactive',     'staff',         false)
    ) as t(id, email, name, role, active)
    order by id  -- the first administrator becomes active before anyone else
  loop
    uid := acct.id;
    -- handle_new_user() creates the profile (inactive, never administrator).
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', acct.email,
      extensions.crypt('local-dev-only', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', acct.name), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, 'email',
            jsonb_build_object('sub', uid::text, 'email', acct.email, 'email_verified', true), now(), now(), now());
    -- Role and status as an administrator would set them; the profile
    -- triggers then sync the legacy access rows.
    update public.profiles set role = acct.role, active = acct.active, name = acct.name where id = uid;
  end loop;
end $$;

-- SNAP program roles, so Outreach shows up for someone other than admins.
insert into public.program_staff (user_id, program, program_role, active) values
  ('00000000-0000-4000-a000-000000000003', 'snap', 'worker', true),
  ('00000000-0000-4000-a000-000000000005', 'snap', 'supervisor', true);

alter table public.profiles enable trigger zz_profiles_admin_remains;
alter table public.user_roles enable trigger zz_user_roles_admin_remains;
alter table public.user_permission_overrides enable trigger zz_user_permission_overrides_admin_remains;
alter table public.role_permissions enable trigger zz_role_permissions_admin_remains;
alter table public.roles enable trigger zz_roles_admin_remains;

-- Fail the reset loudly if the seed left no administrator.
do $$
begin
  if not exists (select 1 from public.user_effective_permissions e join public.profiles p on p.id = e.user_id and p.active
                 where e.permission_key = 'admin.permissions.assign') then
    raise exception 'seed.sql: no active System Administrator after seeding';
  end if;
end $$;
