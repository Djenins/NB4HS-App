# NB4HS UI Standardization: Audit, Design System, Rollout Plan

Status: **approved 2026-10-26** with the recommended defaults (15px body / 14px UI, 10px control radius, Search as the representative page). Phase 0 done: PR #30 merged up with main, PRODUCT.md written. Since the audit, main has turned SNAP Outreach into a program inside the new Outreach module (`src/pages/Outreach.jsx`, `/outreach/:program/:section`). The Outreach batch below covers it.
Prepared 2026-10-26 on branch `Djenins/snap-stage2b-cases`. Method: the Impeccable `audit` playbook (technical, five dimensions), plus a source read of all 41 pages, the shared components, `main.css`, `tailwind.config.js` and the Impeccable detector. Authenticated screens were not screenshotted because they need a staff sign-in. Visual validation is part of Phase 2.

---

## 0. Impeccable commands for this work

The installed skill is `impeccable`, and every command is a sub-command of it. It has no separate `normalize` command: normalizing is `extract` (tokens and components) followed by `polish`.

| Purpose | Command | When |
|---|---|---|
| Product context (writes PRODUCT.md, a short interview) | `/impeccable init` | Before Phase 1. The skill reports that PRODUCT.md is missing |
| Technical audit (a11y, perf, theming, responsive, drift) | `/impeccable audit` | Done; this document. Re-run at the end |
| UX and heuristic review of one screen | `/impeccable critique <page>` | On the representative page, after Phase 2 |
| Pull tokens and components into the system | `/impeccable extract` | Phases 1–2 |
| Write DESIGN.md from the shipped system | `/impeccable document` | End of Phase 2, then refreshed at the end |
| Type hierarchy | `/impeccable typeset` | Phase 1 |
| Spacing and rhythm | `/impeccable layout` | Per page during rollout |
| Tablet and mobile | `/impeccable adapt` | Per page during rollout |
| Empty, error, loading and edge states | `/impeccable harden` | Per page during rollout |
| Final pass | `/impeccable polish` | Phase 5 |
| Mechanical anti-pattern scan | `impeccable detect` | After every batch |

---

## 1. UI consistency audit

### Health score (Impeccable audit rubric)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3 | Contrast work is strong (AA-tuned `--ev-ink-soft`, `--gold-ink`, `--*-foreground`). Gaps: Workforce modal titles are `<p>` with no `aria-labelledby` and no close X. The calendar error icon is invisible (tint on tint) |
| 2 | Performance | 3 | Routes are lazy and chunked. Inter loads through a render-blocking CSS `@import` with no preconnect |
| 3 | Responsive | 2 | Workforce lists reflow well. SNAP and legacy tables only scroll sideways. The month view has no phone layout. `main.css` uses six ad-hoc breakpoints (600/640/760/820/900/1024) |
| 4 | Theming | 2 | Tokens are thorough, but call sites bypass them (`#b7c0d1` ×5, `#CBD5E1` in Button, `bg-cyan-*`, fixed sidebar hex). The radius scale is inverted. The print palette is incomplete |
| 5 | Implementation integrity | 1 | **Systemic drift.** Six styling dialects coexist, and shared components exist but most pages build local copies |
| | **Total** | **11/20** | **Acceptable: significant work needed** |

**Integrity verdict: fail.** The parts are good, but they were never assembled into one system. The calendar, the Workforce filter chrome and the SNAP modal are each well built, in three different grammars.

### The six dialects in use today

