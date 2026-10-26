// sparkline.jsx -- a tiny trend line for a KpiCard, coloured by tone.
// Decorative to assistive tech (the card's value carries the meaning).
const STROKE = {
  info: "var(--tone-info-solid)",
  success: "var(--tone-success-solid)",
  warning: "var(--tone-warning-ink)",
  danger: "var(--tone-danger-solid)",
  neutral: "var(--tone-neutral-solid)",
  violet: "var(--tone-violet-solid)"
};

export function Sparkline({ data, tone = "info", width = 84, height = 28 }) {
  // A flat line of zeros says nothing; leave the space empty instead.
  if (!data || data.length < 2 || !data.some((v) => v > 0)) return null;
  const max = Math.max(1, ...data);
  const step = width / (data.length - 1);
  const points = data.map((v, i) => [i * step, height - (v / max) * (height - 4) - 2]);
  const line = points.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const color = STROKE[tone] || STROKE.info;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="shrink-0" aria-hidden="true">
      {/* style, not fill/stroke attributes, so the var() colour resolves */}
      <path d={line + ` L${width},${height} L0,${height} Z`} style={{ fill: color }} opacity="0.12" />
      <path d={line} fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
