// StatCard.jsx -- ported from dashboard.js's statCard(). Numeric values now
// count up from their previous value instead of just appearing, a small
// "premium dashboard" touch; string values (e.g. fmtDuration()'s "5m 30s")
// are untouched since there's nothing numeric to animate between.
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";

function useCountUp(target) {
  const isNumeric = typeof target === "number" && isFinite(target);
  const [display, setDisplay] = useState(isNumeric ? 0 : target);
  const prevTarget = useRef(isNumeric ? 0 : target);

  useEffect(() => {
    if (!isNumeric) { setDisplay(target); return undefined; }
    const reduceMotion = typeof window !== "undefined" && window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = prevTarget.current;
    const to = target;
    if (reduceMotion || from === to) {
      setDisplay(to);
      prevTarget.current = to;
      return undefined;
    }
    const duration = 500;
    const start = performance.now();
    let raf;
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) { raf = requestAnimationFrame(tick); } else { prevTarget.current = to; }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, isNumeric]);

  return display;
}

export default function StatCard({ num, label, icon, variant }) {
  const display = useCountUp(num);
  return (
    <div className="stat-card">
      {icon && (
        <div className={"icon-badge" + (variant ? " " + variant : "")}>
          <Icon name={icon} />
        </div>
      )}
      <div>
        <div className="stat-num">{display}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
