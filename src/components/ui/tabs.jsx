// tabs.jsx -- underline tabs for a record page's sections (Overview, Notes,
// Documents...). Real ARIA tabs: arrow keys move between them, and the
// caller renders the active panel with <TabPanel>.
//
//   <Tabs label value onChange items={[{ value, label, count? }]} idBase />
//   <TabPanel idBase value={active}>...</TabPanel>
import { useRef } from "react";
import { cn } from "../../lib/cn.js";
import { BUTTON_RESET } from "./button.jsx";

export function Tabs({ label, value, onChange, items, idBase, className }) {
  const refs = useRef([]);
  function onKeyDown(e, i) {
    const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + items.length) % items.length;
    onChange(items[next].value);
    refs.current[next]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className={cn("-mb-px flex gap-1 overflow-x-auto border-b border-border", className)}>
      {items.map((item, i) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={idBase + "-tab-" + item.value}
            aria-selected={active}
            aria-controls={idBase + "-panel-" + item.value}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              BUTTON_RESET,
              "relative inline-flex h-11 shrink-0 items-center gap-2 border-b-2 border-solid px-3 text-ui transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2",
              active ? "border-primary font-semibold text-primary" : "border-transparent font-medium text-muted hover:text-card-foreground"
            )}
          >
            {item.label}
            {item.count != null ? (
              <span className={cn("rounded-chip px-1.5 text-caption font-semibold tabular-nums", active ? "bg-tone-info-bg text-tone-info-ink" : "bg-tone-neutral-bg text-tone-neutral-ink")}>{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idBase, value, className, children }) {
  return (
    <div role="tabpanel" id={idBase + "-panel-" + value} aria-labelledby={idBase + "-tab-" + value} className={className}>
      {children}
    </div>
  );
}
