// DashChart.jsx -- progressive-enhancement chart, ported from reports_data
// .js's upgradeToChart(). Chart.js is loaded via a CDN <script defer> tag in
// index.html (not an npm dependency -- see the project README rationale),
// so it's addressed as the global `window.Chart`, same as the original. If
// it hasn't loaded (or ever fails to), `fallback` (the original's zero-
// dependency CSS bar-list markup) renders instead -- nothing breaks either way.
import { useEffect, useRef, useState } from "react";

// NB4HS Design System chart palette: Blue, Green, Gold, Purple only ("never
// use random colors"). Red is excluded -- charts aren't error states.
// Held as token names rather than hexes: Chart.js paints to a canvas and
// can't take a var(), so these are resolved against the live theme below,
// the same way the gridline/tick colours already were. The literal hexes
// here are only the fallback for a var that somehow doesn't resolve, and
// they're the light-mode values. Gold is the deepened --gold-ink, and purple
// the calendar's appointment foreground, matching the classroom accents.
const PALETTE_TOKENS = [
  ["--primary", "#2563EB"],
  ["--success", "#1a7f37"],
  ["--gold-ink", "#8C5F1C"],
  ["--ev-appt-fg", "#6b21a8"]
];

// Chart.js needs a resolved colour string, so the translucent area fill under
// a line chart can't be a color-mix() either -- it's mixed here instead.
function withAlpha(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
}

// Bumps whenever the theme actually changes on <html>. Watching the attribute
// rather than reading config.theme is deliberate: React runs a child's effects
// before its parent's, so when the toggle flips config.theme this component's
// effect would run before AppContext's applyTheme() had set data-theme, and
// every colour below would still resolve to the outgoing theme.
function useThemeVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return version;
}

export default function DashChart({ type, labels, datasets, fallback }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const themeVersion = useThemeVersion();
  const hasChartJs = typeof window !== "undefined" && typeof window.Chart !== "undefined";

  useEffect(() => {
    if (!hasChartJs || !containerRef.current) return undefined;
    const Chart = window.Chart;
    const canvas = document.createElement("canvas");
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(canvas);
    containerRef.current.style.height = "220px";

    // Read the live theme's colors so the series, gridlines and tick labels
    // all stay in sync with light/dark mode without a second palette here.
    const rootStyles = getComputedStyle(document.documentElement);
    const mutedColor = rootStyles.getPropertyValue("--muted").trim() || "#5b6572";
    const gridColor = rootStyles.getPropertyValue("--border").trim() || "#d9dee4";
    const cardColor = rootStyles.getPropertyValue("--card").trim() || "#ffffff";
    const textColor = rootStyles.getPropertyValue("--text").trim() || "#231F20";
    const palette = PALETTE_TOKENS.map(([token, fallbackHex]) => rootStyles.getPropertyValue(token).trim() || fallbackHex);

    const preparedDatasets = datasets.map((ds) => {
      const next = Object.assign({}, ds);
      if (!next.backgroundColor) next.backgroundColor = type === "line" ? withAlpha(palette[0], 0.15) : labels.map((_, j) => palette[j % palette.length]);
      if (!next.borderColor) next.borderColor = palette[0];
      if (type === "bar") { next.borderRadius = 6; next.borderSkipped = false; next.maxBarThickness = 42; }
      return next;
    });
    const isDonut = type === "doughnut" || type === "pie";

    chartRef.current = new Chart(canvas.getContext("2d"), {
      type: type,
      data: { labels: labels, datasets: preparedDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500, easing: "easeOutQuart" },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            display: isDonut,
            position: "bottom",
            labels: { usePointStyle: true, boxWidth: 8, padding: 16, color: mutedColor, font: { size: 12 } }
          },
          tooltip: {
            backgroundColor: cardColor, titleColor: textColor, bodyColor: textColor, borderColor: gridColor, borderWidth: 1,
            padding: 10, cornerRadius: 10, boxPadding: 4, displayColors: !isDonut
          }
        },
        scales: isDonut ? {} : {
          x: { grid: { color: gridColor, drawTicks: false }, border: { display: false }, ticks: { color: mutedColor, font: { size: 12 } } },
          y: { beginAtZero: true, ticks: { precision: 0, color: mutedColor, font: { size: 12 } }, grid: { color: gridColor, drawTicks: false }, border: { display: false } }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        try { chartRef.current.destroy(); } catch (e) { /* ignore */ }
        chartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // themeVersion is a dependency because every colour above is read from
    // the live theme at construction time. Chart.js paints to a canvas, so
    // nothing repaints on its own when the tokens change -- without this the
    // chart keeps the previous theme's series and gridlines until something
    // else remounts it.
  }, [hasChartJs, type, themeVersion, JSON.stringify(labels), JSON.stringify(datasets)]);

  if (!hasChartJs) return <>{fallback}</>;
  return <div ref={containerRef} />;
}
