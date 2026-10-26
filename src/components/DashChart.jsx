// DashChart.jsx -- the Reports / Workforce Reports chart, drawn with Recharts
// (the same library Dashboard.jsx uses) instead of the Chart.js global that
// index.html used to load from a CDN on every page. Same props as before:
//   type      "line" | "bar" | "doughnut" | "pie"
//   labels    x-axis categories / slice names
//   datasets  [{ data: number[] }, ...] -- Chart.js-style, so call sites are
//             unchanged; extra Chart.js keys (fill, tension) are accepted and
//             ignored, a line is always a soft-filled smooth area here
//   fallback  rendered instead when there is nothing to plot
// Colours come from chartTheme.js as var() references, so the chart follows
// the light/dark toggle without re-rendering.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_GRID, CHART_LEGEND_STYLE, CHART_SERIES, CHART_TICK, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_STYLE } from "./chartTheme.js";

const HEIGHT = 220;

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function DashChart({ type, labels, datasets, fallback }) {
  const series = (datasets || []).filter((ds) => ds && Array.isArray(ds.data));
  if (!labels || !labels.length || !series.length) return <>{fallback || null}</>;

  const rows = labels.map((label, i) => {
    const row = { label };
    series.forEach((ds, s) => { row["v" + s] = Number(ds.data[i]) || 0; });
    return row;
  });
  const animate = !prefersReducedMotion();
  // Single-series charts have no series name to show, so the tooltip is just
  // "label / value" with no dangling ": " separator; slices keep theirs.
  const isPie = type === "doughnut" || type === "pie";
  const separator = isPie || series.length > 1 ? ": " : "";
  const tooltip = <Tooltip separator={separator} contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={{ color: "var(--text)" }} cursor={{ fill: "var(--tint-neutral)", stroke: CHART_GRID }} />;
  const axes = [
    <CartesianGrid key="g" stroke={CHART_GRID} vertical={false} />,
    <XAxis key="x" dataKey="label" tick={CHART_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />,
    <YAxis key="y" allowDecimals={false} tick={CHART_TICK} axisLine={false} tickLine={false} width={36} />
  ];

  let chart;
  if (isPie) {
    chart = (
      <PieChart>
        <Pie
          data={rows}
          dataKey="v0"
          nameKey="label"
          innerRadius={type === "doughnut" ? 55 : 0}
          outerRadius={80}
          paddingAngle={type === "doughnut" ? 2 : 0}
          stroke="var(--card)"
          isAnimationActive={animate}
        >
          {rows.map((row, i) => <Cell key={row.label} fill={CHART_SERIES[i % CHART_SERIES.length]} />)}
        </Pie>
        <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={CHART_LEGEND_STYLE} />
        {tooltip}
      </PieChart>
    );
  } else if (type === "bar") {
    chart = (
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        {tooltip}
        {series.map((ds, s) => (
          <Bar key={s} dataKey={"v" + s} name={ds.label || ""} fill={CHART_SERIES[s % CHART_SERIES.length]} radius={[6, 6, 0, 0]} maxBarSize={42} isAnimationActive={animate} />
        ))}
      </BarChart>
    );
  } else {
    chart = (
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        {tooltip}
        {series.map((ds, s) => {
          const color = CHART_SERIES[s % CHART_SERIES.length];
          return <Area key={s} type="monotone" dataKey={"v" + s} name={ds.label || ""} stroke={color} strokeWidth={2.5} fill={color} fillOpacity={0.14} isAnimationActive={animate} />;
        })}
      </AreaChart>
    );
  }

  return (
    <div style={{ width: "100%", height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
    </div>
  );
}
