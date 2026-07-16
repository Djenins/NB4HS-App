// WeekView.jsx -- the continuous Sun-Sat weekly grid: a time gutter (8 AM-
// 6 PM) plus seven DayColumns sharing the same hour rows, so events across
// days line up at a glance the way Google/Outlook calendars do.
import { fmtHour, HOURS } from "./calendarLayout.js";
import { TimeGutterLabel } from "./TimeSlot.jsx";
import DayColumn from "./DayColumn.jsx";

export default function WeekView({ dayBlocks, weekdayLabels, todayStr, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex">
        <div className="w-14 shrink-0 border-r border-border">
          <div className="h-[52px] border-b border-border" />
          {HOURS.map((h) => <TimeGutterLabel key={h} label={fmtHour(h)} />)}
        </div>
        <div className="flex flex-1 overflow-x-auto">
          {dayBlocks.map((day, i) => (
            <DayColumn
              key={day.dateStr}
              day={day}
              weekdayLabel={weekdayLabels[i]}
              isToday={day.dateStr === todayStr}
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
