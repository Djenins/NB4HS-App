// Legend.jsx -- bottom color legend, one entry per real event kind.
import { KIND_STYLE } from "./kindStyle.js";
import { cn } from "../../lib/cn.js";

export default function Legend({ t }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-4 py-3">
      <span className="text-xs font-bold text-card-foreground">{t("calendarLegendTitle")}</span>
      {Object.entries(KIND_STYLE).map(([key, style]) => (
        <span key={key} className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className={cn("h-2.5 w-2.5 rounded-full", style.dot)} />
          {t(style.label)}
        </span>
      ))}
    </div>
  );
}
