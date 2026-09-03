// ResultsToolbar.jsx -- the compact bar under a results list: result count
// on the left, sort control and view toggle on the right. Shared by the Job
// Openings, Candidate Matching and Referrals pages; each supplies its own
// sort options, which only ever cover fields the records actually carry.
//
// The view toggle defaults to List/Grid. Referrals passes its own `views`
// instead (Board/List) because a kanban board, not a card grid, is that
// page's second layout -- the toggle is about which layout, not about a
// fixed pair of layouts.
import { LayoutGrid, List } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { Card } from "./ui/card.jsx";

// main.css styles the bare `button` tag app-wide (min-height:52px, 20px
// padding, 2px border) since Tailwind's preflight is off, and
// `:where(button:hover)` adds a 1px lift -- both have to be cancelled here
// the same way ModuleNav.jsx does.
const TOGGLE_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal transform-none";

const DEFAULT_VIEWS = [
  { value: "list", icon: List, labelKey: "listViewLabel" },
  { value: "grid", icon: LayoutGrid, labelKey: "gridViewLabel" }
];

export default function ResultsToolbar({ id, total, sort, onSortChange, sortOptions, view, onViewChange, views }) {
  const t = useT();
  const selectId = (id || "results") + "-sort";
  const viewOptions = views || DEFAULT_VIEWS;

  return (
    <Card className="flex flex-col gap-3 px-5 py-4 shadow-card hover:shadow-card sm:flex-row sm:items-center sm:justify-between">
      <p className="m-0 text-sm text-muted">
        <span className="font-bold text-card-foreground">{total}</span> {total === 1 ? t("resultLabel") : t("resultsLabel")}
      </p>

      <div className="flex items-center gap-3">
        <label htmlFor={selectId} className="m-0 whitespace-nowrap text-sm font-medium text-muted">
          {t("sortByFieldLabel")}
        </label>
        <select
          id={selectId}
          value={sort}
          onChange={function (e) { onSortChange(e.target.value); }}
          className="h-10 min-h-0 rounded-[10px] border border-border bg-card py-0 pl-3 text-sm font-medium text-card-foreground focus:border-primary focus:outline-none focus:ring-2"
        >
          {sortOptions.map(function (o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
        </select>

        <div className="flex items-center gap-1 rounded-[10px] border border-border p-1">
          {viewOptions.map(function (o) {
            const Icon = o.icon;
            const label = t(o.labelKey);
            return (
              <button
                key={o.value}
                type="button"
                onClick={function () { onViewChange(o.value); }}
                aria-label={label}
                title={label}
                aria-pressed={view === o.value}
                className={cn(TOGGLE_RESET, "flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors",
                  view === o.value ? "bg-primary-tint text-primary" : "text-muted hover:bg-background")}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
