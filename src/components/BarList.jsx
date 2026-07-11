// BarList.jsx -- the zero-dependency CSS bar chart used both as the Dashboard's
// permanent "today's class check-ins" widget and as the fallback markup
// DashChart shows before Chart.js has drawn its version. Ported from
// dashboard.js's barList().
import { useT } from "../context/AppContext.jsx";
import EmptyState from "./EmptyState.jsx";

export default function BarList({ items }) {
  const t = useT();
  if (!items.length) return <EmptyState icon="inbox" message={t("noResults")} />;
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1;
  return (
    <>
      {items.map((i, idx) => {
        const pct = Math.round((i.count / max) * 100);
        return (
          <div className="bar-row" key={idx}>
            <div className="bar-label">{i.label}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: pct + "%" }}>{i.count}</div>
            </div>
          </div>
        );
      })}
    </>
  );
}
