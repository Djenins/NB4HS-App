---
name: NB4HS Management System
description: "NB4HS Operate: the staff task UI for New Bridges for Haitian Success"
colors:
  primary: "#2563EB"
  primary-dark: "#1D4ED8"
  navy: "#1F2A6D"
  navy-dark: "#172052"
  accent-red: "#D61F26"
  accent-red-dark: "#9A161B"
  gold: "#D99E32"
  gold-ink: "#8C5F1C"
  success: "#1a7f37"
  surface-page: "#F8FAFC"
  surface-card: "#ffffff"
  surface-sunken: "#F3F5F9"
  surface-overlay: "rgba(15,20,30,.5)"
  text: "#0F172A"
  muted: "#64748B"
  text-on-tint: "#5B6879"
  border: "#E5E7EB"
  border-subtle: "#EEF1F7"
  border-strong: "#B7C0D1"
  secondary-border: "#CBD5E1"
  primary-tint: "#E6EDFB"
  tone-info-bg: "#EFF4FE"
  tone-info-border: "#C3D6F8"
  tone-info-chip: "#DCE6FB"
  tone-success-bg: "#EEF7F1"
  tone-success-border: "#BBDDC7"
  tone-success-chip: "#D6ECDD"
  tone-warning-bg: "#F8F0E2"
  tone-warning-border: "#EAD3A8"
  tone-warning-chip: "#F1E0BF"
  tone-danger-bg: "#FDF1F1"
  tone-danger-border: "#F3C8CA"
  tone-danger-chip: "#F9DCDD"
  tone-neutral-bg: "#EEF1F4"
  tone-neutral-border: "#D5DBE3"
  tone-neutral-chip: "#E2E7ED"
  tone-neutral-ink: "#475569"
  tone-violet-bg: "#F6EFFB"
  tone-violet-border: "#DCC4EF"
  tone-violet-chip: "#ECDDF7"
  tone-violet-ink: "#6B21A8"
  tone-violet-solid: "#7C3AED"
typography:
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  section:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  ui:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.45
  meta:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.8125rem"
    lineHeight: 1.4
  caption:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
  kpi:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  badge: "6px"
  control: "10px"
  surface: "16px"
  chip: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.control}"
    typography: "{typography.ui}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.primary-dark}"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.navy}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-secondary-hover:
    backgroundColor: "{colors.primary-tint}"
  button-danger:
    backgroundColor: "{colors.accent-red}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.control}"
    height: "40px"
  button-danger-hover:
    backgroundColor: "{colors.accent-red-dark}"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    typography: "{typography.ui}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.surface}"
    padding: "20px"
  badge-info:
    backgroundColor: "{colors.tone-info-bg}"
    textColor: "{colors.primary-dark}"
    rounded: "{rounded.badge}"
    typography: "{typography.caption}"
    padding: "2px 8px"
  filter-chip:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text}"
    rounded: "{rounded.chip}"
    typography: "{typography.meta}"
    padding: "0 16px"
    height: "36px"
  filter-chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-card}"
  table-header:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.muted}"
    typography: "{typography.meta}"
    padding: "10px 12px"
---

# Design System: NB4HS Management System

## Overview

**Creative North Star: "NB4HS Operate"**

A staff task surface. Case managers, front-desk staff, administrators and outreach workers come here to find a client, record what happened and report on it, so scanability and sameness come before expression. Every module should look and behave like every other one; consistency outranks local cleverness. The brand lives in precise details rather than in decoration: navy chrome, blue action, gold used sparingly, red only when something is wrong.

The density and finish of the Shared Calendar redesign is the quality reference. Its per-kind recipe (soft tint, hairline border, an icon disc one step deeper, an ink that clears AA on the tint) is generalised into six tones that colour every status, category and callout in the app. Surfaces are flat white cards on a cool off-white page, separated by hairlines and a single soft resting shadow. Text is comfortable for older and low-vision staff, targets are generous on touch, and layouts absorb Kreyòl and French strings about 30% longer than English.

Light and dark themes share one token set (`html[data-theme="dark"]`, scoped `@media not print`); the sidebar stays brand navy in both. The kiosk and public check-in flows keep their own larger touch scale and are not governed by the staff type ramp below.

