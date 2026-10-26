// kpi-card.jsx -- one headline number. Replaces the six per-page KPI tiles
// (StatCard, StatTile, KpiCard x2, KpiStat, Kpi).
//
//   <KpiCard label value icon={Users} tone="info" hint trend={[...]} onClick|href />
//
// The label leads, the value is tabular and large, `hint` is a short line of
// context ("vs. yesterday", "this week"). `trend` draws a sparkline only when
// the series measures the same thing as the value -- never decoration.
// With onClick or href the whole card is a link into the filtered list.
// Below sm the icon and sparkline drop away so two cards fit side by side;
// the hint stays, since it can carry a trend or a "View list" cue.
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";
import { Sparkline } from "./sparkline.jsx";

const DISC = {
  info: "bg-tone-info-chip text-tone-info-ink",
  success: "bg-tone-success-chip text-tone-success-ink",
  warning: "bg-tone-warning-chip text-tone-warning-ink",
  danger: "bg-tone-danger-chip text-tone-danger-ink",
  neutral: "bg-tone-neutral-chip text-tone-neutral-ink",
  violet: "bg-tone-violet-chip text-tone-violet-ink"
};

export function KpiCard({ label, value, icon: Icon, tone = "info", hint, trend, href, onClick, pressed, className }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-meta font-medium text-muted">{label}</div>
          <div className="mt-1 whitespace-nowrap text-kpi tabular-nums text-card-foreground">{value}</div>
        </div>
        {Icon ? (
          <div className={cn("hidden h-10 w-10 shrink-0 items-center justify-center rounded-control sm:flex", DISC[tone] || DISC.info)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {hint || (trend && trend.length > 1) ? (
        <div className="mt-2 flex items-end justify-between gap-3 sm:mt-3">
          {hint ? <div className="min-w-0 text-meta text-muted">{hint}</div> : <span />}
          {trend && trend.length > 1 ? <span className="hidden sm:block"><Sparkline data={trend} tone={tone} /></span> : null}
        </div>
      ) : null}
    </>
  );
  const surface = "block rounded-surface border border-border bg-card p-4 text-left shadow-card sm:p-5";
  const interactive = "w-full transition-[box-shadow,border-color] duration-base hover:border-line-strong hover:shadow-raised focus-visible:outline-none focus-visible:ring-2";
  if (href) return <Link to={href} className={cn(surface, interactive, "no-underline", className)}>{body}</Link>;
  // `pressed` (true/false) makes a clickable card a toggle -- e.g. a KPI
  // that filters the list below -- and shows its on state as a primary ring.
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={pressed == null ? undefined : !!pressed}
        className={cn(BUTTON_RESET, surface, interactive, pressed && "border-primary ring-2", className)}
      >
        {body}
      </button>
    );
  }
  return <div className={cn(surface, className)}>{body}</div>;
}
