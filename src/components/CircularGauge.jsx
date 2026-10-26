// CircularGauge.jsx -- small reusable SVG ring gauge (no chart library --
// recharts is a dependency but only used for Dashboard.jsx's bar/line
// charts; a single ring is simpler as plain SVG). Value is 0-100.
//
//   <CircularGauge value={72} label="Good" tone="success" title="Job Readiness Score" />
//
// The ring and its label use the design system's tone tokens (ink slot, so
// the arc clears 3:1 on a card -- the warning *solid* is brand gold at
// 2.36:1). Colour is never the only signal: the percentage sits in the
// middle and the bucket label below. The whole gauge is one role="img" with
// a spoken name ("Job Readiness Score: 72% -- Good").
//
// `tone` takes a design-system tone (success, info, warning, neutral...).
// readinessBucket() in lib/jobProfile.js still returns the older names; they
// map here: warn -> neutral ("Fair" is neither good nor a problem) and
// accent -> warning ("Needs Attention" is a review flag, not an error, so it
// stays off red -- the red-means-wrong rule).
import { cn } from "../lib/cn.js";

const SIZE_PX = 96;
const STROKE = 9;
const RADIUS = (SIZE_PX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const LEGACY_TONE = { warn: "neutral", accent: "warning" };

// Spelled out in full so Tailwind's scanner sees every class.
const TONE = {
  success: { arc: "stroke-tone-success-ink", ink: "text-tone-success-ink" },
  info: { arc: "stroke-tone-info-ink", ink: "text-tone-info-ink" },
  warning: { arc: "stroke-tone-warning-ink", ink: "text-tone-warning-ink" },
  neutral: { arc: "stroke-tone-neutral-ink", ink: "text-tone-neutral-ink" },
  danger: { arc: "stroke-tone-danger-ink", ink: "text-tone-danger-ink" },
  violet: { arc: "stroke-tone-violet-ink", ink: "text-tone-violet-ink" }
};

export default function CircularGauge({ value, label, tone, title, className }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const offset = CIRCUMFERENCE * (1 - pct / 100);
  const colours = TONE[LEGACY_TONE[tone] || tone] || TONE.success;
  const spoken = (title ? title + ": " : "") + pct + "%" + (label ? " — " + label : "");

  return (
    <div role="img" aria-label={spoken} className={cn("flex flex-col items-center", className)}>
      <div className="relative h-24 w-24">
        <svg width={SIZE_PX} height={SIZE_PX} viewBox={`0 0 ${SIZE_PX} ${SIZE_PX}`} aria-hidden="true" focusable="false">
          <circle cx={SIZE_PX / 2} cy={SIZE_PX / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-tone-neutral-chip" />
          <circle
            cx={SIZE_PX / 2} cy={SIZE_PX / 2} r={RADIUS} fill="none" strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} strokeLinecap="round"
            transform={`rotate(-90 ${SIZE_PX / 2} ${SIZE_PX / 2})`}
            className={cn("transition-[stroke-dashoffset] duration-base ease-out", colours.arc)}
          />
        </svg>
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-heading font-bold tabular-nums text-card-foreground">
          {pct}%
        </span>
      </div>
      {label ? <span aria-hidden="true" className={cn("mt-1 text-meta font-semibold", colours.ink)}>{label}</span> : null}
    </div>
  );
}
