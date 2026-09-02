// DayColumn.jsx -- one day of the shared time grid: the weekday/date header,
// the all-day cell (holidays live there, since they have no start/end time),
// the hour gridlines, the "now" line on today, and the absolutely positioned
// EventCards laid out side-by-side by layoutOverlaps() when they collide
// (Level 1 & Level 2 both meet 9:30-12:30). A day with nothing on it keeps a
// plain white grid plus one quiet "New Event" affordance -- empty time is
// never tinted, so any color in the grid means a real event.
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { ALLDAY_HEIGHT, HEADER_HEIGHT, layoutOverlaps } from "./calendarLayout.js";
import { KIND_STYLE } from "./kindStyle.js";
import EventCard from "./EventCard.jsx";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function DayColumn({ day, weekdayLabel, isToday, holiday, grid, singleDay, nowOffset, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  const { blocks } = day;
  const laidOutBlocks = useMemo(() => layoutOverlaps(blocks), [blocks]);
  const HolidayIcon = KIND_STYLE.holiday.icon;
  const dateLabel = day.date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div className={cn("flex flex-col border-l border-border first:border-l-0", singleDay ? "min-w-0 flex-1" : "min-w-[132px] flex-1 sm:min-w-[148px]")}>
      <div
        style={{ height: HEADER_HEIGHT }}
        className={cn("flex flex-col items-center justify-center gap-0.5 border-b border-border", isToday && "bg-primary-tint")}
      >
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{weekdayLabel}</p>
        <div className="flex items-center gap-1.5">
          <p className={cn("m-0 text-[15px] font-bold leading-none", isToday ? "text-primary" : "text-card-foreground")}>{dateLabel}</p>
          {isToday && (
            <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
              {day.date.getDate()}
            </span>
          )}
        </div>
      </div>

      <div
        style={{ height: ALLDAY_HEIGHT }}
        className={cn("flex items-center border-b border-border px-1.5", isToday && "bg-primary-tint")}
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

      <div className="relative" style={{ height: grid.height }}>
        {grid.hours.map((h, i) => (
          <div
            key={h}
            style={{ height: grid.hourHeight, top: i * grid.hourHeight }}
            className="absolute inset-x-0 border-t border-border"
            onDoubleClick={() => onAddEvent(day.dateStr)}
          />
        ))}

        {blocks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddEvent(day.dateStr)}
            className={cn(BTN_RESET, "absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1.5 rounded-lg border border-dashed border-secondary-border py-2.5 text-xs font-semibold text-muted transition-colors hover:border-primary hover:bg-primary-tint hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
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