**Key Characteristics:**
- Tokens live once in `src/styles/main.css` and reach Tailwind by name; no hex at the call site.
- Six semantic tones × six slots (bg, border, chip, ink, solid, on-solid).
- Radius by role: badge 6px, control 10px, surface 16px, chip full.
- Monotonic elevation: card → raised → overlay.
- Running text never below 13px; tabular figures on every number.
- 44px targets on coarse pointers.

## Colors

A restrained cool-neutral field carrying one interactive blue, a navy frame, and tones that only appear when they mean something.

### Primary
- **Action Blue** (`primary`): buttons, links, active nav, focus, selected filter chips and segments, charts and icons. Hover deepens to `primary-dark`. Text on a solid blue fill uses `--primary-foreground` (white in light, dark ink in dark mode, where the blue is lightened).
- **Brand Navy** (`navy`): sidebar and shell chrome, and the text colour of the secondary button. Never an interactive fill.

### Secondary
- **Signal Red** (`accent-red`): errors, validation, destructive actions and overdue work only. Text uses the deeper `accent-red-dark` (the danger ink).

### Tertiary
- **Brand Gold** (`gold`): a sparing accent for fills, dots and the warning tone's solid. Gold used as text or an icon glyph takes `gold-ink`; the brand gold itself is 2.36:1 on white.

### Neutral
- **Page** (`surface-page`), **Card** (`surface-card`), **Sunken Well** (`surface-sunken`, table headers, toolbars, footers of dialogs, disabled inputs), **Scrim** (`surface-overlay`, behind dialogs and drawers).
- **Ink** (`text`), **Muted** (`muted`, secondary text on a card), **On-Tint** (`text-on-tint`, secondary text on a tone tint, where muted drops below AA).
- **Lines**: `border` for edges, `border-subtle` for repeated internal rules (table rows, calendar grid), `border-strong` for hover emphasis.

### Tones
| Tone | Meaning | Solid / Ink |
|---|---|---|
| info | active, scheduled, class, selection | primary / primary-dark |
| success | completed, checked in, approved | success / success |
| warning | pending, due soon, needs review | gold / gold-ink |
| danger | error, overdue, destructive | accent-red / accent-red-dark |
| neutral | draft, inactive, checked out, unknown | #64748B / tone-neutral-ink |
| violet | appointments, secondary category | tone-violet-solid / tone-violet-ink |

Slots: `bg` tinted surface, `border` hairline around it, `chip` icon disc one step deeper, `ink` text and icons on bg (≥4.5:1), `solid` filled emphasis, `on-solid` text on solid. Exposed as `bg-tone-{tone}-{slot}` etc.

### Named Rules
**The Red Means Wrong Rule.** Red appears only for errors, validation, destructive actions and overdue work. Never for emphasis, branding or decoration.

**The Status Has One Colour Rule.** A status's tone comes from `src/lib/statusTone.js` (`"<domain>:<status>"` → tone), rendered through `StatusBadge`. The call site never chooses it. Unknown statuses fall back to neutral.

**The Colour Is Never Alone Rule.** Every tone use carries a label or icon; a dot or tint is reinforcement, not the message.

## Typography

**Body Font:** Inter (with -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif)

**Character:** One face, weight and size doing all the hierarchy work. Plain, legible, institutional in the good sense.

### Hierarchy
- **Title** (700, 24px → 28px at md, 1.2, -0.01em): the page h1 in `PageHeader`. A fixed step at 768px, not fluid. Balanced wrapping.
- **Heading** (700, 20px, 1.3): entity titles and dialog titles.
- **Section** (600, 16px, 1.4): card, section, drawer and empty-state titles.
- **Body** (400, 15px, 1.55): descriptions and reading text; page descriptions capped at 65ch.
- **UI** (14px, 1.45): the default for tables, controls, buttons, nav, alerts.
- **Meta** (13px, 1.4): secondary lines, labels, table headers, hints, errors. The floor for running text.
- **Caption** (600, 12px, 1.3): badges, counts and uppercase overlines only.
- **KPI** (700, 24px → 30px at md, 1.1, tabular): KpiCard values.

### Named Rules
**The 13px Floor Rule.** Running text is never smaller than 13px (`text-meta`). 12px (`text-caption`) is for badges, counts and uppercase overlines only.

**The Tabular Figures Rule.** Every number column, KPI, time, count and detail value uses `tabular-nums`.

