// DayColumn.jsx -- one day of the shared time grid: the weekday/date header
// (MON / 31 / Jul), the all-day cell (holidays live there, since they have
// no start/end time), the hour gridlines, the "now" line on today, and the
// absolutely positioned EventCards laid out side-by-side by layoutOverlaps()
// when they collide (Level 1 & Level 2 both meet 9:30-12:30). A day with
// nothing on it keeps a plain white grid plus one quiet "New Event"
// affordance -- empty time is never tinted, so any colour in the grid means
// a real event.
//
// Today is marked three ways, none of them a full-column wash: a 3px primary
// rule across the top of the column, the date number inverted into a filled
// primary circle, and aria-current="date" on the header cell. Tinting the
// whole column was tried and lost -- it competes with the event cards, which
// are the only thing on this grid that should be coloured.
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { HEADER_HEIGHT, layoutOverlaps } from "./calendarLayout.js";
import { KIND_STYLE } from "./kindStyle.js";
import EventCard from "./EventCard.jsx";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function DayColumn({ day, weekdayLabel, isToday, holiday, grid, singleDay, allDayHeight, nowOffset, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  const { blocks } = day;
  const laidOutBlocks = useMemo(() => layoutOverlaps(blocks), [blocks]);
  const HolidayIcon = KIND_STYLE.holiday.icon;
  const monthLabel = day.date.toLocaleDateString("en-US", { month: "short" });
  const dayNumber = day.date.getDate();

  return (
    <div className={cn("flex flex-col border-l border-[var(--cal-grid)] first:border-l-0", singleDay ? "min-w-0 flex-1" : "min-w-[150px] flex-1 sm:min-w-[168px]")}>
      <div
        style={{ height: HEADER_HEIGHT }}
        className="relative flex flex-col items-center justify-center gap-1 border-b border-[var(--cal-grid)] px-2"
        aria-current={isToday ? "date" : undefined}
      >
        {isToday && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-primary" />}

        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.09em] text-primary">{weekdayLabel}</p>

        {isToday ? (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[19px] font-bold leading-none text-primary-foreground">
            {dayNumber}
          </span>
        ) : (
          <p className="m-0 text-[26px] font-bold leading-none text-navy dark:text-card-foreground">{dayNumber}</p>
        )}

        <p className="m-0 text-[13px] font-medium leading-none text-muted">
          {monthLabel}
          {isToday && <span className="sr-only"> — {t("calendarToday")}</span>}
        </p>
      </div>

      {allDayHeight > 0 && (
        <div
          style={{ height: allDayHeight }}
          className="flex items-center border-b border-[var(--cal-grid)] px-1.5"
        >
          {holiday && (
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5 rounded-md border border-l-[3px] px-1.5 py-1 text-[11px] font-bold leading-none",
                KIND_STYLE.holiday.cardBg,
                KIND_STYLE.holiday.cardBorder,
                KIND_STYLE.holiday.accent,
                KIND_STYLE.holiday.chipFg
              )}
              title={holiday.name + " — " + t("calendarOfficeClosed")}
            >
              <HolidayIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{holiday.name}</span>
            </span>
          )}
        </div>
      )}

      <div className="relative" style={{ height: grid.height }}>
        {/* Dashed hour rules, one step lighter than --border: ten of them a
            column at full strength turn the calendar into a spreadsheet.
            The first is skipped -- the header's own bottom border already
            draws the top of the 8 AM row. */}
        {grid.hours.map((h, i) => (
          <div
            key={h}
            style={{ height: grid.hourHeight, top: i * grid.hourHeight }}
            className={cn("absolute inset-x-0", i > 0 && "border-t border-dashed border-[var(--cal-grid)]")}
            onDoubleClick={() => onAddEvent(day.dateStr)}
          />
        ))}

        {blocks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddEvent(day.dateStr)}
            className={cn(BTN_RESET, "absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1.5 rounded-xl border border-dashed border-secondary-border py-2.5 text-xs font-semibold text-muted transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
          >
            <Plus className="h-3.5 w-3.5" /> {t("calendarNewEvent")}
          </button>
        )}

        {laidOutBlocks.map((b) => (
          <EventCard key={b.key} block={b} grid={grid} roomy={singleDay} t={t} onOpen={onOpen} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        ))}

        {isToday && nowOffset !== null && nowOffset !== undefined && (
          <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: nowOffset }} aria-hidden="true">
            <div className="relative h-px bg-primary">
              <span className="absolute -left-[3px] -top-[3.5px] h-[7px] w-[7px] rounded-full bg-primary" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