| Dialect | Signature | Pages |
|---|---|---|
| A. Legacy CSS | `.card`, `.btn-*`, `.pill`, `.field`, `.grid-N`, inline `style={{}}` | Food Distribution, Manage (35+ inline styles), Settings |
| B. Tailwind v1 | Global 2rem `h1.mb-1`, ui `Card`, local filter boxes | Students, Search, Case Management, Assessments, Users, Dashboard |
| C. Tailwind v2 | `h1.text-2xl font-extrabold`, `space-y-6` | Reports, My Caseload, QR Code |
| D. Workforce filter chrome | 52px controls, 68px filter tiles, `rounded-[12px]`, `text-[15px]` | Job Developer, Employers, Job Openings, Candidate Matching, Referrals, Placements |
| E. SNAP local | `SNAP_CONTROL` 40px, `TH` constant, raw tables, `!`-important overrides | SNAP Dashboard, Contacts, Cases, Tasks, Staff |
| F. Calendar | Clamp title, segmented control, filter chips, tone quartets, drawer | Calendar (the reference) |

The kiosk, appointment and auth flows are a seventh, touch-scale dialect. That is intentional, but it has about 15 one-off rem sizes.

### Inconsistencies ranked by visual impact

| # | Area | What's wrong | Evidence |
|---|---|---|---|
| 1 | Page headers | Five h1 sizes: 2rem, 1.75rem clamp, 1.5rem, 1.25rem, and none at all (SNAP sub-pages use a 15px card heading as the page title). Subtitle spacing is done four ways | `Dashboard.jsx:199`, `Reports.jsx:176`, `ClientHeader.jsx:48`, `SnapContacts.jsx:46`, `WorkforceReports.jsx:198` |
| 2 | Buttons | A 52px legacy button sits beside a 40px ui `Button` in the same modal footer. Cause: the bare `button{min-height:52px…}` rule at `main.css:226` applies whenever a class does not override it. Profile tabs and chips inherit it by accident | `ClientProfile.jsx:166`, `PlacementFormModal.jsx:82`, `EmployerProfile.jsx:402`, `JobClientProfile.jsx:66` |
| 3 | Modals | Five structures. In Workforce modals the `<p>` title is overridden by `.modal-box p` (`main.css:543`), so its Tailwind classes do nothing. The inline footer style is repeated about 17 times | `Assessments.jsx:114` (22px radius), `Search.jsx:573/604/687` (inline maxWidth), SNAP (the best model) |
| 4 | KPI tiles | Five implementations, with different number sizes, icon sizes and grids | `StatCard`, `Dashboard StatTile`, `Reports KpiCard`, `WorkforceDashboard KpiCard`, `JobDeveloper KpiStat`, `SnapDashboard Kpi` |
| 5 | Lists and tables | Four header styles (global uppercase .8rem, text-sm still uppercase, text-xs tracked, SNAP `TH`). Only Search has a phone card fallback | `Users.jsx:149`, `CaseManagement.jsx:435`, `SnapCases.jsx:146` |
| 6 | Form controls | Four heights: 52px global, 52px filter chrome, 44px Workforce forms, 40px SNAP. Labels are dark in Workforce and muted in SNAP. `FormField.jsx` is never imported | `Employers.jsx:77`, `SnapField.jsx` |
| 7 | Card shape | `.card` is 18px radius with 24px padding, ui `Card` is 18px (`rounded-xl` remapped), the calendar uses 16px (`rounded-2xl`), and the Assessments modal is 22px. Profile pages nest a local `SectionCard` inside a tab `Card` | `tailwind.config.js:67`, `EmployerProfile.jsx:46` |
| 8 | Status chips | ui `Badge` (`rounded-md`), legacy `.badge` pill, `.pill` toggles, ad-hoc `rounded-full` spans and raw `cyan-*` | `Students.jsx:444`, `JobDeveloper.jsx:538`, `Settings.jsx:125` |
| 9 | Empty, loading and error states | `EmptyState` (dashed box), `ResultsEmptyState` (300px card), raw `.empty-state`, plain centred `<p>` (about 8 in ClientProfile), and `null` while SNAP loads | `Search.jsx:437`, `SnapCases.jsx:143` |
| 10 | Results chrome | The sort/view toolbar sits *below* the results. Pagination is missing on 3 of 6 Workforce lists and on all of SNAP | `Employers.jsx:426`, `Placements.jsx:227` |
| 11 | Brand rules | The red 3px topbar border breaks the "red = errors only" rule. The sidebar uses fixed hex instead of tokens | `main.css:350`, `tailwind.config.js:61` |
| 12 | Token hygiene | `--sp-*` is unused. `--warn` duplicates `--gold`, and the tint pairs duplicate each other. The light shadow scale is not monotonic (sm blurs more than md). The focus outline is .28 alpha in one place and `--focus-ring` .34 in another. The print block omits about 20 tokens | `main.css:9-104, 320, 821` |

