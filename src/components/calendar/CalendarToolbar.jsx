// CalendarToolbar.jsx -- the secondary control row beneath CalendarHeader:
// search and the calendar-settings control on the left, the event-type
// filter chips on the right. The Week/Month/Day/Agenda switcher used to
// live here too; it moved up into CalendarHeader alongside Today, where the
// reference composition puts it, leaving this row as the "narrow what's on
// the grid" surface and the row above it as "which range am I looking at".
//
// It stays a plain row rather than a card so the calendar below it is the
// only heavy surface on the page.
import { Search, SlidersHorizontal } from "lucide-react";
import CalendarFilters from "./CalendarFilters.jsx";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function CalendarToolbar({ t, search, onSearchChange, filter, onFilterChange, onOpenSettings }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:w-[300px] sm:flex-none">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("calendarSearchPlaceholder")}
            aria-label={t("calendarSearchPlaceholder")}
            className="h-[42px] w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-card-foreground shadow-card placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={t("calendarSettings")}
          title={t("calendarSettings")}
          className={cn(BTN_RESET, "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted shadow-card transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")}
        >
          <SlidersHorizontal className="h-[17px] w-[17px]" />
        </button>
      </div>

      <CalendarFilters t={t} filter={filter} onChange={onFilterChange} />
    </div>
  );
}
