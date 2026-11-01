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
// to infer the view from the shape of `days`. The view switcher is the
// shared SegmentedControl and the arrows are IconButtons, so this row draws
// with the same parts as every other page header. Search, the filter chips and
// Calendar Settings live one row down in CalendarToolbar -- this row holds
// only what the reference composition puts on it.
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/button.jsx";
import { IconButton } from "../ui/icon-button.jsx";
import { SegmentedControl } from "../ui/segmented-control.jsx";

export default function CalendarHeader({
  t, title, rangeLabel, prevLabel, nextLabel, views, view, onViewChange, onToday, onPrev, onNext
}) {
  return (
    <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-center xl:gap-4">
      <div className="flex min-w-0 items-center gap-2.5 xl:justify-self-start">
        <CalendarDays className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
        <h1 className="m-0 truncate text-title text-navy dark:text-card-foreground">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 xl:justify-self-center">
        <IconButton label={prevLabel} variant="secondary" size="lg" onClick={onPrev} className="shadow-card">
          <ChevronLeft aria-hidden="true" />
        </IconButton>

        {/* The blue rule under the label is the only ornament on this row --
            it ties the range control to the current-day marker down in the
            grid, which uses the same primary bar. */}
        <p
          className="relative m-0 flex h-10 min-w-0 items-center gap-2 overflow-hidden rounded-control border border-border bg-card px-3.5 text-meta font-bold tabular-nums text-card-foreground shadow-card sm:text-ui [@media(pointer:coarse)]:h-11"
          aria-live="polite"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">{rangeLabel}</span>
          <span aria-hidden="true" className="absolute inset-x-3.5 bottom-0 h-[2px] rounded-chip bg-primary" />
        </p>

        <IconButton label={nextLabel} variant="secondary" size="lg" onClick={onNext} className="shadow-card">
          <ChevronRight aria-hidden="true" />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-self-end">
        <SegmentedControl
          label={t("calendarView")}
          value={view}
          onChange={onViewChange}
          options={views.map((v) => ({ value: v.key, label: t(v.label) }))}
          className="flex-nowrap"
        />

        <Button variant="secondary" onClick={onToday} className="shadow-card">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {t("calendarToday")}
        </Button>
      </div>
    </div>
  );
}
