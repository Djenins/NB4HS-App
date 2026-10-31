# NB4HS Launch Goals

Status: **drafted 2026-10-26.** The goals below take the app from where it stands now to a production deploy. Each goal has its own "Done when" check.

Where things stand (2026-10-26): `npm run build` passes and all 561 tests in 39 files pass. Phases 0–6 of `unified-access-architecture.md` are merged and their migrations applied. Design batches 3a–3c of `ui-design-system.md` are done. Phase 8 has not started.

Rules for every goal:
- Routes, permissions, database behavior and business logic stay fixed during UI work.
- Client-facing screens are translated into Kreyòl and French. Staff-only screens stay in English in all three languages.
- Every migration gets a `begin … rollback` dry run against live, then your approval, before it is applied.
- One PR per goal, or per batch.

## Goals

| # | Goal | Scope | Done when | Status |
|---|---|---|---|---|
| 1 | Clean-up and docs | Rewrite `README-Dev.md` to match the current app. Mark `snap-outreach-architecture.md` with its real status. Merge or close PR #21 (Add a Household form) | The docs match the code and PR #21 is closed or merged | ☐ |
| 2 | Security leftovers | Confirm S7 and S8 are fixed on live (Phase 3). Fix S11: make `audit_events` append-only and audit profile changes. Decide on S13 (kiosk RPC rate limits) | Each item has a regression check and is marked closed in `unified-access-architecture.md` | ☐ |
| 3 | Bundle size | Split the ~1 MB main chunk: route-level `lazy()`, and separate chunks for the chart, jsPDF and html2canvas libraries | No chunk is over 500 KB; build and tests pass | ☑ 2026-10-29: largest chunk 401 KB (was 1,006 KB); first-load JavaScript 521 → 287 KB gzip |
| 4 | Design batch 3d: Outreach | `Outreach.jsx` shell, Contacts, Cases, Tasks, Staff, the detail modals: PageHeaders, `DataTable` with phone cards, Skeletons, `EmptyState` | `impeccable detect` is clean for the batch; PR merged | ☐ |
| 5 | Design batch 3e: Programs and admin | Food Distribution, Manage, Settings, Users, QR Code: remove about 60 inline styles | `impeccable detect` is clean; PR merged | ☐ 2026-10-30: PR #76 open (replaces #21); `impeccable detect` clean, build and tests pass. Waiting on review and merge |
| 6 | Design batches 3f and 3g: Calendar and Shell | Calendar on the shared tokens and components; sidebar, topbar, ModuleNav and notifications with a quiet topbar and the phone menu that slides in from the side | `impeccable detect` is clean; PRs merged | ☐ |
| 7 | Design batches 3h and 3i: Public, kiosk and Staff Reports | Touch-friendly version for check-in/out, appointments and login; form and review templates for Staff Reports | `impeccable detect` is clean; PRs merged | ☐ |
| 8 | Design clean-up and audit | Delete the old CSS that no longer applies (`.btn-*`, `.modal-box`, `.card`, bare tag rules, `.pill-row`), the local component copies and the token aliases; refresh `DESIGN.md` | `/impeccable audit` scores at least 17/20 | ☐ |
| 9 | Phase 8 checks | Log in and check every role, axe scan, keyboard pass, reduced motion, Kreyòl and French text fitting | Every problem found is fixed or written down | ☐ |
| 10 | Retire the old access model | Remove the old roles and the `auth_model` flag; final clean-up migration (drop `workforce_role_access`, departments, `profiles.role` usage) | Your sign-off, then the migration is applied and verified | ☐ |
| 11 | Production deploy | Deploy to production on Vercel | Your OK; the live site has been checked after the deploy | ☑ 2026-10-28: PR #64 and #66 deployed to `app.nb4hs.org`; the no-sign-in checks passed (`deploy-runbook-pr64.md`) |

## Order

Goals 1–3 can run alongside the design batches. The design goals 4–7 can go in any order, but goal 8 comes after all of them. Goal 9 needs goals 2 and 8 done. Goal 10 needs goal 9 and your sign-off. Goal 11 comes last.

## Audit log

- 2026-10-28: P0 and P1 audit against the launch checklist — see [launch-audit-2026-10-28.md](launch-audit-2026-10-28.md). The permission-loading fallback is fixed and tested (feeds goals 2 and 10). The RLS assumptions that need a live check are listed for goal 2. The P1 findings for tasks, staff reports, calendar and notifications are recorded but not yet scheduled as goals.
- 2026-10-28 (later): P1 cross-program tasks migration `t1` written and tested locally (not on live). P2 low-risk fixes, the client-screen accessibility/bilingual audit, and the goal 11 prep docs ([deploy-and-operations.md](deploy-and-operations.md), [nb4hs-accounts-checklist.md](nb4hs-accounts-checklist.md), [launch-budget.md](launch-budget.md)) are done. Details and what's still open: [launch-audit-2026-10-28.md](launch-audit-2026-10-28.md).
- 2026-10-29: launch-readiness pass, see [launch-readiness-2026-10-29.md](launch-readiness-2026-10-29.md).
  - **Live:** 70 migrations, and security matching the repo item for item (read-only).
  - **Goal 2:** S13 is decided and applied (`t6`). `t8` hardens it and is local only.
  - **Goal 3:** done in PR #68 (largest chunk 421 KB).
  - **Goal 11:** production runs PR #69.
  - **Blocker found:** live has no staff-report reviewer.
  - The goal table above shows the Oct 26 statuses. It wasn't re-marked here, because most rows need a review or an owner sign-off this pass didn't do.