### Touch scale (kiosk, appointments, sign-in)
The client-facing screens are used with a finger, often from arm's length, so they take the same tokens one size up: `text-touch-hero` 36px, `touch-title` 28px, `touch-heading` 22px, `touch-section` 18px, `touch-lead` 18px, `touch-body` 16px, `touch-label` 15px, `touch-meta` 14px (the floor). Touch controls are 52px or taller with `rounded-touch` (14px), still under the 16px surface. Colours, tones, surfaces and shadows are the shared ones.

## Layout

Content sits in `<main>` with a 16px gutter and a 1200px measure inside the content column; the Calendar runs full width. Tailwind's default breakpoints only (640/768/1024/1280) and its 4px spacing steps.

- **Page stack:** sections separated by 24px (`mb-6`).
- **Card padding:** 16px on phones, 20px from sm (FilterBar, results card); SectionCard 20px → 24px at sm.
- **Inside a card:** 16px between groups, 12px between rows, 6–8px between label and control.
- **KPI rows:** 2 columns → 4 at lg, 16px gap. Below sm the KPI icon and trend drop so two fit side by side.
- **lg is the layout switch.** PageHeader moves its actions beside the title at lg; DataTable shows the table at lg and a divided stacked list below it, because an open sidebar leaves a tablet too narrow for columns.
- **FilterBar:** search on its own row; filters in a 1 → 2 (sm) → up to 5 (xl) grid; collapsed behind a "Filters (n)" toggle on phones, open while any filter is active.

### List page template (Search.jsx is the reference)
PageHeader (title, description, primary action + secondary actions) → KPI row → FilterBar → results card (live count, column toggle, DataTable with `renderCard`) → Drawer for the selected record, which can hand off to an edit Dialog.

## Elevation & Depth

