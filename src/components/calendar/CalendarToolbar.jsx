// CalendarToolbar.jsx -- the secondary control row beneath CalendarHeader:
// search and the calendar-settings control on the left, the event-type
// filter chips on the right. The Week/Month/Day/Agenda switcher used to
// live here too; it moved up into CalendarHeader alongside Today, where the
// reference composition puts it, leaving this row as the "narrow what's on
// the grid" surface and the row above it as "which range am I looking at".
//
// It stays a plain row rather than a card so the calendar below it is the
// only heavy surface on the page.
import { SlidersHorizontal } from "lucide-react";
import { IconButton } from "../ui/icon-button.jsx";
import { SearchInput } from "../ui/search-input.jsx";
import CalendarFilters from "./CalendarFilters.jsx";

export default function CalendarToolbar({ t, search, onSearchChange, filter, onFilterChange, onOpenSettings }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange("")}
          clearLabel={t("clearLabel")}
          placeholder={t("calendarSearchPlaceholder")}
          aria-label={t("calendarSearchPlaceholder")}
          className="min-w-0 flex-1 sm:w-[300px] sm:flex-none"
        />
        <IconButton label={t("calendarSettings")} variant="secondary" size="lg" onClick={onOpenSettings}>
          <SlidersHorizontal aria-hidden="true" />
        </IconButton>
      </div>

      <CalendarFilters t={t} filter={filter} onChange={onFilterChange} />
    </div>
  );
}
