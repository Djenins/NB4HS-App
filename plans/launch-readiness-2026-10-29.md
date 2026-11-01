# Launch readiness — 2026-10-29

Branch `Djenins/launch-readiness`. It follows [launch-audit-2026-10-28.md](launch-audit-2026-10-28.md) and [security-decisions-2026-10-28.md](security-decisions-2026-10-28.md), and rechecks their claims against the code and, read-only, against live.

**Nothing in this pass changed live.** No merge, deploy, migration, setting or secret. Against the hosted project, only `select` queries and the Supabase and Vercel read APIs were used. No write probes, not even rolled-back ones. All test data was synthetic, on a separate local stack (ports 5542x).

**How to read the status labels**
- **Live (read)**: seen on the hosted project or Vercel through a read-only query or API.
- **Local (tested)**: a test or a browser run on the local stack exercised it and it passed.
- **Read**: code or SQL was read; nothing ran it.

## Readiness in one paragraph

The app is live and working for what has been exercised: kiosk check-in and check-out, appointment requests, staff sign-in. The database matches the repo. The security decisions from Oct 28 are applied. **Two things will fail on the first reporting day, Mon Nov 2, unless an owner acts.** No account can review staff reports, so submitted reports reach no one. And report emails aren't set up. The t6 throttle has real weaknesses; this branch fixes them in `t8`, which isn't on live. Ownership, backups and email are all still on personal accounts or undecided. **Verdict: ready for a soft launch with staff who know reports go in-app only, once a reviewer is assigned. Not ready to call finished.** Details and the order of work are under "Blockers" and "Owner approvals".

## What this branch changes

| Commit | What | Evidence |
|---|---|---|
| `5d8e966` | **Dependencies.** 14 npm advisories down to 0: `npm audit fix`, then supabase-js 2.49.1 → 2.118.0, react-router-dom 6 → 7.18.5, vite 5 → 6.4.5. The Edge Functions' supabase-js pin follows. CI now runs `npm audit --audit-level=low`. | 612 unit tests, build, 18 Deno tests, role matrix 7/7 |
| `17f020c` | **`t8`: harden the t6 throttle** (local only), plus the kiosk keeps its lists through a refused poll and checks out one visit at a time | See "t6 review" |
| `903184e` | **t1 rollback keeps reminder history**, and a re-apply restores it | See "t1 rollback" |
| `607679f` | **Client date picker:** Kreyòl month and day names, no past days, a full-date name on each day | Browser at 375 px in Kreyòl; `DatePicker.test.jsx`, `utils.test.js` |
| `a7f51e5` | **Report times showed the next day's date** for any submission after 8 PM EDT | `fmtStamp.test.js` pins New York and fails on the old code |
| `e44f39f` | **Removed false "prototype / stored in this browser / demo mode" notices** from every staff page footer, Settings and the page title | Browser |
| merges | PRs #65 and #67 (docs: the deploy records), and `main` at `02319ad` (PRs #68, #69) | Their claims match live (below) |
| docs | This file; `deploy-and-operations.md` (state, rollbacks, backups, ownership); `deploy-runbook-pr64.md` retired; `goals.md`, `launch-audit`, `README-Dev.md` brought up to date | — |

**After everything above:** 618 unit tests pass in 51 files (7 skipped: the role matrix, which needs the local stack). `npm run build` passes, and the largest chunk is `charts` at 421 KB, so none is over 500 KB. `npm audit` finds 0. 18 Deno tests pass. On the local stack, 71 migrations replay from empty, then all 17 SQL checks, the t8 concurrency test, the t1 rollback test and SNAP task parity (2,880 checks) pass.

## Live state (read-only, 2026-10-29)

