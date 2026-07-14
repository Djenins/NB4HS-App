// CircularGauge.jsx -- small reusable SVG ring gauge (no chart library --
// recharts is a dependency but only used for Dashboard.jsx's bar/line
// charts; a single ring is simpler as plain SVG). Value is 0-100.
const SIZE_PX = 96;
const STROKE = 9;
const RADIUS = (SIZE_PX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const TONE_STROKE = { success: "#1a7f37", warn: "#D99E32", accent: "#D61F26" };

export default function CircularGauge({ value, label, tone }) {
  const pct = Math.max(0, Math.min(100, value));
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  const color = TONE_STROKE[tone] || TONE_STROKE.success;

  return (
    <div className="flex flex-col items-center">
      <svg width={SIZE_PX} height={SIZE_PX} viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`}>
        <circle cx={SIZE_PX / 2} cy={SIZE_PX / 2} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
        <circle
          cx={SIZE_PX / 2} cy={SIZE_PX / 2} r={RADIUS} fill="none" stroke={color} strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${SIZE_PX / 2} ${SIZE_PX / 2})`}
          style={{ transition: "stroke-dashoffset 0.3s ease" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-card-foreground" style={{ font: "700 20px Inter, sans-serif" }}>
          {pct}%
        </text>
      </svg>
      {label && <span className="mt-1 text-xs font-semibold" style={{ color }}>{label}</span>}
    </div>
  );
}
