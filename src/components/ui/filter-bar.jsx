// filter-bar.jsx -- the filter panel at the head of a list page.
//
//   <FilterBar search={<SearchInput .../>} activeCount={n} onClear={...}
//              clearLabel filtersLabel>
//     <FilterField label="Service"><Select .../></FilterField>
//     ...
//   </FilterBar>
//
// Search sits on its own row; filters flow into a responsive grid underneath
// (1 column on phones, 2 at sm, up to 5 at xl). On phones the filter grid
// starts collapsed behind a "Filters (n)" toggle so the results stay in
// view; it opens automatically while any filter is active.
import { useId, useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { Button } from "./button.jsx";
import { Card } from "./card.jsx";

// `canClear` enables Clear when only the search text is set (activeCount
// counts the filters, which also decides whether the phone panel opens).
// `gridClassName` overrides the column counts for a page's own filter set.
export function FilterBar({ search, activeCount = 0, canClear, onClear, clearLabel, filtersLabel, gridClassName, children, className }) {
  const [openOnPhone, setOpenOnPhone] = useState(false);
  const panelId = useId();
  const expanded = openOnPhone || activeCount > 0;
  return (
    <Card className={cn("mb-6 p-4 sm:p-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">{search}</div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="flex-1 sm:hidden"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setOpenOnPhone((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {filtersLabel}{activeCount ? " (" + activeCount + ")" : ""}
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-fast", expanded && "rotate-180")} aria-hidden="true" />
          </Button>
          {onClear ? (
            <Button variant="ghost" className="shrink-0 px-3 text-muted" title={clearLabel} onClick={onClear} disabled={!(canClear != null ? canClear : activeCount)}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {/* Icon-only on phones, where the Filters toggle needs the row. */}
              <span className="sr-only sm:not-sr-only">{clearLabel}</span>
            </Button>
          ) : null}
        </div>
      </div>
      <div
        id={panelId}
        className={cn(
          "mt-4 grid-cols-1 gap-3 sm:grid",
          gridClassName || "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
          expanded ? "grid" : "hidden"
        )}
      >
        {children}
      </div>
    </Card>
  );
}

export function FilterField({ label, htmlFor, className, children }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-meta font-semibold text-muted">{label}</label>
      {children}
    </div>
  );
}
