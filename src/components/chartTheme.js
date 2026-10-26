// chartTheme.js -- the one place Recharts gets its colours from, shared by
// DashChart.jsx (Reports / Workforce Reports) and Dashboard.jsx.
//
// Every value is a CSS var() reference, not a resolved hex. Recharts draws
// SVG, and SVG fill/stroke take var() directly, so the charts re-theme with
// the light/dark toggle on their own -- no MutationObserver, no re-render,
// no second hex palette that can drift from main.css.
//
// NB4HS Design System chart palette: Blue, Green, Gold, Purple only ("never
// use random colors"). Red is excluded -- charts aren't error states. Gold is
// the deepened --gold-ink: the brand --gold is 2.36:1 on a white card, under
// the 3:1 a chart mark needs; purple is the calendar's appointment ink.
export const CHART_SERIES = ["var(--primary)", "var(--success)", "var(--gold-ink)", "var(--ev-appt-fg)"];

export const CHART_GRID = "var(--border)";
export const CHART_TICK = { fill: "var(--muted)", fontSize: 12 };
export const CHART_TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--text)",
  fontSize: 13
};
export const CHART_TOOLTIP_LABEL_STYLE = { color: "var(--text)", fontWeight: 600 };
export const CHART_LEGEND_STYLE = { fontSize: 12, color: "var(--muted)" };
