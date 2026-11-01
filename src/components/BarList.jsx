// BarList.jsx -- a ranked list of horizontal bars, in the inset-list style of
// Apple's Screen Time breakdowns: label, a capsule bar and the value on one
// row (the bar drops under the label on phones), no dividers, and bars that
// grow in once on first paint. Used for ranked categories (services, staff,
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
    <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={label || undefined}>
      {items.map((i, idx) => {
        const count = Number(i.count) || 0;
        // A non-zero value always shows a sliver of bar.
        const pct = count > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0;
        return (
          // One row: label, bar, value from sm; on phones the bar drops
          // under the label so long translated labels keep their width.
          <li key={idx} className="m-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2.5rem]">
            <span className="min-w-0 break-words text-body text-card-foreground">{i.label}</span>
            <span className="row-start-2 col-span-2 block h-2 w-full overflow-hidden rounded-chip bg-surface-sunken sm:col-span-1 sm:col-start-2 sm:row-start-1" aria-hidden="true">
              {/* width is the data value, so it stays inline */}
              <span className={cn("bar-list-fill block h-full rounded-chip", FILL[tone] || FILL.info)} style={{ width: pct + "%" }} />
            </span>
            <span className="col-start-2 row-start-1 text-right text-body font-semibold tabular-nums text-card-foreground sm:col-start-3">{i.count}</span>
          </li>
        );
      })}
    </ul>
  );
}
