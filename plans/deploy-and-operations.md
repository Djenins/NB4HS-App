# Deploy and operations

What a deployment of NB4HS needs, in the order it needs it. Written 2026-10-28 from the repo (`.env.example`, `vercel.json`, `supabase/functions/*`, `supabase/migrations/*`). **Last checked against live 2026-10-29, read-only** (see [launch-readiness-2026-10-29.md](launch-readiness-2026-10-29.md)). Use it for a fresh NB4HS-owned setup ([nb4hs-accounts-checklist.md](nb4hs-accounts-checklist.md)) or to check the current one.

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
| `admin-users` | `SITE_URL` | **yes, on a custom domain**. Set to `https://app.nb4hs.org` on 2026-10-28 | Where the links in invite and password-reset emails point. The function trusts the caller's origin only for `https://nb4hs-app*.vercel.app` and `http://localhost:*` (`handler.ts` `redirectFor`). Any other domain falls back to `SITE_URL`, then to the built-in default |
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

**State on live (2026-10-29, read-only):** email is **not set up**. Only `admin-users` is deployed (`send-outbound` is not), the Vault holds no secrets, and the queue is empty. Report notices are in-app only until §1 is done, and password resets still go through Supabase's built-in mailer.

### Supabase Auth settings (dashboard, not migrations)

- **Site URL:** the production app URL.
- **Redirect URLs:** add `<app URL>/reset-password` for each domain in use, including Vercel preview URLs if previews are used for testing.
- **SMTP:** the built-in Supabase mailer is meant for testing and has a low hourly limit. For password resets and invites in production, set custom SMTP (Auth → SMTP). It can be the same provider as `send-outbound`.

## 2. Migration order

`supabase/migrations/` is the source of truth, and the files apply in filename (timestamp) order. `supabase db reset --local` replays all 72 in that order on an empty database (71 tested 2026-10-29, then all 17 SQL checks pass; `c1` tested on its own 2026-10-30).

**Rules that apply to every hosted change** (from `goals.md`): a `begin … rollback` dry run of the migration plus its probe in `supabase/tests/`, then explicit approval, then apply. Rollback scripts live in `supabase/rollback/`.

**Known points in the chain:**

