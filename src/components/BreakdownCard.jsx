// BreakdownCard.jsx -- a whole split into its parts ("How we met": new
// contacts by source), laid out as a small report: title and subtitle with a
// count of the parts, the total large with a one-line reading of it, then a
// table of each part's share and count, and a footer that restates the sum.
//
// Only for complete breakdowns, where the rows add up to the total shown.
// A top-N list (top cities, top services) leaves rows out, so a "share" would
// mislead -- those stay on BarList.
//
//   <BreakdownCard title description items={[{ label, count }]}
//     columnLabel countLabel unit={{ one, many }} group={{ one, many }} loading />
import { useApp, useT } from "../context/AppContext.jsx";
import { cn } from "../lib/cn.js";
import { Badge } from "./ui/badge.jsx";
import { Card } from "./ui/card.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { Skeleton } from "./ui/skeleton.jsx";

const LOCALE = { en: "en-US", ht: "en-US", fr: "fr-FR" };

export function BreakdownCard({ title, description, items, columnLabel, countLabel, unit, group, loading, className }) {
  const { lang } = useApp();
  const t = useT();
  const rows = (items || []).map((i) => ({ label: i.label, count: Number(i.count) || 0 }));
  const total = rows.reduce((s, r) => s + r.count, 0);
  const pctOf = (n) => (total ? (n / total) * 100 : 0);
  const fmtPct = (p) => p.toLocaleString(LOCALE[lang] || "en-US", { maximumFractionDigits: 1 }) + "%";
  const groups = rows.length === 1 ? group.one : group.many;
  const units = total === 1 ? unit.one : unit.many;

  // One plain sentence about the split. Ties for the top are "evenly spread"
  // only when every part is equal; otherwise the largest part is named.
  let reading = "";
  if (rows.length === 1) reading = t("breakdownAllFrom").replace("{label}", rows[0].label);
  else if (rows.length > 1) {
    const top = rows.reduce((a, b) => (b.count > a.count ? b : a));
    reading = rows.every((r) => r.count === top.count)
      ? t("breakdownEven").replace("{groups}", group.many)
      : t("breakdownTop").replace("{label}", top.label).replace("{pct}", fmtPct(pctOf(top.count)));
  }

  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 text-heading font-bold text-card-foreground">{title}</h2>
          {description ? <p className="m-0 mt-0.5 text-body text-muted">{description}</p> : null}
        </div>
        {!loading && rows.length ? <Badge variant="info" className="shrink-0 px-2.5 py-1 text-meta tabular-nums">{rows.length} {groups}</Badge> : null}
      </div>

      {loading ? (
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-12 w-40" />
          {["w-full", "w-4/5", "w-3/5"].map((w) => <Skeleton key={w} className={cn("h-6", w)} />)}
        </div>
      ) : !rows.length ? (
        <div className="mt-4"><EmptyState compact title={t("noReportDataMessage")} /></div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-4 border-b border-line-subtle pb-5">
            <span className="text-[3rem] font-bold leading-none tabular-nums text-card-foreground">{total}</span>
            <div className="min-w-0">
              <p className="m-0 text-section font-semibold text-card-foreground">{units}</p>
              <p className="m-0 mt-0.5 text-ui text-muted">{reading}</p>
            </div>
          </div>

          <table className="mt-1 w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line-subtle">
                <th scope="col" className="py-3 pr-3 text-meta font-medium text-muted">{columnLabel}</th>
                <th scope="col" className="w-[42%] py-3 pr-3 text-meta font-medium text-muted">{t("breakdownShare")}</th>
                <th scope="col" className="py-3 text-right text-meta font-medium text-muted">{countLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const p = pctOf(r.count);
                return (
                  <tr key={idx} className="border-b border-line-subtle">
                    <th scope="row" className="py-3 pr-3 text-body font-normal text-card-foreground">{r.label}</th>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <span className="block h-2 min-w-0 flex-1 overflow-hidden rounded-chip bg-surface-sunken" aria-hidden="true">
                          {/* width is the data value, so it stays inline */}
                          <span className="bar-list-fill block h-full rounded-chip bg-tone-info-solid" style={{ width: (r.count ? Math.max(2, p) : 0) + "%" }} />
                        </span>
                        <span className="w-12 shrink-0 text-meta tabular-nums text-muted">{fmtPct(p)}</span>
                      </div>
                    </td>
                    <td className="py-3 text-right text-body font-semibold tabular-nums text-card-foreground">{r.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="m-0 mt-4 text-meta text-muted">
            {t("breakdownFooter").replace("{total}", total).replace("{units}", units).replace("{n}", rows.length).replace("{groups}", groups)}
          </p>
        </>
      )}
    </Card>
  );
}
