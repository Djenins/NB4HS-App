// DayColumn.jsx -- one weekday's header + hour gridlines + absolutely
// positioned EventCards, or a centered "+ New Event" when nothing is
// scheduled that day.
import { Plus } from "lucide-react";
import { GRID_HEIGHT, HOURS } from "./calendarLayout.js";
import { TimeSlot } from "./TimeSlot.jsx";
import EventCard from "./EventCard.jsx";
import { cn } from "../../lib/cn.js";

export default function DayColumn({ day, weekdayLabel, isToday, t, onOpen, onEdit, onDuplicate, onDelete, onAddEvent }) {
  const { blocks } = day;
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col border-l border-border first:border-l-0", isToday && "bg-primary-tint/30")}>
      <div className={cn("sticky top-0 z-20 flex flex-col items-center gap-0.5 border-b border-border bg-card py-2", isToday && "bg-primary-tint/60")}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{weekdayLabel}</p>
        <p className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold", isToday ? "bg-primary text-primary-foreground" : "text-card-foreground")}>
          {day.date.getDate()}
        </p>
      </div>

      <div className="relative" style={{ height: GRID_HEIGHT }}>
        {HOURS.map((h) => <TimeSlot key={h} isToday={isToday} onAdd={() => onAddEvent(day.dateStr)} />)}

        {blocks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddEvent(day.dateStr)}
            className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> {t("calendarNewEvent")}
          </button>
        )}

        {blocks.map((b) => (
          <EventCard key={b.key} block={b} t={t} onOpen={onOpen} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
