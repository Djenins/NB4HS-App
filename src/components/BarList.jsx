// BarList.jsx -- a ranked list of horizontal bars: label and value on one
// line, a thin bar underneath. Used for ranked categories (services, staff,
// cities, grants, SNAP breakdowns) where a column chart would have to drop or
// truncate long, translated labels. Every value is printed beside its bar, so
// nothing hides behind a tooltip.
//
//   <BarList items={[{ label, count }]} />
// Optional (added with the design-system migration):
//   empty  node rendered instead of the default empty state when there are
//          no items (pass a page-specific <EmptyState>)
//   tone   bar colour: info (default), success, warning, violet, neutral
//   label  accessible name for the list
import { useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { EmptyState } from "./ui/empty-state.jsx";

// Bar fills come from the tone tokens; warning uses its ink step because the
// solid gold is under 3:1 on a card.
const FILL = {
  info: "bg-tone-info-solid",
  success: "bg-tone-success-solid",
  warning: "bg-tone-warning-ink",
  violet: "bg-tone-violet-solid",
  neutral: "bg-tone-neutral-solid"
};

export default function BarList({ items, empty, tone = "info", label }) {
  const t = useT();
  if (!items || !items.length) return empty || <EmptyState compact title={t("noReportDataMessage")} />;
  const max = items.reduce((m, i) => Math.max(m, Number(i.count) || 0), 0) || 1;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={label || undefined}>
      {items.map((i, idx) => {
        const count = Number(i.count) || 0;
        // A non-zero value always shows a sliver of bar.
        const pct = count > 0 ? Math.max(1, Math.round((count / max) * 100)) : 0;
        return (
          <li key={idx} className="m-0">
            <div className="flex items-baseline justify-between gap-3 text-ui">
              <span className="min-w-0 break-words text-card-foreground">{i.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-card-foreground">{i.count}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-chip bg-surface-sunken" aria-hidden="true">
              {/* width is the data value, so it stays inline */}
              <div className={cn("h-full rounded-chip", FILL[tone] || FILL.info)} style={{ width: pct + "%" }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
