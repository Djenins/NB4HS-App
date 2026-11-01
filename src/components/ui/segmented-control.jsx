// segmented-control.jsx -- a small set of mutually exclusive views or
// ranges (Week | Month | Agenda, 7d | 30d | 90d, List | Grid), lifted from
// the calendar header. Wraps onto a second line rather than overflowing.
// Buttons with aria-pressed inside a labelled group:
// it switches what the page shows, it doesn't own tab panels. The blue
// pill slides to the chosen option (a shared layoutId) instead of jumping.
//
//   <SegmentedControl label value onChange options={[{ value, label, icon? }]} />
import { useId } from "react";
import { m } from "framer-motion";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";

export function SegmentedControl({ label, value, onChange, options, size = "md", className }) {
  const pillId = useId();
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full flex-wrap items-center gap-1 rounded-control border border-border bg-card p-1 shadow-card", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            aria-label={opt.iconOnly ? opt.label : undefined}
            title={opt.iconOnly ? opt.label : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              BUTTON_RESET,
              "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-3px)] px-3 text-meta transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 [@media(pointer:coarse)]:h-10",
              size === "sm" ? "h-7" : "h-8",
              active
                ? "font-semibold text-primary-foreground"
                : "font-medium text-card-foreground hover:bg-primary-tint hover:text-primary"
            )}
          >
            {active ? (
              <m.span
                layoutId={pillId}
                aria-hidden="true"
                className="absolute inset-0 rounded-[inherit] bg-primary shadow-card"
                transition={{ type: "tween", duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              />
            ) : null}
            {Icon ? <Icon className="relative h-4 w-4" aria-hidden="true" /> : null}
            {opt.iconOnly ? null : <span className="relative">{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
