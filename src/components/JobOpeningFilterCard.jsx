// JobOpeningFilterCard.jsx -- one compact filter tile on the Job Openings
// page (JobOpeningFilters.jsx): pale-blue icon square, filter name, the
// current selection, chevron. The control itself is a real <select>
// stretched transparently across the tile, so keyboard, screen-reader and
// mobile behaviour stay native and the tile is purely presentational.
//
// Two project traps handled here:
//   * main.css styles the bare `select` tag app-wide (min-height:52px,
//     14px radius, its own background chevron) because Tailwind's preflight
//     is off -- the overlay cancels all of it and rides on opacity-0, so
//     none of that chrome shows through.
//   * `opacity-0` also swallows main.css's `select:focus{outline:...}`, so
//     the focus ring is drawn by the wrapper via `focus-within:` instead.
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn.js";

export default function JobOpeningFilterCard({ icon: Icon, label, value, options, onChange }) {
  const selected = options.filter(function (o) { return o.value === value; })[0];
  const active = Boolean(value);

  return (
    <div
      className={cn(
        "relative flex h-[68px] items-center gap-3 rounded-[12px] border bg-card px-3.5 transition-colors",
        "focus-within:border-primary focus-within:ring-2",
        active ? "border-primary-soft" : "border-border hover:border-primary-soft"
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-tint text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold leading-tight text-card-foreground">{label}</span>
        <span className={cn("mt-0.5 block truncate text-sm leading-tight", active ? "font-medium text-primary" : "text-muted")}>
          {selected ? selected.label : options[0].label}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      <select
        aria-label={label}
        value={value}
        onChange={function (e) { onChange(e.target.value); }}
        className="absolute inset-0 h-full min-h-0 w-full cursor-pointer rounded-[12px] border-0 bg-transparent p-0 opacity-0"
      >
        {options.map(function (o) { return <option key={o.value || "__all"} value={o.value}>{o.label}</option>; })}
      </select>
    </div>
  );
}
