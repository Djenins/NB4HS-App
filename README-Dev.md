# NB4HS Check-In -- React Rewrite (Developer Notes)

This folder is a real Vite + React + react-router-dom rebuild of the
single-file prototype (`NB4HS-CheckIn-Prototype.html`) and the intermediate
buildless version (`NB4HS-App/`). All three still exist side by side; nothing
here has replaced or deleted either of the earlier deliverables.

## Status

Every screen from the original prototype now has a real JSX page and a
route:

| Route | Page | Notes |
|---|---|---|
| `/` | Login | Public landing: kiosk mode, appointment request, staff login link |
| `/staff-login` | StaffLogin | Email/password sign-in |
| `/dashboard` | Dashboard | Stat cards + 4 trend charts (Chart.js, CSS-bar fallback) |
| `/checkin`, `/checkin/student`, `/checkin/visitor`, `/checkin/success` | Check-In flow | Student roster tap-in, visitor form, QR check-out card |
| `/checkout`, `/checkout/scan-success` | Check-Out flow | Manual + QR-scan check-out |
| `/appointments/request`, `/appointments/request/success` | Client-facing appointment request | No login required |
| `/search` | Search | Visitor log filter/search |
| `/reports` | Reports | Date-range stats, Chart.js trend/breakdown charts, CSV/Excel export, print |
| `/qrcode` | QR Code | Printable "scan to check in" poster |
| `/manage` | Manage | Services/staff lists, classroom management |
| `/students` | Students | Kanban roster board (drag-and-drop), enrollment, CSV import, session history |
| `/casemanagement` | Case Management | Client list, notes, CSV import, appointments |
| `/jobdeveloper` | Job Developer | Client list (work permit/resume), appointments |
| `/users` | Users | Staff account management |
| `/settings` | Settings | Closing time, role permissions reference, demo data reset |

Nothing is a placeholder anymore -- `pages/Placeholder.jsx` (the temporary
stand-in used for the task #96 checkpoint) has been deleted now that every
route has a real page.

## Architecture, in one paragraph

The original's global mutable singleton (`App.state` / `App.data` in
`state.js`) is gone. `src/context/AppContext.jsx` is the one place app state
lives (data, config, session, language, kiosk flag, toast, confirm-dialog
state), reached everywhere via the `useApp()` / `useT()` hooks. Everything
that used to be a free function reading that global (`t()`, `escapeHtml()`,
`fmtDuration()`, etc.) is now a pure function that takes what it needs as
parameters -- see `src/lib/*.js`. Routing is real URLs via react-router
(`src/App.jsx`), not a `view` string swapped by a hand-rolled `render()`.
Everything else -- CSS, translations, brand colors, the seeded demo dataset,
the plaintext-password-storage caveat -- is unchanged.

## Things worth knowing before you rely on this

- **I have not run this build.** This sandbox has no npm registry access
  (confirmed back in the Phase 2 Foundation milestone), so every file here
  has been verified *statically*: balanced braces/parens/brackets in every
  `.js`/`.jsx` file, `node --check` on every plain `.js` module, every
  `t("someKey")` call cross-checked against `lib/i18n.js`'s `STR` object
  (282 call sites, zero misses), every `className="..."` cross-checked
  against `styles/main.css` (only one intentional non-match: `pagination-controls`,
  which was always a semantic marker with no CSS rule, styled entirely
  inline -- true in the original too), and every `import { x } from
  "./y.js"` cross-checked against `y.js`'s actual exports. None of that
  proves the JSX itself is valid or that the app renders -- only a real
  `npm install && npm run dev` can prove that. Please run it and tell me
  what breaks.
- **Promise-based confirm dialog.** `requestConfirm(message, opts)` returns
  a Promise<boolean> instead of the original's callback
  (`showConfirmModal(msg, onConfirm)`). Same UX (Cancel/Confirm, danger
  styling, Escape/backdrop-click to dismiss) -- just `if (await
  requestConfirm(...))` instead of a callback, which is the idiomatic React
  shape.
- **Filters/search boxes that used to live on the global `App.state`**
  (Search's filters, Check-Out's search box, Students'/Case Management's/Job
  Developer's search boxes, Reports' date-range selection) are now local
  component state. Nothing outside the page that owned them ever read those
  values, so this is a behavior-preserving simplification, not a feature
  change -- navigating away and back always reset them in the original too
  (nothing persisted them across a `render()` cycle beyond the current view).
- **Kiosk/QR-scan-checkout bootstrap logic** (reading `?checkoutId=`,
  `?kiosk=1`, `#checkin` off the URL) now lives in `App.jsx`'s
  `BootstrapEntry` component instead of being buried at the top of the
  original's `init()`. Same behavior, explicit instead of implicit.
- **Chart.js stays a CDN script tag** (`<script defer>` in `index.html`),
  not an npm dependency -- same reasoning as the Phase 2 Foundation
  decision: it's the original's own choice, and changing it isn't necessary
  to hit "real React app." `components/DashChart.jsx` reads `window.Chart`
  and falls back to a CSS bar chart / SVG sparkline if it isn't loaded yet.

## Running it

```
cd NB4HS-App-React
npm install
cp .env.example .env.local
# Replace the placeholders in .env.local with your Supabase project values.
npm run dev
```

## Running tests

Unit tests use [Vitest](https://vitest.dev/) (config lives in
`vite.config.js`'s `test` block, since Vitest reads Vite's own config).
Currently covers the pure-function helpers in `src/lib/*.js` -- component
tests can use `@testing-library/react` + jest-dom matchers (already wired up
via `src/test/setup.js`), there just aren't any yet.

```
npm test          # run once
npm run test:watch  # re-run on file changes
```

## Supabase connection

The browser client is configured in `src/lib/supabase.js`. Get the project URL
and publishable (or legacy `anon`) key from **Supabase Dashboard -> Project
Settings -> API**, then put them in `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Import `supabase` wherever a query or authentication call is needed:

```js
import { supabase } from "./lib/supabase.js";

const { data, error } = await supabase.from("students").select("*");
```

Never place a Supabase `service_role` or secret key in a `VITE_` variable:
Vite embeds these values in browser JavaScript. The current application data
and demo login still use local storage until database tables, Row Level
Security policies, and an explicit data migration are added.

Demo accounts (same as always -- see the security caveat in the prototype's
own README): `admin@nb4hs.org` / `admin123`, `casemanager@nb4hs.org` /
`casemgr123`, `jobdeveloper@nb4hs.org` / `jobdev123`.

## Suggested test pass

1. Landing page → Staff Login → sign in as admin → Dashboard renders with
   charts.
2. Check-In (both student and visitor paths) → Check-Out → the personal QR
   code check-out flow (scan or paste the `?checkoutId=` URL manually).
3. Search, Reports (try a CSV/Excel export and Print), QR Code page.
4. Manage: toggle a service/staff inactive, add a custom one, add a
   classroom, delete it.
5. Students: drag a card between columns, edit one inline, enroll a new
   student, download the CSV template, start a new session.
6. Case Management / Job Developer: add a client, add a note (case only),
   schedule an appointment, confirm/cancel/complete it, remove a client.
7. Users: add an account, deactivate one, try deleting yourself (should be
   blocked).
8. Settings: change the closing time, reset demo data (confirm dialog
   should appear).
9. Dark mode toggle, language switcher, kiosk mode from the landing page.

Please report back what breaks -- especially anything that only shows up at
runtime (a typo'd prop name, a hook rule violation, etc.) that static
checking can't catch.
