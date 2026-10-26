// JobOpeningPickerCard.jsx -- one selectable job opening in the Candidate
// Matching page's picker panel. A radio-style choice, not a card: the
// selected opening takes the primary border and tint, and aria-pressed
// carries the same state for assistive tech, so colour is never the only
// signal.
//
// main.css styles the bare `button` tag app-wide (52px min-height, padding,
// 2px border, hover lift) because Tailwind's preflight is off; BUTTON_RESET
// cancels it the same way every ui button does.
import { Briefcase } from "lucide-react";
import { cn } from "../lib/cn.js";
import { employmentTypeLabel, statusLabel } from "../lib/jobOpenings.js";
import { BUTTON_RESET } from "./ui/button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function JobOpeningPickerCard({ opening, selected, onSelect }) {
  const meta = [opening.employerCity, employmentTypeLabel(opening.employmentType)].filter(Boolean);

  return (
    <button
      type="button"
      onClick={function () { onSelect(opening.id); }}
      aria-pressed={selected}
      className={cn(
        BUTTON_RESET,
        "flex w-full items-start gap-3 rounded-control border border-solid p-3 text-left transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2",
        selected ? "border-primary bg-primary-tint" : "border-border bg-card hover:border-line-strong hover:bg-surface-sunken"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
          selected ? "bg-card text-primary" : "bg-tone-info-chip text-tone-info-ink"
        )}
      >
        <Briefcase className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
          <span className="min-w-0 text-ui font-semibold text-card-foreground [overflow-wrap:anywhere]">{opening.title}</span>
          <StatusBadge domain="opening" status={opening.status}>{statusLabel(opening.status)}</StatusBadge>
        </span>
        <span className="mt-0.5 block truncate text-meta text-muted">{opening.employerName || "—"}</span>
        {meta.length > 0 && <span className="mt-0.5 block truncate text-meta text-muted">{meta.join(" • ")}</span>}
      </span>
    </button>
  );
}
