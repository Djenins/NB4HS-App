// CalendarHeader.jsx -- page title + Today/Prev/Next/date-range controls.
// The range label's format depends on the active view (week/day/month), so
// Calendar.jsx computes and passes it in rather than this component trying
// to infer view type from the shape of `days`.
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button.jsx";

export default function CalendarHeader({ t, rangeLabel, onToday, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-card-foreground">{t("calendarTitle")}</h1>
        <p className="m-0 text-sm text-muted">{t("calendarSubtitle")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onToday}>
          <CalendarDays className="mr-1.5 h-4 w-4" />{t("calendarToday")}
        </Button>
        <Button variant="outline" size="icon" onClick={onPrev} aria-label={t("calendarPrevWeek")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={onNext} aria-label={t("calendarNextWeek")}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-card-foreground">
          {rangeLabel}
        </span>
      </div>
    </div>
  );
}
