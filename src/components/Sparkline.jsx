// Sparkline.jsx -- LEGACY zero-dependency SVG trend line, kept only as
// DashChart's `fallback` on Workforce Reports. DashChart shows the fallback
// only when there is nothing to plot, so in practice this renders the empty
// state. Dashboard and Reports no longer use it; KPI trend lines use
// components/ui/sparkline.jsx. Ported from reports_data.js's sparklineSVG().
import { EmptyState } from "./ui/empty-state.jsx";
import { useT } from "../context/AppContext.jsx";

export default function Sparkline({ labels, data }) {
  const t = useT();
  if (!data.length) return <EmptyState compact title={t("noReportDataMessage")} />;
  const w = Math.max(300, data.length * 26), h = 120, pad = 10;
  const max = Math.max.apply(null, data.concat([1]));
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - (v / max) * (h - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");

  return (
    <svg viewBox={"0 0 " + w + " " + h} className="block h-28 w-full" preserveAspectRatio="none">
      {/* style, not a stroke/fill attribute: presentation attributes don't
          reliably resolve var(), and these need to follow the theme -- the
          hardcoded hex stayed light-mode blue on a dark card. */}
      <polyline points={points} fill="none" style={{ stroke: "var(--primary)" }} strokeWidth="2" />
      {data.map((v, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (v / max) * (h - pad * 2);
        return (
          <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" style={{ fill: "var(--primary)" }}>
            <title>{labels[i]}: {v}</title>
          </circle>
        );
      })}
    </svg>
  );
}
