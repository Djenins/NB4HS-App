// DayColumn.jsx -- one weekday's header + optional holiday banner + hour
// gridlines + absolutely positioned EventCards (side-by-side laid out via
// layoutOverlaps for same-time blocks like Level 1 & Level 2), or a
// centered "+ New Event" when nothing is scheduled that day.
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { GRID_HEIGHT, HOURS, layoutOverlaps } from "./calendarLayout.js";
import { TimeSlot } from "./TimeSlot.jsx";
import EventCard from "./EventCard.jsx";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function DayColumn({ day, weekdayLabel, isToday, holiday, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  const { blocks } = day;
  const laidOutBlocks = useMemo(() => layoutOverlaps(blocks), [blocks]);

  return (
    <div className={cn("flex min-w-0 flex-1 flex-col border-l border-border first:border-l-0", isToday && "bg-primary-tint/30")}>
      <div className={cn("sticky top-0 z-20 flex flex-col items-center gap-0.5 border-b border-border bg-card py-2", isToday && "bg-primary-tint/60")}>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-muted">{weekdayLabel}</p>
        <p className={cn("m-0 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold", isToday ? "bg-primary text-primary-foreground" : "text-card-foreground")}>
          {day.date.getDate()}
        </p>
      </div>

      <div className={cn("flex h-6 items-center border-b border-border px-1", holiday ? "bg-accent/10" : "bg-card")}>
        {holiday && <span className="truncate text-[10px] font-bold text-accent" title={holiday.name}>{holiday.name}</span>}
      </div>

      <div className="relative overflow-hidden" style={{ height: GRID_HEIGHT }}>
        {HOURS.map((h) => <TimeSlot key={h} isToday={isToday} onAdd={() => onAddEvent(day.dateStr)} />)}

        {blocks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddEvent(day.dateStr)}
            className={cn(BTN_RESET, "absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary")}
          >
            <Plus className="h-3.5 w-3.5" /> {t("calendarNewEvent")}
          </button>
        )}

        {laidOutBlocks.map((b) => (
          <EventCard key={b.key} block={b} t={t} onOpen={onOpen} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
