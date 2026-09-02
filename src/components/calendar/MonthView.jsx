// MonthView.jsx -- 6-work-week month grid (Mon-Fri only; NB4HS is closed
// Sat/Sun -- see workMonthGridDays() in lib/calendar.js). Each cell shows the
// date, an optional holiday chip, and up to 3 event chips ("+N more" beyond
// that, matching the week grid's own overflow behavior). Reuses the same
// `dayBlocks` shape WeekView/Calendar.jsx already produce, just chunked into
// rows of 5.
import { Plus } from "lucide-react";
import { fmtTime } from "./calendarLayout.js";
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
  const HolidayIcon = KIND_STYLE.holiday.icon;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-5 border-b border-border">
        {weekdayLabels.map((label) => (
          <div key={label} className="border-l border-border py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted first:border-l-0">
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
                  "group/cell flex min-h-[120px] flex-col gap-1 border-l border-t border-border p-2 first:border-l-0 lg:min-h-[132px]",
                  !inMonth && "bg-background",
                  isToday && "bg-primary-tint"
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onSelectDay(dateStr)}
                    aria-label={date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    className={cn(
                      BTN_RESET,
                      "flex h-7 min-w-[28px] items-center justify-center rounded-full px-1 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-card-foreground hover:bg-primary-tint hover:text-primary" : "text-muted opacity-60"
                    )}
                  >
                    {date.getDate()}
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddEvent(dateStr)}
                    aria-label={t("calendarNewEvent")}
                    className={cn(BTN_RESET, "rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-primary-tint hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group-hover/cell:opacity-100")}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {holiday && (
                  <p
                    className={cn(
                      "m-0 flex items-center gap-1 truncate rounded-md border border-l-[3px] px-1.5 py-1 text-[11px] font-bold leading-none",
                      KIND_STYLE.holiday.cardBg, KIND_STYLE.holiday.cardBorder, KIND_STYLE.holiday.accent, KIND_STYLE.holiday.chipFg
                    )}
                    title={holiday.name}
                  >
                    <HolidayIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{holiday.name}</span>
                  </p>
                )}

                <div className="flex flex-col gap-1">
                  {visible.map((b) => {
                    const style = KIND_STYLE[b.kind];
                    const Icon = style.icon;
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => onOpenEvent(b)}
                        title={t(style.label) + " · " + b.title + " · " + fmtTime(b.startTime)}
                        className={cn(
                          BTN_RESET,
                          "flex w-full items-center gap-1.5 rounded-md border border-l-[3px] px-1.5 py-1 text-left text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          style.cardBg, style.cardBorder, style.accent, style.chipFg, style.hover
                        )}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate leading-none">{b.title}</span>
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => onSelectDay(dateStr)}
                      className={cn(BTN_RESET, "px-1.5 text-left text-[11px] font-semibold text-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
                    >
                      +{overflow} {t("calendarMore")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
