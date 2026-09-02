// WeekView.jsx -- the shared time grid: a left gutter ("Time" header, the
// All Day cell, and the hour labels) beside one DayColumn per visible day,
// all driven by the same `grid` object from buildTimeGrid() so labels,
// gridlines and event cards line up to the minute. Day view renders the
// exact same component with a one-day `dayBlocks` array and a taller hour,
// since the grid is identical.
//
// Row heights (header / all-day) are shared constants rather than each
// column measuring itself: the gutter has to agree with every day column or
// the whole grid shears by a pixel or two. The All Day row is the one
// exception -- it collapses to zero height on a range with no holiday in
// it, so an ordinary week doesn't carry a permanently empty strip. Its
// height is resolved here, once, and handed to both sides.
//
// On a single-day view the grid also accepts a horizontal swipe as
// prev/next, since that's the view a phone opens on.
import { Clock } from "lucide-react";
import { useRef } from "react";
import { ALLDAY_HEIGHT, fmtHour, HEADER_HEIGHT, minuteOffset } from "./calendarLayout.js";
import DayColumn from "./DayColumn.jsx";
import { cn } from "../../lib/cn.js";

// Far enough that a vertical scroll that wanders sideways doesn't change
// the day, short enough to feel like a flick rather than a drag.
const SWIPE_MIN_X = 56;

export default function WeekView({ dayBlocks, weekdayLabels, todayStr, holidaysByDate, grid, nowMinutes, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent, onPrev, onNext }) {
  const singleDay = dayBlocks.length === 1;
  const nowOffset = nowMinutes === null || nowMinutes === undefined ? null : minuteOffset(grid, nowMinutes);
  const allDayHeight = dayBlocks.some((d) => holidaysByDate[d.dateStr]) ? ALLDAY_HEIGHT : 0;
  const touchStart = useRef(null);

  function handleTouchStart(e) {
    if (!singleDay || !onPrev || !onNext) return;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function handleTouchEnd(e) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    // Only a clearly horizontal flick counts, so scrolling the grid
    // vertically never skips a day out from under the user.
    if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dx) < Math.abs(touch.clientY - start.y)) return;
    if (dx < 0) onNext(); else onPrev();
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex">
        <div className="w-[78px] shrink-0 border-r border-[var(--cal-grid)] sm:w-[112px]">
          <div
            style={{ height: HEADER_HEIGHT }}
            className="flex items-center gap-1.5 border-b border-[var(--cal-grid)] pl-3 sm:pl-4"
          >
            <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-card-foreground">{t("calendarTimeColumn")}</span>
          </div>

          {allDayHeight > 0 && (
            <div
              style={{ height: allDayHeight }}
              className="flex items-center border-b border-[var(--cal-grid)] pl-3 text-[11px] font-bold uppercase tracking-wide text-primary sm:pl-4"
            >
              {t("calendarAllDay")}
            </div>
          )}

          {/* Labels are centred on their own hour rule (-translate-y-1/2),
              which is why the last hour's row still has to exist below the
              final label -- grid.height covers the full window. */}
          <div className="relative" style={{ height: grid.height }}>
            {grid.hours.map((h, i) => (
              <span
                key={h}
                style={{ top: i * grid.hourHeight }}
                className="absolute left-3 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium text-card-foreground sm:left-4 sm:text-[15px]"
              >
                {fmtHour(h)}
              </span>
            ))}
          </div>
        </div>

        <div className={cn("flex flex-1", !singleDay && "overflow-x-auto")}>
          {dayBlocks.map((day, i) => (
            <DayColumn
              key={day.dateStr}
              day={day}
              weekdayLabel={weekdayLabels[i]}
              isToday={day.dateStr === todayStr}
              holiday={holidaysByDate[day.dateStr]}
              grid={grid}
              singleDay={singleDay}
              allDayHeight={allDayHeight}
              nowOffset={nowOffset}
              t={t}
              onOpen={onOpen}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onAddEvent={onAddEvent}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
