# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The NB4HS Management System is used by staff of New Bridges for Haitian Success, a nonprofit that serves the Haitian community. They fall into four groups:

- **Case managers and job developers** work client files at a desk on a laptop: intake, case notes, assessments, appointments, job placement. This is the longest-session, highest-density use.
- **Front-desk and reception staff** check clients in and out, often on a tablet or a shared lobby screen (kiosk mode).
- **Administrators and the Executive Director** review dashboards and reports, manage users, programs and settings.
- **Outreach workers** (SNAP and other Outreach programs) log contacts, cases and follow-ups, sometimes from a phone in the field.

Clients use the public parts directly: the check-in kiosk, appointment requests and appointment lookup.

## Product Purpose

The system is one place to run the organization's programs: client check-in and visit logging, classes and student rosters, case management, assessments, food distribution, workforce development (employers, job openings, referrals, placements), Outreach programs (SNAP first), a shared calendar, and reporting. It replaces paper and spreadsheet workflows. Success means staff can find a client, record what happened and report on it, quickly and accurately, without training on each module separately.

## Positioning

Built for one organization's real programs and roles. It is not a generic CRM. Modules mirror how NB4HS actually delivers services, including program-specific roles (for example SNAP worker, supervisor or program admin) and trilingual operation for a Haitian community.

## Operating Context

- **Roles decide navigation.** Sidebar and route access depend on the system role (administrator, staff, receptionist, case_manager, job_developer), plus admin-granted Workforce access and per-program roles from `program_staff`.
- **Shared lobby devices** run a kiosk mode with no staff chrome.
- **Biweekly staff reports** to the Executive Director are planned (`plans/staff-reporting-architecture.md`).
- **Data and auth** come from Supabase. Row-level security and audit logging are part of every module.

## Capabilities and Constraints

- **Stack:** React 18, Vite, Tailwind 3 (preflight off) alongside a legacy global stylesheet (`src/styles/main.css`), shadcn-style primitives in `src/components/ui/`, Recharts, framer-motion and lucide icons. No new dependencies without a reason.
- **Fixed during UI work:** routes, permissions, database behavior and business logic.
- **Languages:** English, Kreyòl Ayisyen and Français (`src/lib/i18n.js`). Every user-facing string goes through `t()`.
- **Themes:** light and dark, toggled through `html[data-theme="dark"]`. A print stylesheet is used for reports and visit slips.

## Brand Commitments

- **Name:** NB4HS (New Bridges for Haitian Success).
- **Brand colors, from the client's brand spec:** navy `#1F2A6D` for chrome; blue `#2563EB` for interactive elements; red `#D61F26` reserved for errors, validation and destructive actions; gold `#D99E32` as a sparing premium accent only.
- **Typeface:** Inter.
- **Visual reference:** the approved Shared Calendar redesign sets the quality bar for the staff application (approved 2026-10-26).

## Product Principles

1. **One product, not modules.** A screen in any module should behave and look like every other screen. Consistency outranks local cleverness.
2. **Obvious next step.** Plain labels, few choices per screen and a clear primary action, because staff vary in digital literacy.
3. **Readable for everyone on staff.** Comfortable text and generous targets for older and low-vision staff. Dense data screens must still meet this.
4. **Every language fits.** Layouts absorb longer Kreyòl and French strings without truncating meaning or breaking.
5. **Trustworthy records.** Never show fabricated or placeholder data as real. States (empty, loading, error) are explicit.

## Accessibility & Inclusion

- WCAG 2.1 AA as the floor: contrast, keyboard, focus and screen readers.
- Design for older and low-vision staff:
  - Body text no smaller than 15px; secondary text no smaller than 13px, used sparingly.
  - 44px targets on touch devices.
- Design for low digital literacy: plain language, visible labels (never placeholder-only) and confirmations for destructive actions.
- Trilingual text expansion: allow about 30% longer strings in buttons, tabs and headers.
- Reduced motion is respected: fades are kept, movement is dropped.
