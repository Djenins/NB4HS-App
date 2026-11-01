// Legend.jsx -- the calendar's footer bar: the color key on the left (one
// entry per event kind, dot + icon + word, matching the grid exactly) and
// the counts for whatever range is currently on screen on the right, so the
// two things that used to be separate panels read as one summary line.
import { CLASS_ACCENTS, KIND_STYLE } from "./kindStyle.js";
import { cn } from "../../lib/cn.js";

// `classGroups` is how many distinct class groupings the schedule holds
// (Level 1 & 2, Level 3 -> 2). The Class key shows one dot per grouping in
// use, so the legend never claims a single colour for what the grid draws
// in two.
export default function Legend({ t, summary, classGroups }) {
  const classDots = Math.min(Math.max(classGroups || 1, 1), CLASS_ACCENTS.length);
  return (
    <div className="flex flex-col gap-3 rounded-surface border border-border bg-card px-4 py-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-meta font-bold text-card-foreground">{t("calendarLegendTitle")}</span>
        {Object.entries(KIND_STYLE).map(([key, style]) => {
          const Icon = style.icon;
          const dots = key === "class" ? CLASS_ACCENTS.slice(0, classDots) : [style];
          return (
            <span key={key} className="flex items-center gap-1.5 text-meta font-medium leading-none text-muted">
              <span className="flex items-center gap-1">
                {dots.map((d, i) => <span key={i} className={cn("h-2.5 w-2.5 rounded-chip", d.dot)} />)}
              </span>
              <Icon className={cn("h-3.5 w-3.5", style.chipFg)} />
              {t(style.label)}
            </span>
          );
        })}
      </div>

      {summary && (
        <div className="flex items-center divide-x divide-border tabular-nums">
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-body font-bold leading-tight text-card-foreground">{summary.days}</span>
            <span className="block text-caption font-medium text-muted">{t("calendarSummaryDays")}</span>
          </span>
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-body font-bold leading-tight text-tone-info-ink">{summary.classes}</span>
            <span className="block text-caption font-medium text-muted">{t("calendarClassLabel")}</span>
          </span>
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-body font-bold leading-tight text-tone-success-ink">{summary.visits}</span>
            <span className="block text-caption font-medium text-muted">{t("calendarVisitLabel")}</span>
          </span>
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-body font-bold leading-tight text-tone-violet-ink">{summary.appointments}</span>
            <span className="block text-caption font-medium text-muted">{t("calendarAppointmentLabel")}</span>
          </span>
        </div>
      )}
    </div>
  );
}
