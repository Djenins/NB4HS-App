// CalendarFilters.jsx -- event-type filter pills. One filter is active at a
// time (that's the semantics Calendar.jsx's `filter` state has always had --
// "all" plus the four kinds), each carrying its semantic color dot so the
// row doubles as a reminder of what each color means in the grid.
import { FILTERS } from "./kindStyle.js";
import { BTN_RESET } from "./btnReset.js";
import { cn } from "../../lib/cn.js";

export default function CalendarFilters({ t, filter, onChange }) {
  return (
    <div
      role="group"
      aria-label={t("calendarFilterLabel")}
      className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5"
    >
      {FILTERS.map((f) => {
        const active = filter === f.key;
        return (
          <button
            key={f.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f.key)}
            className={cn(
              BTN_RESET,
              "flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-card-foreground hover:border-primary hover:text-primary"
            )}
          >
            {f.style && (
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  active ? "bg-primary-foreground" : f.style.dot
                )}
              />
            )}
            {t(f.label)}
          </button>
        );
      })}
    </div>
  );
}