### Worth keeping and replicating

- **Calendar (the reference):** consistent surface recipe, layered tints (page → card → tint → chip), lighter internal hairlines, a skeleton that keeps the grid's shape, `role=tablist` segmented control, chips with `aria-pressed`, drawer anatomy, container-query type scaling.
- **Workforce filter chrome:** the most complete list pattern (descriptor-driven filters, grid/list, two-variant empty state, collapsed on phones).
- **SNAP modals:** `<h2 id>` with `aria-labelledby`, X close, `max-h` scroll, footer built only from ui `Button`.
- **Accessibility groundwork already in progress:** `useModalA11y`, reduced-motion handling that keeps fades, coarse-pointer 44px targets, AA-documented token comments.

### Scope notes on the module names in the request

- **Participants:** Students, Search, Client Profile, Case Management, Assessments, My Caseload.
- **Programs:** there is no Programs page. The program modules are Food Distribution, Workforce Development, SNAP Outreach and Case Management, and each gets the system.
- **Staff Reports:** not built yet (`plans/staff-reporting-architecture.md` is still a proposal). The system will ship the page templates it needs (form page, review list, detail drawer), so it is born consistent. The existing **Reports** page is in scope.

---

## 2. Proposed design system: "NB4HS Operate"

Principle: this is an **Operate** surface. Staff complete tasks, so scanability and sameness come before expression, and the brand lives in precise details: navy chrome, blue action, gold used sparingly, red only for errors. The calendar's density and finish become the default. Tokens remain the single source of truth in `main.css`, exposed to Tailwind by name, as today. No new dependencies.

### 2.1 Color tokens (brand values unchanged)

**Brand:** keep `--navy`, `--primary`, `--accent` (red), `--gold` and the `-ink`/`-foreground` AA variants exactly as they are.

**Surfaces:**

| Token | Light | Use |
|---|---|---|
| `--surface-page` | `#F8FAFC` (`--bg`) | App background |
| `--surface-card` | `#FFFFFF` | Cards, tables, drawers |
| `--surface-sunken` | `#F3F5F9` | Table header, toolbar wells, input fill |
| `--surface-overlay` | `rgba(15,23,42,.45)` | Modal and drawer scrim; replaces `bg-black/30` and `.5` |

**Lines and text:**
- `--border` stays as the default hairline.
- `--border-subtle` is the calendar's `--cal-grid`, used for internal rules and table rows.
- `--border-strong` replaces the stray `#b7c0d1` and `#c7cedb` on hover.
- `--text`, `--muted`, and `--text-on-tint` (formerly `--ev-ink-soft`).

**Semantic tones.** These generalise the calendar's quartet. Each tone has five slots: `bg`, `border`, `chip`, `ink`, `solid`.

| Tone | Built from | Typical meaning |
|---|---|---|
| `info` | primary | Active, scheduled, in progress, class |
| `success` | success | Completed, placed, approved, office visit |
| `warning` | gold (ink `--gold-ink`) | Due soon, pending, needs review |
| `danger` | accent | Overdue, error, holiday, destructive |
| `neutral` | slate | Draft, inactive, closed |
| `violet` | violet | Appointment, secondary category |

- Calendar kinds become aliases (`--ev-class-*` → `info`, and so on), so the calendar renders identically.
- A single `lib/statusTone.js` maps every domain status (case, referral, placement, SNAP contact or case, user) to a tone. The local `statusBadgeVariant()` maps go away.

