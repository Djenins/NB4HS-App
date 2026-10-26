// trend-delta.jsx -- "+12% vs previous period" for a KpiCard's hint line,
// fed by reports_data.js trendPct() ({ pct, none }). One component for every
// report page (Reports, Workforce Reports) instead of a local copy each.
//
// Direction is carried by the arrow and the sign, never colour alone. A
// rise reads success; a fall reads neutral -- fewer visits this week is
// worth noticing, not an error -- and `goodWhenUp={null}` keeps both neutral
// for a measure that's neither (average visit length). On phones the words
// "vs previous period" stay available to screen readers but drop visually,
// and "no change" uses its short form, so two cards still fit side by side.
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "../../lib/cn.js";

export function TrendDelta({ trend, goodWhenUp = true, t }) {
  if (!trend || trend.none) {
    return (
      <span className="inline-flex items-center gap-1 text-meta text-muted">
        <Minus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="sm:hidden">{t("noChangeShort")}</span>
        <span className="hidden sm:inline">{t("noChangeVsPreviousPeriod")}</span>
      </span>
    );
  }
  const { pct } = trend;
  const Icon = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : Minus;
  const tone = goodWhenUp !== null && pct > 0 === goodWhenUp && pct !== 0 ? "text-tone-success-ink" : "text-tone-neutral-ink";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-meta">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", tone)}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {pct > 0 ? "+" : pct < 0 ? "−" : ""}{Math.abs(pct)}%
      </span>
      <span className="sr-only text-muted sm:not-sr-only">{t("vsPreviousPeriod")}</span>
    </span>
  );
}
