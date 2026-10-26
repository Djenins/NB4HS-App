// DashChart.jsx -- the Dashboard / Reports / Workforce Reports chart, drawn
// with Recharts. Props (unchanged):
//   type      "line" | "bar" | "doughnut" | "pie"
//   labels    x-axis categories / slice names
//   datasets  [{ data: number[], label? }, ...] -- Chart.js-style, so call
//             sites are unchanged; extra Chart.js keys (fill, tension) are
//             accepted and ignored, a line is always a soft-filled area
//   fallback  rendered instead when there is nothing to plot
// Optional (added with the design-system migration):
//   title        the chart's accessible name; also captions the screen-reader
//                data table
//   height       plot height in px (default 224 / h-56, axis band included)
//   valueLabels  true/false forces value labels on bar caps; by default a
//                single-series bar chart of 12 bars or fewer labels each cap
//
// Dataviz rules applied here: one y-axis; series colours from chartTheme.js
// in a fixed order; text in text tokens, never a series colour; a legend for
// two or more series (and for every pie); hairline recessive grid; 2px
// lines with a ~10% area wash; bars capped at 24px with 4px rounded caps; a
// hover/focus tooltip that enhances but never gates -- every value is also in
// a visually hidden table for screen readers.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_AXIS, CHART_GRID, CHART_HOVER, CHART_LEGEND_STYLE, CHART_MUTED, CHART_SERIES, CHART_SURFACE,
  CHART_TICK, CHART_TOOLTIP_ITEM_STYLE, CHART_TOOLTIP_LABEL_STYLE, CHART_TOOLTIP_STYLE
} from "./chartTheme.js";

const MAX_LABELLED_BARS = 12;

function prefersReducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Legend entries keep the coloured marker Recharts draws beside them; the
// text itself is set in the text token (Recharts would colour it with the
// series colour otherwise).
function legendText(value) {
  return <span className="text-meta text-card-foreground">{value}</span>;
}

const seriesName = (ds, s) => ds.label || (s === 0 ? "" : String(s + 1));

export default function DashChart({ type, labels, datasets, fallback, title, height, valueLabels }) {
  const series = (datasets || []).filter((ds) => ds && Array.isArray(ds.data));
  if (!labels || !labels.length || !series.length) return <>{fallback || null}</>;

  const rows = labels.map((label, i) => {
    const row = { label };
    series.forEach((ds, s) => { row["v" + s] = Number(ds.data[i]) || 0; });
    return row;
  });
  const animate = !prefersReducedMotion();
  const isPie = type === "doughnut" || type === "pie";
  const multi = series.length > 1;
  // Single-series charts have no series name to show, so the tooltip is just
  // "label / value" with no dangling ": " separator; slices keep theirs.
  const separator = isPie || multi ? ": " : "";
  const tooltip = (
    <Tooltip
      separator={separator}
      contentStyle={CHART_TOOLTIP_STYLE}
      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
      cursor={type === "bar" ? { fill: CHART_HOVER } : { stroke: CHART_AXIS, strokeWidth: 1 }}
      isAnimationActive={false}
    />
  );
  const legend = <Legend verticalAlign="bottom" iconSize={10} wrapperStyle={CHART_LEGEND_STYLE} formatter={legendText} />;
  const axes = [
    <CartesianGrid key="g" stroke={CHART_GRID} strokeWidth={1} vertical={false} />,
    <XAxis key="x" dataKey="label" tick={CHART_TICK} axisLine={{ stroke: CHART_AXIS }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />,
    <YAxis key="y" allowDecimals={false} tick={CHART_TICK} axisLine={false} tickLine={false} width={40} />
  ];
  const showValueLabels = valueLabels != null ? !!valueLabels : (!multi && rows.length <= MAX_LABELLED_BARS);

  let chart;
  if (isPie) {
    chart = (
      <PieChart>
        <Pie
          data={rows}
          dataKey="v0"
          nameKey="label"
          innerRadius={type === "doughnut" ? "58%" : 0}
          outerRadius="80%"
          paddingAngle={0}
          stroke={CHART_SURFACE}
          strokeWidth={2}
          isAnimationActive={animate}
        >
          {rows.map((row, i) => <Cell key={row.label} fill={CHART_SERIES[i % CHART_SERIES.length]} />)}
        </Pie>
        {legend}
        {tooltip}
      </PieChart>
    );
  } else if (type === "bar") {
    chart = (
      <BarChart data={rows} margin={{ top: showValueLabels ? 22 : 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        {axes}
        {tooltip}
        {multi ? legend : null}
        {series.map((ds, s) => (
          <Bar key={s} dataKey={"v" + s} name={seriesName(ds, s)} fill={CHART_SERIES[s % CHART_SERIES.length]} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={animate}>
            {showValueLabels ? <LabelList dataKey={"v" + s} position="top" offset={6} fill={CHART_MUTED} fontSize={13} /> : null}
          </Bar>
        ))}
      </BarChart>
    );
  } else {
    chart = (
      <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {axes}
        {tooltip}
        {multi ? legend : null}
        {series.map((ds, s) => {
          const color = CHART_SERIES[s % CHART_SERIES.length];
          return (
            <Area
              key={s}
              type="monotone"
              dataKey={"v" + s}
              name={seriesName(ds, s)}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={color}
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: CHART_SURFACE, strokeWidth: 2 }}
              isAnimationActive={animate}
            />
          );
        })}
      </AreaChart>
    );
  }

  return (
    <figure className="m-0" aria-label={title || undefined}>
      {/* The plot is for sighted readers; the table below carries every
          value for assistive tech. Height is a prop, so it stays inline. */}
      <div
        aria-hidden="true"
        className={height ? "w-full tabular-nums" : "h-56 w-full tabular-nums"}
        style={height ? { height } : undefined}
      >
        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
      </div>
      <table className="sr-only">
        {title ? <caption>{title}</caption> : null}
        <thead>
          <tr>
            <td />
            {series.map((ds, s) => <th key={s} scope="col">{seriesName(ds, s) || title || ""}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <th scope="row">{row.label}</th>
              {series.map((_, s) => <td key={s}>{row["v" + s]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
