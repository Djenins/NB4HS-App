// JobOpeningPickerCard.jsx -- one selectable job opening in the Candidate
// Matching page's left rail. Same tile idiom as FilterSelectCard (pale-blue
// icon square, title, supporting line) but as a radio-style choice: the
// selected opening takes the primary border and tint.
//
// main.css styles the bare `button` tag app-wide (min-height:52px, 20px
// padding, 2px border, and a 1px hover lift) because Tailwind's preflight is
// off, so this cancels all of it via BTN_RESET the same way ModuleNav.jsx
// does -- otherwise every row inflates into a 52px pill that jumps on hover.
import { Briefcase } from "lucide-react";
import { cn } from "../lib/cn.js";
import { employmentTypeLabel, statusBadgeVariant, statusLabel } from "../lib/jobOpenings.js";
import { Badge } from "./ui/badge.jsx";

const BTN_RESET = "min-h-0 border-0 bg-transparent p-0 font-normal transform-none";

export default function JobOpeningPickerCard({ opening, selected, onSelect }) {
  const meta = [opening.employerCity, employmentTypeLabel(opening.employmentType)].filter(Boolean);

  return (
    <button
      type="button"
      onClick={function () { onSelect(opening.id); }}
      aria-pressed={selected}
      className={cn(
        BTN_RESET,
        "flex w-full items-start gap-3 rounded-[12px] border p-3 text-left transition-colors",
        selected ? "border-primary bg-primary-tint" : "border-border bg-card hover:border-primary-soft"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
          selected ? "bg-card text-primary" : "bg-primary-tint text-primary"
        )}
      >
        <Briefcase className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-card-foreground">{opening.title}</span>
          <Badge variant={statusBadgeVariant(opening.status)}>{statusLabel(opening.status)}</Badge>
        </span>
        <span className="mt-0.5 block truncate text-sm text-muted">{opening.employerName || "—"}</span>
        {meta.length > 0 && <span className="mt-0.5 block truncate text-xs text-muted">{meta.join(" • ")}</span>}
      </span>
    </button>
  );
}