| | Result |
|---|---|
| **Migrations** | Live records **70** versions, `…145927` through `t7` (`20261028070000`), each matching a file. `t8` is the only one pending. |
| **Applied security matches the repo** | 864 items compared with a fresh local replay: policies, RLS flags, grants, functions, triggers, cron jobs, buckets, realtime and the PostgREST hook. **Identical except two functions:** `assert_system_admin_remains` (the documented p1b bootstrap edit; live never takes that branch) and `public_register_case_client` (comments only). |
| **t5** | `authenticated` may update only `notifications.read`. |
| **t6** | `pgrst.db_pre_request=public.api_pre_request` is set, with 13 limits. `api_rate_hits` held 133 rows under 4 keys, none `unknown`. The oldest row was under an hour old. |
| **t7** | Its select policies and `calendar_events_between()` are in the matching set above. |
| **Cron** | `snap-task-reminders` at `5 * * * *`, `staff-report-reminders` at `7 * * * *`, `send-outbound` every 5 minutes. |
| **Email** | **Not set up.** Only `admin-users` is deployed (not `send-outbound`), the Vault has no secrets, and the queue is empty. |
| **Report reviewers** | **0.** Nobody holds `staff_reports.review`; only the Executive Oversight role grants it. 5 active accounts can submit, and the only active schedule starts **2026-11-02**. |
| **Data** | 0 staff reports, 0 tasks, 0 task notices, 0 queued emails. 5 active profiles, 3 of them administrators. |
| **Hosting** | Production is `dpl_Af3xomKbEAsVCzra7QavrwdFmZYp` from `main` `02319ad` (PR #69), READY. The previous one is PR #68's `dpl_EYnL9HHJrmL7GJfE464iFnCf21Mo`. |
| **Supabase plan** | Pro, in the personal organization "Djenins's Org". Project healthy, Postgres 17, us-east-2. |

**Not checkable without a write or a sign-in, so not verified:** that Cloudflare overwrites a client-sent `cf-connecting-ip`; Supabase Auth's sign-up and SMTP settings now; whether point-in-time recovery is on; the calendar and Case Management checks that need staff accounts (from PR #67).

## 1. Dependencies

`npm audit` in CI on Oct 28 reported **14: 1 critical, 4 high, 7 moderate, 2 low.**

| Package | Severity | In the production bundle? | Fix |
|---|---|---|---|
| dompurify (via jspdf) | critical | yes, PDF export | `npm audit fix` |
| undici, source-map-js, browserslist | high | no: build and test tools | `npm audit fix` |
| react-router | moderate | **yes** (open redirect via a backslash in `Link`/`useNavigate`; the SSR item doesn't apply to an SPA) | **6 → 7.18.5.** No fixed 6.x exists |
| esbuild via vite | moderate | no: dev server only | **vite 5 → 6.4.5** (vitest 4 already wanted 6+) |
| @vitest/mocker, postcss-selector-parser, baseline-browser-mapping | moderate | no | `npm audit fix` |
| @supabase/auth-js via supabase-js 2.49.1 | low | yes, and in the Edge Functions | **2.118.0.** Its path-traversal needs a non-UUID user id passed to an admin call. `admin-users` already checks `^[0-9a-f-]{36}$` first, so it wasn't reachable. |

**After:** 0 advisories. The suite, the build, the role matrix through the real API, and every browser flow below ran on the new versions. The router upgrade raised no future-flag warnings.

**Remaining risk:**
- The Edge Functions' new pin only takes effect when `admin-users` is next deployed. That needs owner approval, and nothing breaks if it waits.
- Deno's own `jsr:` and `npm:` imports aren't covered by `npm audit`.

**CI check:** `npm audit --audit-level=low` runs after `npm ci` and fails on any advisory, dev tools included. If one can't be fixed yet, write it here rather than lowering the level.

## 2. t6 rate limiting: review and `t8`

Each problem was confirmed on the local stack before the fix.

| # | Problem in t6 | How it was confirmed | t8 |
|---|---|---|---|
| 1 | **Concurrent calls race.** Count, then insert, with no lock. | `t8_rate_limit_concurrency.sh`: limit 5, 20 calls at once from one IP → **20 passed** | A transaction-scoped advisory lock per caller key → **5 passed, 15 refused**. Through the local API: limit 3, 10 parallel HTTP calls → 3×200, 7×429 |
| 2 | **Any signed-in JWT skips the count.** Sign-up is open, and a new account starts inactive and can do nothing else, but it was never throttled. | Read; the API test below | Only an **active profile** or the service role skips. Through the API, a fresh self-sign-up gets 429; active staff get 200×3 |
| 3 | **The fallback IP is the client's own.** Without `cf-connecting-ip`, t6 took the *first* `x-forwarded-for` entry, which the caller writes. | Read | Uses the *last* entry, the one the proxy appended. **IPv6 is grouped by /64.** A malformed address goes to `unknown` |
| 4 | **Rows pile up.** Old rows were deleted only for the key being counted. | Read; live had 4 keys and would keep any that never return | `pg_cron` job `api-rate-hits-cleanup` every 10 minutes, plus an index on `at` |
| 5 | **Shared kiosks.** Each open kiosk or phone check-in page polls `kiosk_roster` and `kiosk_visits` every 30 s, 120 calls an hour each. At 1,200/h, ten pages on one site's Wi-Fi used up the limit. A refused poll then **emptied the kiosk's roster and open-visit list**, and the closing-time auto check-out fired every stale visit in parallel. | Read, then in the browser | Those two limits are now 3,600/h (30 pages per IP). **App:** a failed poll keeps the list on screen (`keepOnFailure`), shown in the browser with polls getting 429. Auto check-out goes one visit at a time and stops at the first refusal (`checkOutInOrder`). Unit tests in `kioskSync.test.js` and `checkinData.test.js` |

**Checks:**
- `t8_rate_limit_check.sql` covers the cleanup job, the index, the limits, the caller address (Cloudflare, x-forwarded-for, IPv6 /64, malformed), inactive vs active vs service role, and the cleanup statement. It fails without `t8`.
- `t8_rate_limit_concurrency.sh` refuses any non-local database.
- `t6_rate_limits_check.sql` now passes both before and after t8.
- The rollback restores t6 exactly: the t6 check passes again after it.

**Limitations that remain:**
- **Failed calls aren't counted.** The error rolls back the count with everything else, and Postgres has no autonomous transaction. Someone can send unlimited *invalid* calls. They're cheap, since validation fails early, but this is not real DDoS protection. That needs the edge: Cloudflare/WAF rules or a Vercel firewall.
- **One site, one IP.** Everyone on a site's Wi-Fi shares each limit. A food-distribution day with more than 300 check-ins an hour from one IP would hit `kiosk_create_visit`. Limits are rows, so an administrator can raise one: `update api_rate_limits set per_hour = … where rpc = …`.
- **The lock queues one caller's calls to one function.** Different IPs and functions don't wait. Under abuse, the abuser mostly waits on themself, but so does anyone sharing their IP.
- **Trusting `cf-connecting-ip`.** Live rows show real IPv4 addresses, so Supabase's edge sets it. Whether Cloudflare *replaces* a client-sent value wasn't tested, because that would write to live. Cloudflare documents that it does.
- **The emergency off-switch is unchanged:** `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`.

## 3. t1 rollback and re-apply

**Problem (confirmed locally):** the t1 rollback dropped `task_notices_sent`. The old daily job checks only `task_reminders_sent`, which t1 never writes. **After a rollback, the old job re-sent every reminder t1 had already sent.** A later re-apply would also have lost t1's own history, overdue nudges included, and sent those again.

**Fix:**
- The rollback copies each due reminder into `task_reminders_sent` and keeps the table as `task_notices_sent_rolled_back`.
- The new `supabase/rollback/t1_reapply_restore_notices.sql` runs in the same transaction as a re-apply and puts that history back.
- The rollback also refuses to drop tasks that record a subject (`subject_type`/`subject_id`), which the old table can't hold.

**Test:** the three-part `t1_rollback_*` test now creates SNAP tasks in every state and sends a real reminder under t1. Then it rolls back, checks that the old job sends nothing, re-applies with the restore, and checks that t1 sends nothing either.
- Without the fix: `FAIL: after the rollback the old job re-sent a reminder t1 had already sent`.
- Without the restore step, it fails too.
- Task rows (every column), audit counts and `updated_at` are unchanged throughout.
- SNAP task policy parity across the fixed rollback: **2,880 checks for 32 personas, no changes.**

**Not changed:** the live t1 migration file. A re-apply has to include the restore step, as `deploy-and-operations.md` §2 now says.

## 4. Permissions across roles

**Tested on the local stack:**
- `roleMatrix.local.test.jsx` signs in as each seeded account through the real API on the upgraded supabase-js: **7/7**. For every account, the pages the permission model opens equal the account-type pages, except the receptionist's `clients` (an owner decision). Forbidden pages stay shut. The administrator reaches all five Admin sections. The deactivated account isn't a session and holds nothing.
- The SQL checks `p1` (legacy parity for 6 accounts, 314 effective rows), `p2`, `p3a`, `p5` (grant and deny overrides), `t3`, `t5`, `t7`, `t8`: all pass.
- `permissionLoading.test.jsx` covers an empty answer, a failed call and a thrown call.

**How access actually works (accurate, not "fail-closed"):**
- **The database is the enforcement.** RLS and security-definer functions check `has_permission()` and friends on every read and write, so a page that opens can still only show what RLS allows.
- **The route guard and sidebar** come from `my_permissions()`:
  - *While it loads*, `RequireRoute` renders nothing, so it neither opens nor refuses.
  - *An empty answer* means no pages. This covers a deactivated account with a live token, every permission denied, or every module switched off.
  - *A deactivated account* isn't a session (`profileToSession` refuses `active === false`), and deactivating revokes its sessions.
  - **A failed call falls back to the old account-type page list** (`legacy-fallback`). That fallback is **not fail-closed**: if the call errors, an account whose permissions were narrowed by an override, a revoked program grant or a switched-off module can open the pages its account type used to allow. RLS still decides what data shows. The fallback exists so staff keep working during a blip. Removing it is part of goal 10.
  - `VITE_AUTH_MODEL=legacy` switches the whole app to account-type navigation.
- **Revoked program access** takes effect when the grant row changes: `user_effective_permissions` is refreshed by trigger. An open tab picks it up on its next permission load.

## 5. End to end on the local stack (synthetic data, 2026-10-29)

| Flow | Result |
|---|---|
| Kiosk visitor check-in | **Pass.** An empty submit moves focus to the first missing field, with `aria-invalid` and `aria-describedby` on each |
| Kiosk check-out | **Pass**, including the success screen. *Minor:* the list says "No one is checked in" for the moment before the first poll returns |
| Kiosk under throttling (limit lowered so polls get 429) | **Pass** with this branch: the open visit stays listed |
| Keyboard on the kiosk | Skip link first, cards reachable with Tab, a visible 3 px focus ring, Enter opens a card |
| Appointment request in Kreyòl at 375 px | **Pass** after `607679f`: `lang=ht`, every field labelled, no sideways scroll, Kreyòl validation messages, Kreyòl dates, no past days |
| Staff report: draft, attachment, submit | **Pass.** Size and type come from the stored file; focus goes to the missing "Programs" group; Confirm dialog |
| Reviewer: open, request revision with a note | **Pass**, *after giving the reviewer role locally*: with the seeded roles nobody is a reviewer, the same as live |
| Notification bell → revision link → resubmit | **Pass.** Version 2 stored; reviewer gets `staff_report_submitted` with a link; both emails queued (local has no email sender) |
| SNAP follow-up: create, reminder, link | **Pass.** Gets `module=snap`; one reminder at noon New York, none the next hour; link `/snap/tasks` opens |
| Calendar privacy and actions | Not re-run in the browser this pass; `t7_calendar_privacy_check` (six roles) and `calendarRights.test.js` pass. Done in the browser on Oct 28 |
| Draft deletion with attachments | Not re-run in the browser; `staffReportsDiscard.test.js` passes; browser-checked Oct 28 |

**Not covered:** a real screen reader; dark mode; the QR camera path; French beyond spot checks (French date names come from the browser, so they were already right).

## 6. Built vs scaffolding

| Area | State |
|---|---|
| Kiosk check-in and check-out, student roster, self-registration, appointment request and lookup | Built, on Supabase, throttled (t6) |
| Staff reports (periods, drafts, attachments, submit, revise, acknowledge, reminders) | Built. **No reviewer exists on live.** **No "new schedule" screen**: a new schedule is SQL. Emails are queued but **not sent** until email is set up |
| SNAP outreach: contacts, cases, follow-ups, hourly reminders | Built |
| **Tasks outside SNAP** | **Closed by design.** Tasks carry a module, but Case Management and Workforce have no `*.tasks.*` permissions and no tasks screen. Turning one on takes two permission keys, a role grant and a screen |
| Task gaps | Closing or reassigning a case leaves its tasks alone; deleting a client deletes its tasks and cases; `taskPermissions()` in the UI copies legacy roles; no time of day on tasks |
| **Calendar** | Shows the class schedule, staff-added visits and appointments (`calendar_events`) and US holidays. **It doesn't show** client appointments (`appointments` table), tasks, report due dates or staff time off. **No Google, Outlook or iCal sync**, and no reminders from the calendar itself |
| Notifications | In-app, realtime, newest 50. Email copies only for staff-report events, and only once email is set up. **No SMS** |
| Email delivery | Code done (`send-outbound`, queue, Resend). Needs a domain, a Resend account, three secrets, two Vault entries and a deploy; see `deploy-and-operations.md` §1. Password resets need custom SMTP for real volume |
| Per-device settings | Kiosk link, fallback closing time, calendar view and theme stay in the browser on purpose. All program data is in Supabase |
| Old access model | Still present as the fallback above and the `VITE_AUTH_MODEL` switch (goal 10) |

## 7. Blockers, most severe first

1. **No staff-report reviewer on live (P0, before Mon Nov 2).** Five people can submit; nobody can review, and submit notices go to nobody. *Fix (owner):* Administration → Users → give the director the **Executive Oversight** role. That's a data change on live, not a migration. Then check `select count(*) from staff_report_reviewer_ids()` is 1 or more. **Owner decision, 2026-10-30:** no one gets the role for now. It will go to `admin@nb4hs.org` once that account is in use, so submitted reports reach nobody until then.
2. **Report email isn't set up (P1).** Staff see in-app notices only. This is acceptable for launch if staff are told; otherwise follow `deploy-and-operations.md` §1.
3. **Accounts are personal (P1).** GitHub, Vercel (team `marcdeeh`) and Supabase ("Djenins's Org") all belong to individuals. One departure locks NB4HS out. See `nb4hs-accounts-checklist.md`.
4. **Backups unverified (P1).** Pro has daily backups, but retention and point-in-time recovery weren't checked, storage buckets aren't covered, and a restore has never been tried.
5. ~~**t6 weaknesses on live (P2)** until `t8` is applied~~ **Fixed 2026-10-30 (§12):** concurrency overshoot, the signed-in bypass, the spoofable fallback (low on Supabase, where Cloudflare's header is present), no cleanup, and the kiosk ceiling of ten pages per site.
6. **Password-reset mail on the built-in mailer (P2).** It has a low hourly limit; custom SMTP is in `deploy-and-operations.md` §1.
7. **The legacy permission fallback (P3).** A failed `my_permissions()` call opens account-type pages; RLS still guards the data (goal 10).
8. **Smaller items (P3):** the "No one is checked in" flash on check-out; no "new schedule" screen; the calendar gaps; and the plain `nb4hs-app.vercel.app` address isn't in Auth's redirect list (staff should use `app.nb4hs.org`).

## 8. Production deploy and rollback (current)

- **Deploys:** merging to `main` builds and promotes a production deployment on Vercel (`nb4hs-app`, team `marcdeeh`), served at `app.nb4hs.org` and `nb4hs-app.vercel.app`. Build variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `VITE_AUTH_MODEL` stays unset.
- **App rollback:** Vercel → Deployments → the previous READY production deployment → Instant Rollback. Since PR #70's deploy (2026-10-30), that's PR #69's `dpl_Af3xomKbEAsVCzra7QavrwdFmZYp`. After an instant rollback, Vercel stops promoting new builds automatically until you promote one (`vercel promote …` or Undo Rollback). On the Hobby plan, only the immediately previous deployment can be the target. To make a rollback permanent, revert the merge on `main` with a PR.
- **This branch is app-compatible with live as it is.** It needs no migration to deploy: `t8` is optional and independent, and the app works with or without it.
- **Database rollback:** only for a database problem, with approval; see `deploy-and-operations.md` §2, "Rolling a migration back", for what each script can't undo.

## 9. Production acceptance checklist

Run on `app.nb4hs.org` after each production deploy. Use made-up names on the kiosk, and have an administrator remove the test visit afterwards.

**Without signing in**
- [ ] Vercel shows the new deployment READY from the expected `main` commit, and the console shows no errors.
- [ ] `/kiosk` loads with its choices. Switch to Kreyòl: `document.documentElement.lang` is `ht`, and the appointment date picker shows Kreyòl months.
- [ ] Visitor check-in, then check-out, with a made-up name.
- [ ] `/appointments/request`: past days can't be picked, and a request submits.
- [ ] `/appointments/lookup` answers.
- [ ] Signed out, `/dashboard` sends you to sign-in.

**Database (read-only SQL)**
- [ ] `select count(*), max(version) from supabase_migrations.schema_migrations` equals this folder's files: 70 / `20261028070000` today, 71 / `20261029010000` after `t8`.
- [ ] `select count(*) from staff_report_reviewer_ids()` is 1 or more.
- [ ] `select key, count(*) from api_rate_hits group by 1`: no `…:unknown` keys.
- [ ] `select jobname, schedule from cron.job`: the three jobs, plus `api-rate-hits-cleanup` after `t8`.

**With staff accounts**
- [ ] **Administrator:** usual landing page; Administration opens all five sections.
- [ ] **Reviewer:** Staff Reports → Overview loads. On a submitted report, request a revision; the staff member gets a notice whose link opens the report with the note. The time shown is today's date.
- [ ] **Staff:** My Reports shows the period. On or after Nov 2, Create, attach a file, Submit, then Resubmit after the revision.
- [ ] **Notifications:** items stay unread while the bell is open; "Mark all read" works.
- [ ] **Calendar:** a colleague's event shows time and title but no person or notes; your own shows everything; an administrator sees all. Edit and Delete only on your own events.
- [ ] **Case Management:** you see your own appointments plus unassigned requests.
- [ ] **SNAP:** Add follow-up, and the assignee list holds only SNAP members.
- [ ] **Receptionist:** lands on Check-In; the student roster loads; `/clients/…` redirects.
- [ ] **Password reset:** from Administration → Users, the email arrives and its link opens `https://app.nb4hs.org/reset-password`.

## 10. Owner approvals needed (each separately)

None of these were done here.

1. **Give the director the Executive Oversight role on live** (Administration → Users). Needed before Nov 2.
2. **Merge this branch's PR** (it includes PRs #65 and #67, which are docs only). That deploys the app changes, but no database change.
3. **Apply `t8` to live:**
   1. A `begin; <t8>; <t8_rate_limit_check.sql>; rollback;` dry run against live. It writes inside the transaction, so it needs approval like the earlier dry runs.
   2. Then apply the file with its `schema_migrations` row in one transaction.
   3. Then re-run `t8_rate_limit_check` and `t6_rate_limits_check` the same way.
   4. Never run `t8_rate_limit_concurrency.sh` against live. It refuses to.
4. **Redeploy the `admin-users` Edge Function** to pick up supabase-js 2.118.0. Optional.
5. **Email:** a sending domain, a Resend account, the secrets, the Vault entries, deploying `send-outbound`, and custom SMTP in Auth.
6. **Backups:** confirm retention and point-in-time recovery in the dashboard, decide on copying storage, and run one restore into a separate, new project.
7. **Account ownership:** move GitHub, Vercel and Supabase to NB4HS-owned organizations (`nb4hs-accounts-checklist.md`).
8. **Optional:** add `https://nb4hs-app.vercel.app/**` to Auth's redirect URLs.

## 11. Assessment

| | |
|---|---|
| **Database and security** | Good. Live matches the repo item for item; RLS is the real guard and is covered by 17 SQL checks. The throttle works but is weaker than documented until `t8`. |
| **Client screens** | Good. The flows work at phone width in Kreyòl, and this branch fixes the date-picker gaps. A real screen reader and full French walkthroughs were not done. |
| **Staff reports** | Code works end to end locally. **Live can't use it until someone is a reviewer**, and email copies are off. |
| **Operations** | Weakest area: personal ownership, an unverified backup and restore, no email, no error monitoring. |
| **Overall** | **Soft-launch ready once blocker 1 is fixed** and staff know reports are in-app only. Ownership, backups and email should follow within weeks, not months. |

## 12. Done on 2026-10-30 (approved)

Each step below was approved separately by the owner.

| Step | Result |
|---|---|
| **1. Reviewer role** | **Not done, by decision.** No one gets Executive Oversight for now; it will go to `admin@nb4hs.org` once that account is in use. Until then submitted reports reach nobody (blocker 1). |
| **2. Merge PR #70** | Merged as `b0e5b69`. Production deployment `dpl_GSuTGiRBZ3VRFYa7TMbJyjeM1mj7`, READY, serving `index-CfzI0PSY.js` on `app.nb4hs.org`. Checked there: the kiosk landing; `/appointments/request` in Kreyòl (`lang=ht`, Kreyòl month names, past days disabled, each day named by its full date); `/appointments/lookup`; a signed-in dashboard with no "prototype" notice; no console errors. **Rollback target:** PR #69's `dpl_Af3xomKbEAsVCzra7QavrwdFmZYp`. |
| **3. Apply `t8`** | **Dry run:** `begin; <t8>; <t8_rate_limit_check>; rollback;` raised `T8_CHECKS_PASSED`. Live was unchanged afterwards: 70 versions, kiosk limits 1,200, no cleanup job, index, `api_rate_caller` or test accounts. **Applied** as one transaction with its `schema_migrations` row (`20261029010000`, `t8_rate_limit_hardening`). **After:** `t8_rate_limit_check` and `t6_rate_limits_check` both pass against live. Through the API, signed out: `kiosk_roster` POST 200, GET 405, and the call was recorded under a real caller IP. Live now records **71** versions and the cron job `api-rate-hits-cleanup` (`*/10 * * * *`). |
| **4. Redeploy `admin-users`** | Version 3, `verify_jwt` on as before. The only change is supabase-js 2.49.1 → 2.118.0 in `index.ts`. Checked with a signed-in administrator's token: an unknown action returns 400 `unknown_action` (sign-in check passed through the new client), and a malformed body returns 400 `bad_request`. Nothing was invited or reset. |

**Still open from §10:** email (5), backups (6), account ownership (7), the optional redirect URL (8), and the staff-account checks in §9.
