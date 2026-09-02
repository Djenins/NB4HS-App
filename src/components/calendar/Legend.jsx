// Legend.jsx -- the calendar's footer bar: the color key on the left (one
// entry per event kind, dot + icon + word, matching the grid exactly) and
// the counts for whatever range is currently on screen on the right, so the
// two things that used to be separate panels read as one summary line.
import { KIND_STYLE } from "./kindStyle.js";
import { cn } from "../../lib/cn.js";

export default function Legend({ t, summary }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="text-[13px] font-bold text-card-foreground">{t("calendarLegendTitle")}</span>
        {Object.entries(KIND_STYLE).map(([key, style]) => {
          const Icon = style.icon;
          return (
            <span key={key} className="flex items-center gap-1.5 text-[13px] font-medium leading-none text-muted">
              <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
              <Icon className={cn("h-3.5 w-3.5", style.chipFg)} />
              {t(style.label)}
            </span>
          );
        })}
      </div>

      {summary && (
        <div className="flex items-center divide-x divide-border">
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-[15px] font-bold leading-tight text-card-foreground">{summary.days}</span>
            <span className="block text-[11px] text-muted">{t("calendarSummaryDays")}</span>
          </span>
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-[15px] font-bold leading-tight text-primary">{summary.classes}</span>
            <span className="block text-[11px] text-muted">{t("calendarClassLabel")}</span>
          </span>
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-[15px] font-bold leading-tight text-success">{summary.visits}</span>
            <span className="block text-[11px] text-muted">{t("calendarVisitLabel")}</span>
          </span>
          <span className="px-3 text-center first:pl-0 last:pr-0">
            <span className="block text-[15px] font-bold leading-tight text-[var(--ev-appt-fg)]">{summary.appointments}</span>
            <span className="block text-[11px] text-muted">{t("calendarAppointmentLabel")}</span>
          </span>
        </div>
      )}
    </div>
  );
}
