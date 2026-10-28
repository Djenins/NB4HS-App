# Deploy and operations

What a deployment of NB4HS needs, in the order it needs it. Written 2026-10-28 from the repo (`.env.example`, `vercel.json`, `supabase/functions/*`, `supabase/migrations/*`). Nothing here was run against the hosted project or Vercel. Use it for a fresh NB4HS-owned setup ([nb4hs-accounts-checklist.md](nb4hs-accounts-checklist.md)) or to check the current one.

## 1. Variables and secrets

### Vercel (the web app)

These are build-time values, and Vite puts them in the browser bundle, so they must never hold a secret.

| Name | Required | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` (Supabase → Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | yes | The publishable / anon key from the same page. Never the `service_role` key |
| `VITE_AUTH_MODEL` | no | Leave unset for the permission model. Set `legacy` only to go back to account-type navigation |

The routing in `vercel.json` sends every path except `/assets/…` to `index.html`. It needs no setup.

### Supabase Edge Function secrets

Set these with `supabase secrets set …` or in the dashboard. Every function already gets `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` automatically.

| Function | Name | Required | Purpose |
|---|---|---|---|
| `admin-users` | `SITE_URL` | **yes, on a custom domain** | Where the links in invite and password-reset emails point. The function trusts the caller's origin only for `https://nb4hs-app*.vercel.app` and `http://localhost:*` (`handler.ts` `redirectFor`). Any other domain falls back to `SITE_URL`, then to the built-in default |
| `send-outbound` | `CRON_SECRET` | for email | Shared with the Vault secret `send_outbound_secret` |
| `send-outbound` | `RESEND_API_KEY` | for email | The email provider key. The sending domain must be verified with the provider |
| `send-outbound` | `EMAIL_FROM` | for email | For example `NB4HS Reports <reports@nb4hs.org>` |
| `send-outbound` | `APP_URL` | no | The link in emails. Defaults to `https://nb4hs-app.vercel.app`, so **set it on any other domain** |

Deploy commands:
- `supabase functions deploy admin-users`
- `supabase functions deploy send-outbound --no-verify-jwt`. The cron job signs its calls with `CRON_SECRET` instead of a user session.

### Supabase Vault (read by the `send-outbound` cron job)

| Name | Value |
|---|---|
| `send_outbound_url` | `https://<project-ref>.supabase.co/functions/v1/send-outbound` |
| `send_outbound_secret` | The same value as `CRON_SECRET` |

Until both exist, the job does nothing. Emails stay queued and the app says email is pending. In-app notices work either way.

### Supabase Auth settings (dashboard, not migrations)

- **Site URL:** the production app URL.
- **Redirect URLs:** add `<app URL>/reset-password` for each domain in use, including Vercel preview URLs if previews are used for testing.
- **SMTP:** the built-in Supabase mailer is meant for testing and has a low hourly limit. For password resets and invites in production, set custom SMTP (Auth → SMTP). It can be the same provider as `send-outbound`.

## 2. Migration order

`supabase/migrations/` is the source of truth, and the files apply in filename (timestamp) order. `supabase db reset --local` replays all 67 in that order on an empty database, so the order is tested locally as of 2026-10-28.

**Rules that apply to every hosted change** (from `goals.md`): a `begin … rollback` dry run of the migration plus its probe in `supabase/tests/`, then explicit approval, then apply. Rollback scripts live in `supabase/rollback/`.

**Known points in the chain:**

| File | Note |
|---|---|
| `…084229_p0a_security_hotfixes` | Its probe `p0a_security_check.sql` is stale by design, because `p0b` closed the path it checks. Use `p0b_security_check.sql` |
| `…071541_stage2b_schedule_task_reminders` | Enables `pg_cron`. `p6b` enables `pg_net`. Both are free extensions built into Supabase |
| `…161100_p1b_access_foundation` | Edited 2026-10-28: the admin guard skips a database with no active account that never had an administrator, so a new project can be built and its first user can sign up. A deactivated last administrator is still protected. It behaves the same on live, which has active administrators |
| `…20261027030000_p6b_outbound_email` | Email stays idle until the secrets in §1 are set |
| `…20261028010000_t1_cross_program_tasks` | **Not on live.** It needs its dry run and your approval (see `launch-audit-2026-10-28.md`) |
| `…20261028020000_t2_report_time_label` | **Not on live.** It adds the time zone to staff report email times; replaces one function. It needs its dry run and your approval |
| `…20261028030000_t3_receptionist_check_in_only` | **Not on live.** Receptionists lose participant records and keep check-in. Deploy the app change (kiosk-roster fallback) at the same time or before |
| `…20261028040000_t4_staff_report_rules` | **Not on live.** It adds the report period, revision, schedule-lock, attachment and DST rules. Deploy the app change (reviewer reads via `staff_reports_in_revision()`) at the same time or before, or reviewers won't see reports in revision |

