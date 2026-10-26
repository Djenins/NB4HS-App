// ResultsToolbar.jsx -- the bar that sits ABOVE a results list: the result
// count on the left, sort and the view toggle on the right. A toolbar for
// the list, so it's a plain row on the page surface, not a card. Shared by
// the Workforce list pages; each supplies its own sort options, which only
// ever cover fields the records actually carry.
//
// The view toggle defaults to List/Grid. Referrals passes its own `views`
// (Board/List) because a kanban board, not a card grid, is that page's
// second layout -- the toggle is about which layout, not a fixed pair.
import { LayoutGrid, List } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { Select } from "./ui/field.jsx";
import { SegmentedControl } from "./ui/segmented-control.jsx";

const DEFAULT_VIEWS = [
  { value: "list", icon: List, labelKey: "listViewLabel" },
  { value: "grid", icon: LayoutGrid, labelKey: "gridViewLabel" }
];

export default function ResultsToolbar({ id, total, sort, onSortChange, sortOptions, view, onViewChange, views, className }) {
  const t = useT();
  const selectId = (id || "results") + "-sort";
  const viewOptions = (views || DEFAULT_VIEWS).map(function (o) {
    return { value: o.value, icon: o.icon, label: t(o.labelKey), iconOnly: true };
  });

  return (
    <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <p className="m-0 text-ui tabular-nums text-muted" aria-live="polite">
        <span className="font-semibold text-card-foreground">{total}</span> {total === 1 ? t("resultLabel") : t("resultsLabel")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="m-0 whitespace-nowrap text-meta font-semibold text-muted">{t("sortByFieldLabel")}</label>
          <Select id={selectId} value={sort} onChange={function (e) { onSortChange(e.target.value); }} className="w-auto min-w-[10rem]">
            {sortOptions.map(function (o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
          </Select>
        </div>
        {onViewChange ? <SegmentedControl label={t("resultsLayoutLabel")} value={view} onChange={onViewChange} options={viewOptions} /> : null}
      </div>
    </div>
  );
}
