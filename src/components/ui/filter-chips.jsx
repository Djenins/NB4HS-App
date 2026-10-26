// filter-chips.jsx -- a row of quick filters (All / Classes / Visits...),
// lifted from the calendar. Single-select by default; `multiple` lets
// several stay on. Optional tone dot per chip; the row scrolls sideways on
// phones instead of wrapping into a wall of chips.
//
//   <FilterChips label value onChange options={[{ value, label, tone? }]} />
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";

const DOT = {
  info: "bg-tone-info-solid", success: "bg-tone-success-solid", warning: "bg-tone-warning-solid",
  danger: "bg-tone-danger-solid", neutral: "bg-tone-neutral-solid", violet: "bg-tone-violet-solid"
};

export function FilterChips({ label, value, onChange, options, multiple, className }) {
  const isOn = (v) => (multiple ? (value || []).indexOf(v) !== -1 : value === v);
  function toggle(v) {
    if (!multiple) return onChange(v);
    const cur = value || [];
    onChange(isOn(v) ? cur.filter((x) => x !== v) : cur.concat([v]));
  }
  return (
    <div role="group" aria-label={label} className={cn("-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5", className)}>
      {options.map((opt) => {
        const active = isOn(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={cn(
              BUTTON_RESET,
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-chip border border-solid px-4 text-meta font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 [@media(pointer:coarse)]:h-11",
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-card-foreground hover:border-primary hover:text-primary"
            )}
          >
            {opt.tone ? <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-chip", active ? "bg-primary-foreground" : DOT[opt.tone])} /> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
