# Security decisions from the live checks (2026-10-28)

These follow the live security checks in `launch-audit-2026-10-28.md` ("Live security checks"). The owner decided items 2–4 and the tasks question on 2026-10-28. Each change has a migration, a rollback and a check. All are **tested on the local stack and dry-run on live**, and **none is applied to live yet**.

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

## Order to apply (REQUIRES OWNER APPROVAL)

1. **Deploy the app first,** by merging this PR. The calendar now reads through `calendar_events_between()`, falling back to the table while `t7` isn't applied. It also refreshes every minute, because realtime will only carry your own events. If `t7` went first, staff on the old app would stop seeing colleagues' calendar blocks.
2. **Apply `t5`, `t6`, `t7` in order,** as before: each file plus its `schema_migrations` row, in one transaction. Then re-run each check against live.
3. **After `t6`,** confirm the API still answers: load `/kiosk` and `/appointments/request` on `app.nb4hs.org`.
   - **Caller IP:** the throttle reads Cloudflare's `cf-connecting-ip` header. Check one `api_rate_hits` key shows a real IP, not `unknown`; otherwise every caller shares one count.
   - **Emergency off-switch:** `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`, or run the `t6` rollback.
