# Production deploy runbook: PR #64

Prepared 2026-10-28. **Nothing here has been done yet.** Merging, deploying and changing settings each need the owner's go-ahead.

## What a merge does

| | |
|---|---|
| **Trigger** | Merging PR #64 into `main`. The Vercel project `nb4hs-app` (team `marcdeeh`) builds every push to `main` as a production deployment, through the GitHub integration. Every recent production deploy came from a merged PR this way. |
| **Served at** | `app.nb4hs.org` (custom domain), `nb4hs-app.vercel.app`, `nb4hs-app-marcdeeh.vercel.app` |
| **What changes** | The web app only: 41 files under `src/`. No Edge Function code changed, so nothing to redeploy in Supabase. |
| **Database** | Already done. `t1`–`t4` were applied on 2026-10-28; live and the repo hold the same 67 migrations. The merge touches no database. |
| **Build settings** | Vite, Node 24.x. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for Production and Preview. `VITE_AUTH_MODEL` is unset, so the permission model is on, which this branch expects. |
| **Current production** | `dpl_AFhFvDPCodYq38M43z8wfEkiyfgU` (`nb4hs-1h90ln258-marcdeeh.vercel.app`), from PR #63, commit `2e12db3`. Marked as an instant-rollback candidate. **This is the rollback target.** |
| **Preview of this branch** | `dpl_CrgWEs648ZiKbcCfhWejVUnpR5Dz` (`nb4hs-5d7c5df3k-marcdeeh.vercel.app`), commit `03470f0`: READY, serves the app (checked 2026-10-28). Protected by Vercel Authentication. |

## Why before Nov 2

The database is ahead of the app now in production:
- **Reviewers:** on the old app, they don't see a report while it's sent back for revision (`t4`).
- **Receptionists:** on the old app, a signed-in receptionist sees an empty student roster (`t3`).

Nobody is affected today: live has no receptionists and no staff reports, and none can start before the first period opens on **Mon Nov 2, 2026**. Deploy before then.

## Before merging (owner)

1. **CI is green on the PR's head:** `test-and-build` and the Vercel preview.
2. **Read the PR.** At minimum, the "Owner decisions" and "Applied to live" sections.
3. **Confirm the database is still where we left it.** This read-only query should return `67 | 20261028040000`:
   ```sql
   select count(*), max(version) from supabase_migrations.schema_migrations;
   ```
4. **Mark the PR ready, then merge** (a merge commit, as earlier PRs).
5. **Pick a quiet time:** no kiosk in use and no one mid-report. The switch is instant, and people with the app open keep the old code until they reload.

## Recommended alongside (separate approval each)

These aren't required for the merge, but production runs on a custom domain:
- **`SITE_URL` for `admin-users`.** It isn't set today. Invite and password-reset links requested from `app.nb4hs.org` fall back to `https://nb4hs-app.vercel.app`, because the function only trusts `nb4hs-app*.vercel.app` origins. Setting it sends people to the custom domain:
  ```bash
  supabase secrets set SITE_URL=https://app.nb4hs.org --project-ref vkbzarlkqzvhsfdmxyyq
  ```
- **Supabase Auth URL settings** (Dashboard → Authentication → URL Configuration). Check that the Site URL is `https://app.nb4hs.org` and that the redirect URLs include `https://app.nb4hs.org/reset-password`. These settings can't be read from the repo.
- **Report emails stay off** until the email setup in `deploy-and-operations.md` §1 is done:
  - `send-outbound` isn't deployed
  - it has no secrets
  - the Vault entries are missing

  In-app notices work either way.

## After the deploy: what to check

Done by staff with real accounts, on `app.nb4hs.org`. Reload once first.

**Deployment:**
1. Vercel shows the new production deployment as READY, built from the merge commit of PR #64.
2. `app.nb4hs.org` loads with no errors in the browser console.

**As an administrator:**
1. You land on your usual page.
2. The sidebar is unchanged.
3. Administration opens all five sections: users, roles, positions, programs, audit.

**Notifications (any account):**
1. Open the bell. Unread items stay highlighted and "Mark all read" works.
2. Close it. The badge clears.

**Calendar:**
1. Create an event, edit it, duplicate it and delete it.
2. On someone else's event, only View and Duplicate show, unless you're an administrator.

**Staff reports:**
1. **As a staff member:** My Reports says the first period starts Nov 2 and offers no Start button yet.
2. **As a reviewer:** Staff Reports → Overview loads.

**SNAP:**
1. As the SNAP program admin, open Outreach → Follow-ups → Add follow-up.
2. The assignee list shows only SNAP members.

**Kiosk and public pages** (no sign-in):
1. Open `/kiosk`. The check-in choices load.
2. Switch to Kreyòl. The page text changes, and the page's language changes with it. A developer can confirm with `document.documentElement.lang` in the console, which should be `ht`.
3. Open `/appointments/request`. The form loads.

**Check-in flow:**
1. Check a visitor in and out on the kiosk, using a made-up name.
2. Afterwards, an administrator removes that test visit.

If any check fails, go to Rollback first, then investigate.

## Rollback

**The app (instant; nothing in the database changes):**
1. **Vercel → `nb4hs-app` → Deployments.** Open `dpl_AFhFvDPCodYq38M43z8wfEkiyfgU` (PR #63, `2e12db3`) and choose **Instant Rollback**. Or with the CLI:
   ```bash
   vercel rollback nb4hs-1h90ln258-marcdeeh.vercel.app --scope marcdeeh
   ```
2. **Domains:** this puts every production domain, `app.nb4hs.org` included, back on the previous build within seconds.
3. **Caution:** after an instant rollback, Vercel stops assigning production domains to new deploys automatically. Turn that back on by promoting the deployment you want: `vercel promote <deployment-id-or-url>`, or **Undo Rollback** in the dashboard. Do this before the next merge, or the merge won't go live.
4. **Plan limit:** on the free Hobby plan, Vercel can roll back only to the *immediately previous* production deployment. That is PR #63's build here, as long as nothing else deploys to production in between.
5. **Making it permanent:** revert the merge commit on `main` with a PR. That builds a fresh production deploy of the old code.

**What the old app means on today's database:** exactly what production runs now. Reviewers can't see reports in revision, and signed-in receptionists have no student roster. Nobody is affected while live has no receptionists or reports. **Don't roll back the database to "match"**: the app rollback alone is safe.

**The database:** only for a database problem, with owner approval.
- Rollback scripts are in `supabase/rollback/`. Run them newest first (`t4` → `t1`), each as one transaction, after a `begin … rollback` dry run.
- They undo the four owner decisions and fixes.
- The `t1` rollback refuses if a task outside SNAP exists.

## Not part of this deploy

- **The live RLS checks** (launch audit, items 1–6).
- **NB4HS-owned accounts and plans** (`nb4hs-accounts-checklist.md`, `launch-budget.md`).
- **Report emails** (above).
