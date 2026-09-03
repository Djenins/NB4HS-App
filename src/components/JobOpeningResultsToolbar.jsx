// JobOpeningResultsToolbar.jsx -- the compact bar under the Job Openings
// results: result count on the left, sort control and List/Grid toggle on
// the right. Sort options only cover fields every job opening actually
// carries (posted date, title, employer name).
import { LayoutGrid, List } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { Card } from "./ui/card.jsx";

// main.css styles the bare `button` tag app-wide (min-height:52px, 20px
// padding, 2px border) since Tailwind's preflight is off, and
// `:where(button:hover)` adds a 1px lift -- both have to be cancelled here
// the same way ModuleNav.jsx does.
const TOGGLE_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal transform-none";

export default function JobOpeningResultsToolbar({ total, sort, onSortChange, sortOptions, view, onViewChange }) {
  const t = useT();

  return (
    <Card className="flex flex-col gap-3 px-5 py-4 shadow-card hover:shadow-card sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-sm text-muted">
        <span className="font-bold text-card-foreground">{total}</span> {total === 1 ? t("resultLabel") : t("resultsLabel")}
      </p>

      <div className="flex items-center gap-3">
        <label htmlFor="job-openings-sort" className="m-0 whitespace-nowrap text-sm font-medium text-muted">
          {t("sortByFieldLabel")}
        </label>
        <select
          id="job-openings-sort"
          value={sort}
          onChange={function (e) { onSortChange(e.target.value); }}
          className="h-10 min-h-0 rounded-[10px] border border-border bg-card py-0 pl-3 text-sm font-medium text-card-foreground focus:border-primary focus:outline-none focus:ring-2"
        >
          {sortOptions.map(function (o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
        </select>

        <div className="flex items-center gap-1 rounded-[10px] border border-border p-1">
          <button
            type="button"
            onClick={function () { onViewChange("list"); }}
            aria-label={t("listViewLabel")}
            title={t("listViewLabel")}
            aria-pressed={view === "list"}
            className={cn(TOGGLE_RESET, "flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors",
              view === "list" ? "bg-primary-tint text-primary" : "text-muted hover:bg-background")}
          >
            <List className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={function () { onViewChange("grid"); }}
            aria-label={t("gridViewLabel")}
            title={t("gridViewLabel")}
            aria-pressed={view === "grid"}
            className={cn(TOGGLE_RESET, "flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors",
              view === "grid" ? "bg-primary-tint text-primary" : "text-muted hover:bg-background")}
          >
            <LayoutGrid className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </Card>
  );
}
