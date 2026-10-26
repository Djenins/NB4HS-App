// DayColumn.jsx -- one day of the shared time grid: the weekday/date header
// (MON / a date disc / Oct 2026 / the day's "1 class • 4 students" summary),
// the all-day cell (holidays live there, since they have
// no start/end time), the hour gridlines, the "now" line on today, and the
// absolutely positioned EventCards laid out side-by-side by layoutOverlaps()
// when they collide (Level 1 & Level 2 both meet 9:30-12:30). A day with
// nothing on it keeps a plain white grid plus one quiet "New Event"
// affordance -- empty time is never tinted, so any colour in the grid means
// a real event.
//
// Today is marked three ways: the date disc filled primary (every other day
// sits in a neutral disc), the weekday set in primary, and a faint
// --cal-today-bg wash down the whole column -- a step off white, quiet
// enough that the event cards stay the only saturated colour on the grid.
// aria-current="date" carries it for assistive tech.
import { Plus, Users } from "lucide-react";
import { useMemo } from "react";
import { HEADER_HEIGHT, layoutOverlaps } from "./calendarLayout.js";
import { KIND_STYLE } from "./kindStyle.js";
import EventCard from "./EventCard.jsx";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

// The header pill: what's on this day at a glance. Classes lead with their
// live enrolled count; visits/appointments are counted as events. Built only
// from the blocks actually on the grid, so a filtered view summarises what
// it shows.
function daySummary(blocks, t) {
  const classes = blocks.filter((b) => b.kind === "class");
  const students = classes.reduce((n, b) => n + (b.count || 0), 0);
  const others = blocks.length - classes.length;
  const fmt = (n, one, many) => t(n === 1 ? one : many).replace("{n}", String(n));
  const parts = [];
  if (classes.length) parts.push(fmt(classes.length, "calendarClassOne", "calendarClassMany"));
  if (students) parts.push(fmt(students, "calendarStudentOne", "calendarStudentMany"));
  if (others) parts.push(fmt(others, "calendarEventOne", "calendarEventMany"));
  return parts.join(" • ");
}

export default function DayColumn({ day, weekdayLabel, isToday, holiday, grid, singleDay, allDayHeight, nowOffset, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  const { blocks } = day;
  const laidOutBlocks = useMemo(() => layoutOverlaps(blocks), [blocks]);
  const HolidayIcon = KIND_STYLE.holiday.icon;
  const monthLabel = day.date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const dayNumber = day.date.getDate();
  const summary = daySummary(blocks, t);

  return (
    <div className={cn("flex flex-col border-l border-[var(--cal-grid)] first:border-l-0", singleDay ? "min-w-0 flex-1" : "min-w-[150px] flex-1 sm:min-w-[168px]", isToday && "bg-[var(--cal-today-bg)]")}>
      <div
        style={{ height: HEADER_HEIGHT }}
        className="flex flex-col items-center justify-center border-b border-[var(--cal-grid)] px-2 [container-type:inline-size]"
        aria-current={isToday ? "date" : undefined}
      >
        <p className={cn("m-0 text-[13px] font-bold uppercase leading-none tracking-[0.06em]", isToday ? "text-primary" : "text-navy dark:text-card-foreground")}>{weekdayLabel}</p>

        <span
          className={cn(
            "mt-2 flex h-12 w-12 items-center justify-center rounded-full text-[22px] font-bold leading-none tabular-nums",
            isToday ? "bg-primary text-primary-foreground shadow-[0_6px_14px_-6px_rgba(37,99,235,.6)]" : "bg-tint-neutral text-navy dark:text-card-foreground"
          )}
        >
          {dayNumber}
        </span>

        <p className="m-0 mt-2 text-sm font-medium leading-none text-muted">
          {monthLabel}
          {isToday && <span className="sr-only"> — {t("calendarToday")}</span>}
        </p>

        {/* Fixed-height slot whether or not there's a pill, so every column's
            header bottoms out on the same line. */}
        <div className="mt-3 flex h-8 max-w-full items-center">
          {summary && (
            <span title={summary} className="flex max-w-full items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1.5 text-xs font-semibold leading-none text-primary [@container(min-width:13rem)]:gap-2 [@container(min-width:13rem)]:text-[13px]">
              <Users className="hidden h-4 w-4 shrink-0 [@container(min-width:11rem)]:block" aria-hidden="true" />
              <span className="truncate">{summary}</span>
            </span>
          )}
        </div>
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