Hybrid: flat tonal layering (page → card → sunken well) with one soft resting shadow and a monotonic scale for lift. Dark mode swaps to tighter, darker shadows.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 6px 20px rgba(15,23,42,.06)`): every card at rest, the segmented-control track.
- **Raised** (`box-shadow: 0 10px 28px rgba(15,23,42,.10)`): hover on an interactive card, sticky toolbars.
- **Overlay** (`box-shadow: 0 20px 48px rgba(15,23,42,.18)`): dialogs, drawers, menus.

### Named Rules
**The Still Card Rule.** Cards do not lift on hover. Only a card that is itself a link or button (`interactive`, clickable KpiCard) raises its border to `border-strong` and its shadow to raised. No translate.

## Shapes

Radius is assigned by role, not size, and a control is never rounder than the surface it sits on: badge 6px, control 10px (buttons, inputs, selects, table frame, alerts, menus, skeletons), surface 16px (cards, dialogs), chip full (filter chips, status dots, avatars, count pills, icon discs in alerts and empty states). Segments inside a SegmentedControl use 7px to nest inside the 10px track. Edges are 1px hairlines; tone surfaces get a full hairline in their own `border` slot.

## Components

Built in `src/components/ui/` (shadcn/cva style). New UI composes these; it does not restyle raw elements.

### Buttons
- **Shape:** control radius (10px); 14px semibold; icon + label with an 8px gap.
- **Sizes:** sm 32px, md 40px, lg 48px, icon 36px; sm/md/icon grow to 44px on coarse pointers.
- **Variants:** primary (blue fill), secondary (card fill, `secondary-border` hairline, navy text, blue-tint hover), outline, ghost (sunken hover), danger (danger solid), success.
- **States:** colour-only transitions at 150ms; 2px focus halo (`--focus-ring`); disabled at 50% opacity. `loading` swaps in a spinner, disables, and sets `aria-busy`.
- **IconButton:** square, ghost by default, sm 32 / md 36 / lg 40 (44 on touch). `label` is required and becomes `aria-label` and `title`.

### Chips
- **FilterChips:** full-round 36px pills (44 touch), 13px semibold, hairline border on card; hover turns border and text blue; active is a solid blue fill. Optional tone dot. Scrolls sideways on phones instead of wrapping.
- **SegmentedControl:** a bordered card track with 4px padding; the active segment is solid blue with a card shadow. For switching what the page shows, not for tab panels.

### Cards / Containers
- **Card:** surface radius, card fill, `border` hairline, card shadow. Padding 24px in Card slots; SectionCard 20 → 24px with an optional hairline footer and `flush` body for edge-to-edge tables.
- **KpiCard:** meta label, tabular KPI value, optional 40px tone icon disc, hint and a Sparkline only when the trend measures the same quantity.
- **Alert:** control radius, tone bg + full tone border, 32px round icon chip; `role="alert"` for danger, `status` otherwise.
- **EmptyState:** three variants (none, no-results, error) with a 48px tone disc, section title, body description capped at 46ch, and the next action.
- **Skeleton:** neutral-tint blocks that keep the shape of the content; pulse stops under reduced motion.

### Inputs / Fields
- **Style:** 40px (44 touch), control radius, card fill, `border` hairline, 14px text, muted placeholder; hover to `border-strong`.
- **Focus:** border turns blue plus the 2px focus halo.
- **Error / Disabled:** `aria-invalid` turns the border red; error text in danger ink with `role="alert"`; disabled uses the sunken fill at 70% opacity.
- **Field:** visible 13px semibold label (never placeholder-only), red asterisk for required, then hint or error. SearchInput adds a leading magnifier and a labelled clear IconButton.

### Data
- **DataTable:** control-radius frame, sticky sunken header (13px semibold muted, sentence case), `border-subtle` row rules, sunken row hover, info-tinted selected rows, 14px tabular body. Sortable headers are buttons with `aria-sort`.
- **Badge / StatusBadge:** 6px radius, 12px semibold, tone bg + ink, optional solid dot.
- **Tabs:** underline tabs, 44px tall, 2px blue underline on the active tab, real ARIA tabs with arrow-key movement and optional count pills.

### Overlays
- **Dialog:** for protected focus only (edit forms, confirmations). Surface radius, overlay shadow, heading title with X close, scrolling body, sunken footer of right-aligned buttons; sizes sm/md/lg/xl; fade + 8px rise + 0.98 scale at 180ms.
- **Drawer:** 448px right panel (full width on phones) for viewing and acting on one record without leaving the list; optional info icon disc, section title, DetailRow label/value pairs, footer actions; slides in at 200ms.
- **ConfirmDialog:** names the action on its confirm button; danger variant paints it red and puts initial focus on Cancel.
- **DropdownMenu:** control radius, overlay shadow, layered above dialogs.

### Navigation
- **Sidebar:** brand navy in both themes (`--sidebar-*` RGB channels so opacity modifiers work), active item on the blue; collapsible rail with tooltips. PageHeader is the single page header on every staff screen, with an optional ghost back link.

### Motion
150ms for colour and state, 200ms ease-out `cubic-bezier(.2,.8,.2,1)` for drawers, dialogs and card lift. Never animate layout. Reduced motion keeps fades and drops movement.

## Do's and Don'ts

### Do:
- **Do** build new UI from `src/components/ui/` and the semantic tokens (`surface-*`, `line-*`, `tone-*`, `rounded-control/surface/badge/chip`, `shadow-card/raised/overlay`, `text-title…text-kpi`).
- **Do** take every status colour from `statusTone` via `StatusBadge`; add new `"<domain>:<status>"` keys there, never pick a tone at the call site.
- **Do** give every icon-only button a label (IconButton's required `label`; `aria-label` on icon-only segments).
- **Do** use `tabular-nums` on every number, KPI, time and count.
- **Do** keep running text at 13px or larger; 12px only for uppercase overlines and badges.
- **Do** make every target 44px on coarse pointers.
- **Do** use a Drawer to view a record and keep the list in view; reserve Dialog for protected focus.
- **Do** send every user-facing string through `t()` with entries in en, ht and fr, and leave room for ~30% longer strings.
- **Do** give tone surfaces a full hairline in their tone's `border` slot.

### Don't:
- **Don't** nest a card in a card; inside a card, use divided rows (as DataTable's phone list does).
- **Don't** put thick side-stripe borders on new components. The calendar event card's left kind accent is the calendar's own device and stays there.
- **Don't** use a modal to show a record that a Drawer could show.
- **Don't** use red for anything but errors, validation, destructive actions and overdue work, or let gold become a dominant colour.
- **Don't** use the legacy classes (`.card`, `.btn-*`, `.modal-box`) or rely on the bare `button`/`input`/`h1` tag rules in main.css; they are deprecated and deleted in Phase 4.
- **Don't** write hex values or Tailwind opacity modifiers on var()-backed colours (`border-primary/25` compiles to nothing); use the pre-blended `*-soft` and tone tokens.
- **Don't** make cards lift on hover unless the whole card is a link or button.
- **Don't** apply the staff type ramp to the kiosk or public check-in flows; they keep their own touch scale.
