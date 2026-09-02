// CalendarHeader.jsx -- the calendar's primary toolbar, in three zones:
// page identity on the left, date navigation dead-centre, view switcher +
// Today on the right. The centre zone is genuinely centred on the page (not
// just "after the title"), which is why this is a 3-column grid at xl
// rather than a justify-between flex row -- with flex, a long range label
// like "July 31 – August 4, 2026" pushes itself off-centre as the title
// beside it changes length between views.
//
// The range label's format depends on the active view (week/day/month), so
// Calendar.jsx computes and passes it in rather than this component trying
// to infer the view from the shape of `days`. Search, the filter chips and
// Calendar Settings live one row down in CalendarToolbar -- this row holds
// only what the reference composition puts on it.
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

const NAV_BTN = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-card-foreground shadow-card transition-colors hover:border-primary-soft hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export default function CalendarHeader({
  t, title, rangeLabel, prevLabel, nextLabel, views, view, onViewChange, onToday, onPrev, onNext
}) {
  return (
    <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-center xl:gap-4">
      <div className="flex min-w-0 items-center gap-2.5 xl:justify-self-start">
        <CalendarDays className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
        <h1 className="m-0 truncate text-[clamp(1.35rem,2vw,1.75rem)] font-bold leading-tight tracking-tight text-navy dark:text-card-foreground">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 xl:justify-self-center">
        <button type="button" onClick={onPrev} aria-label={prevLabel} className={cn(BTN_RESET, NAV_BTN)}>
          <ChevronLeft className="h-[18px] w-[18px]" />
        </button>

        {/* The blue rule under the label is the only ornament on this row --
            it ties the range control to the current-day marker down in the
            grid, which uses the same 3px primary bar. */}
        <p
          className="relative m-0 flex h-10 min-w-0 items-center gap-2 overflow-hidden rounded-xl border border-border bg-card px-3.5 text-[13px] font-bold text-card-foreground shadow-card sm:text-sm"
          aria-live="polite"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{rangeLabel}</span>
          <span aria-hidden="true" className="absolute inset-x-3.5 bottom-0 h-[2px] rounded-full bg-primary" />
        </p>

        <button type="button" onClick={onNext} aria-label={nextLabel} className={cn(BTN_RESET, NAV_BTN)}>
          <ChevronRight className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-self-end">
        <div
          role="tablist"
          aria-label={t("calendarView")}
          className="flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-card"
        >
          {views.map((v) => {
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onViewChange(v.key)}
                className={cn(
                  BTN_RESET,
                  "flex h-8 shrink-0 items-center rounded-lg px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-3.5",
                  active
                    ? "bg-primary font-bold text-primary-foreground shadow-card"
                    : "font-semibold text-navy hover:bg-primary-tint hover:text-primary dark:text-card-foreground"
                )}
              >
                {t(v.label)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToday}
          className={cn(
            BTN_RESET,
            "flex h-10 shrink-0 items-center gap-2 rounded-xl border border-primary-soft bg-card px-3.5 text-[13px] font-semibold text-primary transition-colors hover:border-primary hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-sm"
          )}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {t("calendarToday")}
        </button>
      </div>
    </div>
  );
}
