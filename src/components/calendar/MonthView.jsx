// MonthView.jsx -- 6-work-week month grid (Mon-Fri only; NB4HS is closed
// Sat/Sun -- see workMonthGridDays() in lib/calendar.js). Each cell shows
// the date, an optional holiday banner, and up to 3 event chips ("+N more"
// beyond that). Reuses the same `dayBlocks` shape WeekView/Calendar.jsx
// already produce (one entry per visible day), just chunked into rows of 5.
import { Plus } from "lucide-react";
import { KIND_STYLE } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

const MAX_VISIBLE = 3;
const COLS = 5;

export default function MonthView({ dayBlocks, monthAnchor, todayStr, holidaysByDate, t, onSelectDay, onOpenEvent, onAddEvent }) {
  const weeks = [];
  for (let i = 0; i < dayBlocks.length; i += COLS) weeks.push(dayBlocks.slice(i, i + COLS));
  const currentMonth = monthAnchor.getMonth();
  const weekdayLabels = dayBlocks.slice(0, COLS).map((d) => d.date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase());

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-5 border-b border-border">
        {weekdayLabels.map((label) => (
          <div key={label} className="border-l border-border py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted first:border-l-0">
            {label}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-5">
          {week.map(({ date, dateStr, blocks }) => {
            const inMonth = date.getMonth() === currentMonth;
            const isToday = dateStr === todayStr;
            const holiday = holidaysByDate[dateStr];
            const visible = blocks.slice(0, MAX_VISIBLE);
            const overflow = blocks.length - visible.length;

            return (
              <div
                key={dateStr}
                className={cn(
                  "group/cell flex min-h-[112px] flex-col gap-1 border-l border-t border-border p-1.5 first:border-l-0",
                  !inMonth && "bg-background/60",
                  isToday && "bg-primary-tint/30"
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectDay(dateStr)}
                    className={cn(
                      BTN_RESET,
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-card-foreground hover:bg-background" : "text-muted/50"
                    )}
                  >
                    {date.getDate()}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddEvent(dateStr)}
                    aria-label={t("calendarNewEvent")}
                    className={cn(BTN_RESET, "rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-primary group-hover/cell:opacity-100")}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>

                {holiday && (
                  <p className="truncate rounded bg-accent/10 px-1 py-0.5 text-[10px] font-semibold text-accent" title={holiday.name}>
                    {holiday.name}
                  </p>
                )}

                <div className="flex flex-col gap-0.5">
                  {visible.map((b) => {
                    const style = KIND_STYLE[b.kind];
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => onOpenEvent(b)}
                        className={cn(BTN_RESET, "flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-semibold", style.chipBg, style.chipFg)}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
                        <span className="truncate leading-none">{b.title}</span>
                      </button>
                    );
                  })}
                  {overflow > 0 && <p className="px-1 text-[10px] font-semibold text-muted">+{overflow} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
