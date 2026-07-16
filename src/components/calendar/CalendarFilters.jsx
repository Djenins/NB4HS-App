// CalendarFilters.jsx -- category filter pill row.
import { FILTERS } from "./kindStyle.js";
import { cn } from "../../lib/cn.js";

export default function CalendarFilters({ t, filter, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => {
        const active = filter === f.key;
        const dotClass = f.style?.dot;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={cn(
              "flex min-h-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? f.key === "all" ? "border-primary bg-primary text-primary-foreground" : cn("border-transparent", f.style.chipBg, f.style.chipFg)
                : "border-border bg-background text-muted hover:text-card-foreground"
            )}
          >
            {dotClass && <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
            {t(f.label)}
          </button>
        );
      })}
    </div>
  );
}
