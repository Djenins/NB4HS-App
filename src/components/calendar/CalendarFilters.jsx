// CalendarFilters.jsx -- event-type filter pills. One filter is active at a
// time (that's the semantics Calendar.jsx's `filter` state has always had --
// "all" plus the four kinds), each carrying its semantic color dot so the
// row doubles as a reminder of what each color means in the grid. Drawn by
// the shared FilterChips, with each kind's tone for its dot.
import { FILTERS } from "./kindStyle.js";
import { FilterChips } from "../ui/filter-chips.jsx";

export default function CalendarFilters({ t, filter, onChange }) {
  return (
    <FilterChips
      label={t("calendarFilterLabel")}
      value={filter}
      onChange={onChange}
      options={FILTERS.map((f) => ({ value: f.key, label: t(f.label), tone: f.style ? f.style.tone : undefined }))}
    />
  );
}
