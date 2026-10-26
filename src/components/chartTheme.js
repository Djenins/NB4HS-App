// chartTheme.js -- the one place Recharts gets its colours and chrome from,
// shared by DashChart.jsx (Dashboard / Reports / Workforce Reports).
//
// Every value is a CSS var() reference to a design token, not a resolved
// hex. Recharts draws SVG, and SVG fill/stroke resolve var() at paint time,
// so the charts follow the light/dark toggle on their own -- no
// MutationObserver, no re-render, no second palette that can drift from
// main.css.
//
// Categorical series, in a fixed order (colour follows the series, never
// its rank): info blue, success green, warning gold ink, violet. Red is
// excluded -- in this system it means error, overdue or destructive. The
// warning slot uses the ink step: the solid gold is under 3:1 on a card.
export const CHART_SERIES = [
  "var(--tone-info-solid)",
  "var(--tone-success-solid)",
  "var(--tone-warning-ink)",
  "var(--tone-violet-solid)"
];

// Chrome: a recessive hairline grid one step off the surface, and text in
// text tokens -- never a series colour. 13px is the running-text floor.
export const CHART_GRID = "var(--border-subtle)";
export const CHART_AXIS = "var(--border)";
export const CHART_SURFACE = "var(--card)";
export const CHART_TEXT = "var(--text)";
export const CHART_MUTED = "var(--muted)";
export const CHART_HOVER = "var(--surface-sunken)";
export const CHART_TICK = { fill: CHART_MUTED, fontSize: 13 };
export const CHART_TOOLTIP_STYLE = {
  background: CHART_SURFACE,
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "var(--shadow-overlay)",
  color: CHART_TEXT,
  fontSize: 13,
  padding: "8px 12px"
};
// Values lead, labels follow: the category is muted, the value is strong.
export const CHART_TOOLTIP_LABEL_STYLE = { color: CHART_MUTED, fontWeight: 500, marginBottom: 2 };
export const CHART_TOOLTIP_ITEM_STYLE = { color: CHART_TEXT, fontWeight: 600, padding: 0 };
export const CHART_LEGEND_STYLE = { fontSize: 13, color: CHART_TEXT };
