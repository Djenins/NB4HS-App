// CalendarToolbar.jsx -- the one control surface above the grid: search and
// the calendar-settings control on the left, the Week/Month/Day/Agenda
// segmented switch on the right, and the event-type filter chips beneath.
// Day view reuses WeekView with a single day column; Month view has its own
// MonthView grid -- see Calendar.jsx for how `view` drives which renders.
import { CalendarDays, CalendarRange, List, Search, SlidersHorizontal, Sun } from "lucide-react";
import CalendarFilters from "./CalendarFilters.jsx";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

const VIEWS = [
  { key: "week", label: "calendarWeekView", icon: CalendarRange },
  { key: "month", label: "calendarMonthView", icon: CalendarDays },
  { key: "day", label: "calendarDayView", icon: Sun },
  { key: "list", label: "calendarAgendaView", icon: List }
];

export default function CalendarToolbar({ t, search, onSearchChange, filter, onFilterChange, view, onViewChange, onOpenSettings }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-[320px] sm:flex-none">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("calendarSearchPlaceholder")}
              aria-label={t("calendarSearchPlaceholder")}
              className="h-[50px] w-full rounded-xl border border-border bg-background pl-11 pr-3 text-sm text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t("calendarSettings")}
            title={t("calendarSettings")}
            className={cn(BTN_RESET, "flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label={t("calendarView")}
          className="flex items-center gap-1 self-start overflow-x-auto rounded-xl border border-border bg-background p-1 xl:self-auto"
        >
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const active = view === v.key;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={t(v.label)}
                title={t(v.label)}
                onClick={() => onViewChange(v.key)}
                className={cn(
                  BTN_RESET,
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4",
                  active
                    ? "bg-primary-tint font-bold text-primary"
                    : "font-semibold text-muted hover:text-card-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t(v.label)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <CalendarFilters t={t} filter={filter} onChange={onFilterChange} />
    </div>
  );
}
