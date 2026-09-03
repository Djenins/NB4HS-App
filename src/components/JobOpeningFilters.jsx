// JobOpeningFilters.jsx -- the Job Openings page's search + filter panel:
// one white card holding the search row (search field + Clear all), the
// collapsible "Filters / Hide filters" header, and the two-column grid of
// JobOpeningFilterCard tiles (one column on phones).
//
// It owns no filter state of its own -- JobOpenings.jsx keeps every value
// and hands them down as a `filters` array of
// { key, icon, label, value, options, onChange } descriptors, so collapsing
// the panel can never drop a selection.
import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Search } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import JobOpeningFilterCard from "./JobOpeningFilterCard.jsx";
import { Button } from "./ui/button.jsx";
import { Card } from "./ui/card.jsx";

// Phones start with the grid collapsed so the results are reachable without
// scrolling past eight tiles; anything tablet-width and up starts open. Read
// once on mount, never on resize -- re-deciding mid-session would fight the
// user's own Hide/Show choice.
function initiallyOpen() {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(min-width: 768px)").matches;
}

export default function JobOpeningFilters({ search, onSearchChange, filters, activeCount, onClearAll }) {
  const t = useT();
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <Card className="p-5 shadow-card hover:shadow-card sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={function (e) { onSearchChange(e.target.value); }}
            placeholder={t("jobOpeningSearchPlaceholder")}
            aria-label={t("jobOpeningSearchPlaceholder")}
            className="h-[52px] min-h-0 w-full rounded-[12px] border border-border bg-card py-0 pl-12 pr-4 text-base text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2"
          />
        </div>
        <Button
          variant="secondary"
          onClick={onClearAll}
          className="h-[52px] shrink-0 gap-2 rounded-[12px] px-5 text-[15px]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("clearAllLabel")}
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <span className="text-[15px] font-bold text-card-foreground">
          {t("filtersLabel")}{activeCount ? " (" + activeCount + ")" : ""}
        </span>
        <Button
          variant="ghost"
          onClick={function () { setOpen(!open); }}
          aria-expanded={open}
          className="h-8 gap-1 px-1 text-sm font-semibold text-primary hover:bg-primary-tint"
        >
          {open ? t("hideFiltersLabel") : t("showFiltersLabel")}
          {open
            ? <ChevronUp className="h-4 w-4" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filters.map(function (f) {
            return (
              <JobOpeningFilterCard
                key={f.key}
                icon={f.icon}
                label={f.label}
                value={f.value}
                options={f.options}
                onChange={f.onChange}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
