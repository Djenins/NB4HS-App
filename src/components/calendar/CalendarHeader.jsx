// CalendarHeader.jsx -- page identity (pale-blue calendar badge + title +
// subtitle) on the left, date navigation (Today / prev / next / current
// range) on the right. The range label's format depends on the active view
// (week/day/month), so Calendar.jsx computes and passes it in rather than
// this component trying to infer the view from the shape of `days`.
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function CalendarHeader({ t, rangeLabel, prevLabel, nextLabel, onToday, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary sm:h-14 sm:w-14">
          <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
        <div className="min-w-0">
          <h1 className="m-0 text-[clamp(1.5rem,2.4vw,2.25rem)] font-bold leading-tight tracking-tight text-navy dark:text-card-foreground">
            {t("calendarTitle")}
          </h1>
          <p className="m-0 mt-0.5 text-[15px] leading-snug text-muted sm:text-base">{t("calendarSubtitle")}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToday}
          className={cn(
            BTN_RESET,
            "flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary shadow-card transition-colors hover:bg-primary-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {t("calendarToday")}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label={prevLabel}
            className={cn(BTN_RESET, "flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-card transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={nextLabel}
            className={cn(BTN_RESET, "flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-card-foreground shadow-card transition-colors hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p
          className="m-0 flex h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-bold text-card-foreground shadow-card"
          aria-live="polite"
        >
          {rangeLabel}
        </p>
      </div>
    </div>
  );
}
