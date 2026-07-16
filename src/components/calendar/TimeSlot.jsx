// TimeSlot.jsx -- one hour-tall gridline row inside a DayColumn, and the
// matching hour label inside the leading time gutter.
import { HOUR_HEIGHT } from "./calendarLayout.js";
import { cn } from "../../lib/cn.js";

export function TimeGutterLabel({ label }) {
  return (
    <div style={{ height: HOUR_HEIGHT }} className="relative border-t border-border pr-2 text-right">
      <span className="absolute -top-2 right-2 text-[11px] font-medium text-muted">{label}</span>
    </div>
  );
}

export function TimeSlot({ isToday, onAdd }) {
  return (
    <div
      style={{ height: HOUR_HEIGHT }}
      className={cn("group/slot border-t border-border", isToday && "bg-primary/[0.04]")}
      onDoubleClick={onAdd}
    />
  );
}