| File | Note |
|---|---|
| `…084229_p0a_security_hotfixes` | Its probe `p0a_security_check.sql` is stale by design, because `p0b` closed the path it checks. Use `p0b_security_check.sql` |
| `…071541_stage2b_schedule_task_reminders` | Enables `pg_cron`. `p6b` enables `pg_net`. Both are free extensions built into Supabase |
| `…161100_p1b_access_foundation` | Edited 2026-10-28: the admin guard skips a database with no active account that never had an administrator, so a new project can be built and its first user can sign up. A deactivated last administrator is still protected. It behaves the same on live, which has active administrators |
| `…20261027030000_p6b_outbound_email` | Email stays idle until the secrets in §1 are set |
| `…20261028010000_t1_cross_program_tasks` | **Applied 2026-10-28.** SNAP tasks can carry a module; the hourly reminder job is live |
| `…20261028020000_t2_report_time_label` | **Applied 2026-10-28.** Staff report email times show EST/EDT |
| `…20261028030000_t3_receptionist_check_in_only` | **Applied 2026-10-28.** Receptionists lose participant records. A signed-in receptionist needs this branch's app (kiosk-roster fallback) for the student roster |
| `…20261028040000_t4_staff_report_rules` | **Applied 2026-10-28.** Report period, revision, schedule-lock, attachment and DST rules. Reviewers need this branch's app to see reports in revision |
| `…20261028050000_t5_notifications_read_only` … `…20261028070000_t7_calendar_privacy` | **Applied 2026-10-28**, after the app (PR #66). Owner decisions from the live security checks; see `security-decisions-2026-10-28.md`. The throttle's off-switch is in that file |
| `…20261029010000_t8_rate_limit_hardening` | **On live** (recorded by 2026-10-30). Fixes four t6 problems found 2026-10-29 (race, signed-in bypass, spoofable fallback IP, no cleanup) and raises the kiosk poll limits; see [launch-readiness-2026-10-29.md](launch-readiness-2026-10-29.md) |
| `…20261030010000_c1_communications` | **Applied 2026-10-30** (approved), before the app (PR #75). Rolled-back dry run with `c1_communications_check.sql` passed, then applied in one transaction, then the checks passed again on live. Its `schema_migrations.statements` holds a one-line pointer to the file, not the full SQL. Rollback: `supabase/rollback/c1_communications_down.sql`. See [communications-module.md](communications-module.md) |

**Which files are on live (checked 2026-10-29, read-only; updated 2026-10-30):**
- Live records 72 versions, `20260714145927` … `20261030010000`, each matching a file here. None is pending. (On 2026-10-29 it recorded 70, with `t8` pending; `t8` and `c1` have been applied since.)
- The comparison below was made on 2026-10-29, before `t8` and `c1`.
- **What is applied matches the repo.** 864 items compared with a fresh local replay: 212 policies, the RLS flags on 78 tables, 300 grant sets, 144 functions, 97 triggers, 3 cron jobs, 2 buckets, 27 realtime tables and the PostgREST hook. Two functions differ:
  - `assert_system_admin_remains`: the documented bootstrap edit to `p1b` (local only; live never takes that branch).
  - `public_register_case_client`: comments only.
- **Version fix (`230bfcd`).** Four files carried different version numbers from live: `adult_education_courses`, `case_resources`, `case_client_self_registration` and `staff_availability_booking`. Their SQL matched what live recorded, so they were renamed to live's versions. Before that, `supabase db push` would have run them a second time.
- **Before any push,** repeat the comparison: list `supabase_migrations.schema_migrations.version` on the project and compare it with this folder's filenames.

**`t1`–`t7` were applied on 2026-10-28** (approved), each in one transaction with its `schema_migrations` row under the file's version, in order, with the app deployed first where it mattered (PRs #64 and #66). The production app has since moved on (PRs #68 and #69, 2026-10-29).

**How future migrations should go:**
1. Dry run with `begin … rollback`.
2. Get approval.
3. Apply the file together with `insert into supabase_migrations.schema_migrations (version, name, statements, created_by)` in one transaction, so the recorded version matches the filename.
4. Re-run its checks.

Every check here runs against live only as a `begin … rollback` dry run, and only with approval: even rolled back, they write. Read-only checks (counts, `pg_policies`, the fingerprint in `launch-readiness-2026-10-29.md`) need no transaction tricks.

**Rolling a migration back.** Scripts in `supabase/rollback/`, newest first, each in one transaction after a dry run, only for a database problem and with approval. What they can't undo:
- **`t1`** refuses while a task exists outside SNAP or records a subject. Since 2026-10-29 it copies the due reminders t1 sent into the old table and keeps `task_notices_sent` as `task_notices_sent_rolled_back`, so nobody is reminded twice. **To re-apply t1 after that**, run the migration and `supabase/rollback/t1_reapply_restore_notices.sql` in one transaction.
- **`t4`–`t7`** put back the old, looser rules: reviewers could again read revisions in progress, staff could edit their notification text, the open functions lose their throttle, and everyone reads appointment names and notes again.
- **Rows written under a migration stay.** A rollback never deletes reports, tasks, notifications or visits.
- **The app.** Roll back the app first if the problem is in the app. The database rollbacks are for database problems only.

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
| `api-rate-hits-cleanup` | `*/10 * * * *` | after `t8` only: deletes throttle rows older than an hour |

## 2a. Backups and recovery

Checked 2026-10-29, read-only:
- **Plan:** the project is on Supabase **Pro**, in the personal organization "Djenins's Org", not an NB4HS one.
- **Backups:** Pro includes daily backups with a short retention. Whether point-in-time recovery is on can't be seen from the repo or the API used here. **An owner should check Database → Backups** and record the retention.
- **Nothing in the repo backs up storage.** The `client-documents` and `staff-report-files` buckets aren't in database backups. Decide whether they need a separate copy.
- **Restoring** replaces the whole database with an earlier state, and everything since is lost. Restore into a new project first if only part of the data is needed. Never restore real data into a local, preview or test project.
- **Nobody has tested a restore.** Before relying on it, an owner should restore a backup into a new, separate project once, then delete that project.

## 2b. Who owns what (2026-10-29)

| Service | Where it is today | Owner today |
|---|---|---|
| Code | GitHub `Djenins/NB4HS-App` | a personal account |
| Hosting | Vercel project `nb4hs-app`, team `marcdeeh`; domains `app.nb4hs.org`, `nb4hs-app.vercel.app` | a personal team |
| Database, sign-in, files | Supabase project `vkbzarlkqzvhsfdmxyyq` (us-east-2), organization "Djenins's Org", Pro plan | a personal organization |
| Email | not set up | — |

None of this has moved to NB4HS. That is [nb4hs-accounts-checklist.md](nb4hs-accounts-checklist.md), and it needs the owner.

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
