// WeekView.jsx -- the shared time grid: a left gutter (All Day cell + hour
// labels) beside one DayColumn per visible day, all driven by the same
// `grid` object from buildTimeGrid() so labels, gridlines and event cards
// line up to the minute. Day view renders the exact same component with a
// one-day `dayBlocks` array and a taller hour, since the grid is identical.
//
// Row heights (header / all-day) are shared constants rather than each
// column measuring itself: the gutter has to agree with every day column or
// the whole grid shears by a pixel or two.
import { ALLDAY_HEIGHT, fmtHour, HEADER_HEIGHT, minuteOffset } from "./calendarLayout.js";
import DayColumn from "./DayColumn.jsx";
import { cn } from "../../lib/cn.js";

export default function WeekView({ dayBlocks, weekdayLabels, todayStr, holidaysByDate, grid, nowMinutes, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  const singleDay = dayBlocks.length === 1;
  const nowOffset = nowMinutes === null || nowMinutes === undefined ? null : minuteOffset(grid, nowMinutes);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex">
        <div className="w-[62px] shrink-0 border-r border-border sm:w-[74px]">
          <div style={{ height: HEADER_HEIGHT }} className="border-b border-border" />
          <div
            style={{ height: ALLDAY_HEIGHT }}
            className="flex items-center justify-end border-b border-border pr-2 text-[11px] font-bold uppercase tracking-wide text-primary sm:pr-3"
          >
            {t("calendarAllDay")}
          </div>
          <div className="relative" style={{ height: grid.height }}>
            {grid.hours.map((h, i) => (
              <span
                key={h}
                style={{ top: i * grid.hourHeight }}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-muted sm:right-3"
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