**Fixes:**
- The topbar's red border becomes a `--border` hairline.
- The sidebar gets `--sidebar-*` tokens.
- `--sp-*` and the duplicate tints are removed.
- The print block is completed.

### 2.2 Typography

Inter stays. It is the brand face and the detector's "overused font" warning does not override brand identity. Load it with `preconnect` plus a `<link>` instead of a CSS `@import`. Use `tabular-nums` on every number column, KPI, time and count.

| Role | Size / line height | Weight | Tailwind token |
|---|---|---|---|
| Page title | clamp(22px, 2vw, 28px) / 1.2, tracking −0.01em | 700 | `text-title` |
| Entity title (profile header) | 20px / 1.3 | 700 | `text-heading` |
| Section / card title | 16px / 1.4 | 650 | `text-section` |
| Body / reading | 15px / 1.55 | 400 | `text-body` |
| UI default (tables, controls, nav) | 14px / 1.45 | 500 | `text-ui` |
| Meta / secondary | 13px / 1.4 | 500 | `text-meta` |
| Caption / overline | 12px / 1.3, **only** for uppercase overlines and badges, with one tracking value (0.06em). Running text never goes below 13px (PRODUCT.md) | 600 | `text-caption`, `.overline` |
| KPI value | 30px / 1.1 | 700 | `text-kpi` |

- The legacy `body{font-size:18px}` becomes 15px. The legacy `h1/h2/h3` tag sizes are retired in favour of the roles above.
- The kiosk keeps its own **touch scale** (body 18px, titles up to 36px), applied through a `density-touch` wrapper. It is not merged into the staff scale.
- All of these replace about 40 arbitrary `text-[…]` values.

### 2.3 Spacing, radius, elevation, layout

- **Spacing:** Tailwind's 4px steps only.
  - Page stack: `gap-6` (24px).
  - Card padding: 20px, or 24px at md and up.
  - Inside a card: 16px between groups, 12px between rows, 8px between label and control.
