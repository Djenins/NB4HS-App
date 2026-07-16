// CalendarToolbar.jsx -- search + filter chips (left/center) and the
// Week/Month/Day/Agenda view switch (right). Month/Day aren't built yet
// (only Week and Agenda have real data views), so they're wired to a
// "coming soon" toast instead of silently doing nothing.
import { CalendarRange, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import CalendarFilters from "./CalendarFilters.jsx";
import { cn } from "../../lib/cn.js";

const VIEWS = [
  { key: "week", label: "calendarWeekView", icon: LayoutGrid, enabled: true },
  { key: "month", label: "calendarMonthView", icon: CalendarRange, enabled: false },
  { key: "day", label: "calendarDayView", icon: SlidersHorizontal, enabled: false },
  { key: "list", label: "calendarAgendaView", icon: List, enabled: true }
];

export default function CalendarToolbar({ t, search, onSearchChange, filter, onFilterChange, view, onViewChange, onUnavailableView }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("calendarSearchPlaceholder")}
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <CalendarFilters t={t} filter={filter} onChange={onFilterChange} />
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          const active = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => (v.enabled ? onViewChange(v.key) : onUnavailableView())}
              className={cn(
                "flex min-h-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                active ? "bg-primary text-primary-foreground" : v.enabled ? "text-muted hover:text-card-foreground" : "text-muted/50"
              )}
            >
              <Icon className="h-3.5 w-3.5" />{t(v.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
