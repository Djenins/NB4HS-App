# Security decisions from the live checks (2026-10-28)

These follow the live security checks in `launch-audit-2026-10-28.md` ("Live security checks"). The owner decided items 2–4 and the tasks question on 2026-10-28. Each change has a migration, a rollback and a check. All were tested on the local stack, dry-run on live, and then **applied to live on 2026-10-28** (approved), after the app was deployed.

| Decision | Migration | What changes |
|---|---|---|
| **Notifications: mark-read only** (check 4) | `t5_notifications_read_only` | Staff can update only the `read` column of their own notifications. Before, they could change the title, message, link or type. The app only ever sets `read`. |
| **Throttle the 13 functions open without sign-in** (check 3, S13) | `t6_public_rate_limits` | PostgREST calls `api_pre_request()` before each request. A signed-out caller of a listed function gets **HTTP 429** past a per-IP, per-hour limit. Signed-in staff are never throttled. Limits are rows in `api_rate_limits`: 1,200/h for the kiosk polls, 300/h for check-in and check-out, 30/h for appointment requests, booking and self-registration, and 60/h for lookup. The seven read-only functions become VOLATILE, so PostgREST runs them read-write; it also refuses GET. A call that errors isn't counted, because the error rolls the count back too. |
| **Calendar: names and notes for the responsible staff + administrators** (check 2) | `t7_calendar_privacy` | **Client appointments:** read by the assignee and administrators; while unassigned, also by the department (case management or workforce). Change and delete rules are unchanged. **Staff calendar events:** everyone keeps every time block through `calendar_events_between()`, but the person and notes show only to the creator and administrators. Event titles stay visible to all staff, so **titles shouldn't name clients.** |
| **Tasks outside SNAP: keep closed** | none | No change. Turning a module on later takes two permissions, a role grant, and a tasks screen for that module. |

## Evidence

**Local stack:**
- A full replay of 70 migrations, then all 16 SQL checks pass. `t5`, `t6` and `t7` each fail without their migration.
- **Rollback:** undoing `t5`–`t7` restores live's current security setup exactly. Comparing 580 policies, RLS flags and grants: 580 of 580 match.
- **`t5` through the API:** the app's "mark all read" call returns 204, and changing a title is refused.
- **`t6` through the API:** with a lowered limit of 3, calls return 200 ×3, then 429 with "Too many requests…". Signed-out GET returns 405. A signed-in user is never throttled. Another IP keeps its own count. Table reads are unaffected.
- **`t7` in the browser,** as the seeded receptionist: a colleague's event shows its title with no person or notes, and their own event shows both. Across six roles, `t7_calendar_privacy_check` covers who reads which appointment and event.
- **App suite:** 607 unit tests, the role matrix (7/7), the build, and 18 Edge Function tests pass.

**Live dry runs** (`begin … rollback`, nothing committed):
- `t5`, `t6` and `t7` each pass with their own check.
- All three stacked pass with `p0b`, `p1`, `p5`, `t3` and `t7`.
- `t6`'s `alter role authenticator set pgrst.db_pre_request` is accepted on the hosted project.
- **Afterwards, live is unchanged:** 67 migrations, the same `authenticator` settings, no new tables or functions, the old policies, and no test accounts.

## App deployed (2026-10-28)

**Merge:** PR #66 merged at 20:36 UTC as `f947437`. CI was green on the head `3c43c4b`.

**Production deployment:** `dpl_5RFh9hc7ykQc5F4Bf1hwhQ6cLRye` (`nb4hs-5pxuh1chc-marcdeeh.vercel.app`), READY.
- **Domains:** `app.nb4hs.org` and `nb4hs-app.vercel.app` serve `index-BICROSyV.js`.
- **Rollback target:** PR #64's `dpl_4Cx9ZLXAFZE39Y8tfTL1MTLdRbLf`.

**Checked without signing in on `app.nb4hs.org` (pass):**
- the sign-in form
- the appointment request form, including the Kreyòl switch: heading and `lang=ht`
- the appointment lookup page
- the signed-out `/dashboard` → `/` redirect
- the kiosk landing with six choices
- no console errors

**Not checked:** the calendar needs a staff sign-in. Until `t7` is applied, it falls back to reading the table, as before (`calendarDataFetch.test.js`).

Step 1 below was done here; steps 2 and 3 are in "Applied to live" below.

## Order to apply (REQUIRES OWNER APPROVAL)

1. **Deploy the app first,** by merging this PR. The calendar now reads through `calendar_events_between()`, falling back to the table while `t7` isn't applied. It also refreshes every minute, because realtime will only carry your own events. If `t7` went first, staff on the old app would stop seeing colleagues' calendar blocks.
2. **Apply `t5`, `t6`, `t7` in order,** as before: each file plus its `schema_migrations` row, in one transaction. Then re-run each check against live.
3. **After `t6`,** confirm the API still answers: load `/kiosk` and `/appointments/request` on `app.nb4hs.org`.
   - **Caller IP:** the throttle reads Cloudflare's `cf-connecting-ip` header. Check one `api_rate_hits` key shows a real IP, not `unknown`; otherwise every caller shares one count.
   - **Emergency off-switch:** `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`, or run the `t6` rollback.

## Applied to live (2026-10-28, approved)

`t5`, `t6` and `t7` were applied in that order. Each ran as one transaction with its `schema_migrations` row under the file's version, and was checked before the next.

| | Visible on live | Check against live |
|---|---|---|
| `t5` | `authenticated` may update only `notifications.read`; no table-level UPDATE grants remain | `t5_notifications_check`: **pass** |
| `t6` | `authenticator` has `pgrst.db_pre_request=public.api_pre_request`; 13 limits; all 13 functions VOLATILE | `t6_rate_limits_check`: **pass** |
| `t7` | `calendar_events_between()` exists; the new `appointments` and `calendar_events` select policies are in place | `t7_calendar_privacy_check`: **pass** |

**After `t6`:**
- Loading `/appointments/request` and `/kiosk` on `app.nb4hs.org` as a signed-out visitor worked: the pages rendered, and the calls went through.
- `api_rate_hits` recorded those calls (`bookable_staff`, `kiosk_roster`, `kiosk_visits`, `public_visit_count`) with a **real IPv4 caller address**, never `unknown`, so each visitor has their own limit.

**Final sweep against live:** `p0b`, `p1`, `p2`, `p3a`, `p5`, `p6a`, `p6b`, `p6c` and `t1`–`t7` all **pass**.
- **Migrations:** live and the repo hold the same 70 versions.
- **Public pages:** they return 200.
- **Leftovers:** no test accounts.

**Still to check, by staff with accounts:**
- **The calendar.** A colleague's event should show its time and title but no person or notes; your own should show everything; an administrator sees all.
- **Case Management's appointment list.** Each case manager sees their own appointments plus unassigned case requests.

## Review of t6 (2026-10-29)

A later review found four problems in `t6`, each confirmed on the local stack:
- concurrent calls overshoot the limit
- any signed-in token skips the count, including an inactive self-sign-up
- the fallback IP is the client's own first `x-forwarded-for` entry
- old rows are never cleared for callers who don't come back

It also found the kiosk poll limits too tight for a site's shared Wi-Fi. `t8_rate_limit_hardening` fixes these. **It is local only and needs the same dry run and approval before live.** Details, tests and the limits that remain: [launch-readiness-2026-10-29.md](launch-readiness-2026-10-29.md) §2.