- **Radius.** These are named tokens, which also fixes the inverted scale. `rounded-lg`/`rounded-xl` go back to stock.

  | Token | Value | Use |
  |---|---|---|
  | `rounded-control` | 10px | Buttons, inputs, selects, segmented tabs |
  | `rounded-surface` | 16px | Cards, tables, modals, drawers (the calendar's surface value) |
  | `rounded-chip` | full | Filter chips, avatars, status dots |
  | `rounded-badge` | 6px | Status badges |

- **Elevation** (monotonic, with dark-mode equivalents):

  | Token | Use |
  |---|---|
  | `shadow-card` | The calendar's soft `0 6px 20px / .06` at rest |
  | `shadow-raised` | Hover, sticky toolbars |
  | `shadow-overlay` | Menus, drawers, modals |

- **Layout:**
  - Content max-width 1200px by default. A `full` width option for Calendar, data tables and dashboards.
  - Page gutters: 16px, 24px at md, 32px at xl.
  - Grids: 12-column at lg and up. Card grids 1 → 2 (sm) → 3 (xl). KPI rows 2 → 4.
- **Breakpoints:** Tailwind's defaults only (640/768/1024/1280). The six ad-hoc `@media` widths in `main.css` move onto them.
- **Motion:**
  - 150ms for colour and state changes; 200ms ease-out for drawers, modals and the event-card lift.
  - Never animate layout.
  - The existing reduced-motion rule stays as it is.

### 2.4 Components

Everything lives in `src/components/ui/`, which already exists, in the existing shadcn/cva style. Each item replaces the duplicates listed beside it.

| Component | API sketch | Replaces |
|---|---|---|
| `PageHeader` | `title, description, actions, back, breadcrumb, meta` | 5 h1 patterns, `.page-header`, `ClientHeader`'s h1 role |
| `Button` (revised) | variants `primary, secondary, outline, ghost, danger, success`; sizes `sm 32, md 40, lg 48`; `loading` | Legacy `.btn-*`, the `h-12 rounded-[12px] text-[15px]` overrides, hex in `secondary` |
| `IconButton` | `label` (required, used as the aria-label), `size`, `variant` | 14 raw icon buttons in Search, the calendar `NAV_BTN` |
| `Card`, `SectionCard` | one `SectionCard` (`title, description, action, footer, flush`) | 3 local `SectionCard`s, `SectionCardHeader`, `.card` |
| `KpiCard` | `label, value, icon, tone, delta, href` | 6 KPI implementations |
| `Field` + `Input`, `Select`, `Textarea`, `Checkbox`, `SearchInput` | label, hint, error and required built in; 40px controls (44px on coarse pointers) | `FormField`, `SnapField`, per-page `TextField`/`SelectField`, global 52px inputs |
| `FilterBar` | search, filter descriptors, active-filter chips, clear; collapses on phones | `SearchFilterPanel`, `FilterFieldSelect`, `FilterFieldBox`, SNAP inline filters |
| `FilterChips`, `SegmentedControl`, `Tabs` | lifted from the calendar; `Tabs` is the underline variant for profiles | Calendar-local copies, raw profile tab buttons, Reports range buttons |
| `DataTable` | `columns, rows, sort, onRowClick, empty, loading`; sticky sunken header; becomes a card list below md | 4 table header styles, `.table-wrap`, SNAP `TH` |
| `ResultsToolbar` | count, sort, view toggle; placed **above** the results | Current below-results toolbar |
| `Pagination` | unchanged API; used on every list | Missing on 3 Workforce lists and on SNAP |
| `StatusBadge` | `status` → tone via `statusTone.js`; optional dot | `Badge` variant maps, `.badge`, ad-hoc spans, `cyan-*` |
| `Dialog` | SNAP structure: `title` (h2 + `aria-labelledby`), X close, scrollable body, footer slot, sizes `sm/md/lg/xl`; `useModalA11y`; framer fade/scale | `.modal-box` and all 5 modal structures |
| `Drawer` | the `EventDrawer` anatomy (448px, header/body/footer), for record previews | Calendar-local drawer |
| `ConfirmDialog` | built on `Dialog`; danger variant | `ConfirmModal`'s legacy buttons |
| `EmptyState` | `variant: none / no-results / error`, `icon, title, body, action` | `EmptyState`, `ResultsEmptyState`, raw `.empty-state`, centred `<p>`s |
| `Skeleton` | `rows`, `table`, `cards`, `kpis` shapes that keep the layout | `null` while loading, "…" values |
| `Alert` | `tone`, `title`, body, action (inline callout) | `.info-callout`, calendar error card (with the icon fixed) |

**Navigation and shell:**
- The sidebar stays as it is (navy, collapsible), moved onto tokens.
- The topbar is a quiet hairline bar.
- `ModuleNav` becomes the single in-module navigation for Workforce, SNAP and, later, Staff Reports, using `Tabs`.
- Below md, the sidebar becomes an off-canvas drawer instead of a 76px rail.

**Calendars and scheduling:** the calendar keeps its composition and now consumes the shared tokens and components (tones, `SegmentedControl`, `FilterChips`, `Drawer`, `Dialog` for "Add event"). Fixes:
- Month view gets an agenda fallback on phones.
- One overline tracking value.
- Tabular numbers in the agenda.
- The invisible error icon.

**Page templates.** Each page is one of these:
1. **List page:** PageHeader → FilterBar → ResultsToolbar → DataTable or card grid → Pagination.
2. **Record page:** back + PageHeader (entity) → summary card → Tabs → SectionCards.
3. **Dashboard:** PageHeader with a range control → KPI row → charts and lists in a 12-column grid.
4. **Form page:** PageHeader → SectionCards of Fields → sticky action footer.
5. **Module shell:** ModuleNav plus one of the above.

---

## 3. Implementation plan

Every phase preserves routes, permissions, data calls and business logic; changes are presentational. After each batch:
- Run `npm run build` and `npm test`.
- Run `impeccable detect`.
- Do a visual check at desktop (1440), tablet (768) and phone (390), in light and dark.
- Ship one PR per batch, so every step can be reviewed and reverted.

**Phase 0: prerequisites (needs your input)**
- This branch has about 75 uncommitted files of in-progress work (contrast tokens, `useModalA11y`, calendar tweaks, chart theme). They should be committed or merged first so the design-system work starts clean. I will not touch them without your go-ahead.
- `/impeccable init`: a short interview that writes PRODUCT.md (users, tone, constraints).

**Phase 1: foundation, with no visual change intended**
- Add the tokens in §2.1–2.3 to `main.css` and `tailwind.config.js`, alias the old names to the new ones, and fix the Inter loading.
- Pages keep rendering identically, because aliases cover the old names.

**Phase 2: primitives plus the representative page**
- Build the §2.4 components.
- Migrate **Participants Search** (`/search`). It exercises nearly every component: header with menu, filters, a table with a phone card fallback, status badges, pagination, three modals, empty, loading and error states.
- Validate with screenshots, `/impeccable critique`, then `/impeccable document` to write DESIGN.md.
- **Approval gate 2:** you review the page in the browser before the rollout. You'll need to sign in once in the app's browser pane.

**Phase 3: rollout**, in this order:

| Batch | Pages | Main work |
|---|---|---|
| 3a Participants | Students, Client Profile, Case Management, Assessments, My Caseload | Record-page template, `Dialog` migration, tables |
| 3b Dashboards and reports | Dashboard, Reports, Workforce Dashboard, Workforce Reports, SNAP Dashboard | One `KpiCard`, chart cards, range `SegmentedControl` |
| 3c Workforce | Job Developer, Employers, Job Openings, Candidate Matching, Referrals, Placements, the three profiles, 6 modals | FilterBar promoted to standard, toolbar above results, pagination everywhere, `Tabs` |
| 3d Outreach (SNAP and future programs) | `Outreach.jsx` shell, Contacts, Cases, Tasks, Staff, the detail modals | PageHeaders, `DataTable` with phone cards, Skeletons, `EmptyState` |
| 3e Programs and admin | Food Distribution, Manage, Settings, Users, QR Code | The legacy-CSS pages: remove about 60 inline styles |
| 3f Calendar | Calendar | Switch to the shared tokens and components; four small fixes; looks the same |
| 3g Shell | Sidebar, topbar, ModuleNav, notifications | Tokens, quiet topbar, phone off-canvas nav |
| 3h Public and kiosk | Check-in/out, appointments, login, reset | Touch-density variant on the shared tokens; a lighter touch, layouts unchanged |

**Phase 4: clean-up**
- Delete the legacy CSS that is now dead (`.btn-*`, `.modal-box`, `.card`, the bare `button`/`input`/`h1` tag rules, `.pill-row`), the local component copies and the token aliases.
- Expected to shrink `main.css` substantially.

**Phase 5: verification**
- `/impeccable audit` again, with a target of at least 17/20, then `/impeccable polish` and a final DESIGN.md refresh.

### Decisions I need from you

1. **Body text size.** Staff screens move from 18px to 15px body and 14px UI, matching the calendar's density. Recommended. The alternative is a 16px body if staff on small laptops find the calendar dense.
2. **Control radius.** 10px for controls; the calendar's controls currently render at 20px (nearly pills). 10px reads more professional and aligns with cards. Alternative: 12px.
3. **Representative page.** Participants Search (recommended), or SNAP Cases (the newest module, with the most tables).
4. **Uncommitted work.** Commit it as its own PR first (recommended), or build on top of it.
