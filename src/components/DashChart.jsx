// DashChart.jsx -- progressive-enhancement chart, ported from reports_data
// .js's upgradeToChart(). Chart.js is loaded via a CDN <script defer> tag in
// index.html (not an npm dependency -- see the project README rationale),
// so it's addressed as the global `window.Chart`, same as the original. If
// it hasn't loaded (or ever fails to), `fallback` (the original's zero-
// dependency CSS bar-list markup) renders instead -- nothing breaks either way.
import { useEffect, useRef } from "react";

// NB4HS Design System chart palette: Blue, Green, Gold, Purple only ("never
// use random colors"). Red is excluded -- charts aren't error states.
const PALETTE = ["#2563EB", "#1a7f37", "#D99E32", "#6b21a8"];

export default function DashChart({ type, labels, datasets, fallback }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const hasChartJs = typeof window !== "undefined" && typeof window.Chart !== "undefined";

  useEffect(() => {
    if (!hasChartJs || !containerRef.current) return undefined;
    const Chart = window.Chart;
    const canvas = document.createElement("canvas");
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(canvas);
    containerRef.current.style.height = "220px";

    const preparedDatasets = datasets.map((ds) => {
      const next = Object.assign({}, ds);
      if (!next.backgroundColor) next.backgroundColor = type === "line" ? "rgba(11,95,165,.15)" : labels.map((_, j) => PALETTE[j % PALETTE.length]);
      if (!next.borderColor) next.borderColor = "#2563EB";
      if (type === "bar") { next.borderRadius = 6; next.borderSkipped = false; next.maxBarThickness = 42; }
      return next;
    });

    // Read the live theme's neutral colors so gridlines/tick labels stay in
    // sync with light/dark mode without hardcoding a second palette here.
    const rootStyles = getComputedStyle(document.documentElement);
    const mutedColor = rootStyles.getPropertyValue("--muted").trim() || "#5b6572";
    const gridColor = rootStyles.getPropertyValue("--border").trim() || "#d9dee4";
    const cardColor = rootStyles.getPropertyValue("--card").trim() || "#ffffff";
    const textColor = rootStyles.getPropertyValue("--text").trim() || "#231F20";
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
  }, [hasChartJs, type, JSON.stringify(labels), JSON.stringify(datasets)]);

  if (!hasChartJs) return <>{fallback}</>;
  return <div ref={containerRef} />;
}