**Which files are on live (checked 2026-10-28, read-only):**
- All 63 versions recorded on the hosted project match a file here.
- Only `t1`–`t4` (`20261028010000` … `20261028040000`) are pending.
- **Version fix (`230bfcd`).** Four files carried different version numbers from live: `adult_education_courses`, `case_resources`, `case_client_self_registration` and `staff_availability_booking`. Their SQL matched what live recorded, so they were renamed to live's versions. Before that, `supabase db push` would have run them a second time.
- **Before any push,** repeat the comparison: list `supabase_migrations.schema_migrations.version` on the project and compare it with this folder's filenames.

**Applying `t1`–`t4` (REQUIRES OWNER APPROVAL)**
1. **Deploy the app first.** This branch works both before and after the migrations.
2. **Repeat the dry runs** described in `launch-audit-2026-10-28.md` ("Live dry runs") if anything changed since 2026-10-28.
3. **Apply in order:** `t1`, `t2`, `t3`, `t4`. Each file is one transaction.
4. **Re-run each check against live afterwards.** Each check still ends by raising, so it writes nothing.
5. **Rollback scripts** are in `supabase/rollback/`. Run them newest first, if needed.

**Building a new project from scratch:**
1. `supabase link --project-ref <new-ref>`, then `supabase db push`. This replays every migration in order, each in its own transaction.
2. Create the first administrator. The guard against "no active System Administrator" fires partway through this one change, before the account's permissions are refreshed. Run it as one transaction in the SQL editor with the two guards off:
   ```sql
   begin;
   alter table public.profiles disable trigger zz_profiles_admin_remains;
   alter table public.user_roles disable trigger zz_user_roles_admin_remains;
   update public.profiles set role = 'administrator', active = true where id = '<auth user id>';
   alter table public.profiles enable trigger zz_profiles_admin_remains;
   alter table public.user_roles enable trigger zz_user_roles_admin_remains;
   select public.is_system_admin('<auth user id>');  -- must return true before you commit
   commit;
   ```
   The user signs up through Auth first; that works with the guards on. `supabase/tests/p1b_bootstrap_check.sql` tests this sequence locally.
3. Deploy the two functions and set the secrets in §1.
4. Set the Auth settings in §1.

**Storage buckets** come from migrations, so there is nothing to create by hand:
- `client-documents`
- `staff-report-files`, limited to 10 MB and a list of allowed file types

**Scheduled jobs** come from migrations (`select jobname, schedule from cron.job`):

| Job | Schedule (UTC) | Runs |
|---|---|---|
| `send-outbound` | every 5 minutes | `invoke_send_outbound()`. Does nothing without the Vault secrets |
| `snap-task-reminders` | `5 * * * *` after `t1`; `0 11 * * *` before | `send_task_reminders()` after `t1`; `snap_send_task_reminders()` before |
| `staff-report-reminders` | `7 * * * *` | `staff_reports_tick()` |

## 3. Synthetic data reset (local only)

The local stack is described in `README-Dev.md`. To start from a clean, fake-only database:

```bash
colima start
supabase start
supabase db reset --local      # wipes local data, replays every migration, runs supabase/seed.sql
```

`seed.sql` creates seven fake staff accounts on `example.test` with the password `local-dev-only`, and no participants. The probes in `supabase/tests/` create and roll back their own rows.

**Never run `seed.sql` or `db reset` against the hosted project.** The repo is linked to it, so any command without `--local` reaches production.

There is no reset for the hosted database, and there should not be one. Real participant data never goes into local, test or preview environments.
