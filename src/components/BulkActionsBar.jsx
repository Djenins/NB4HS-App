// BulkActionsBar.jsx -- appears above a table once one or more row
// checkboxes are selected (Assessments, Case Management, Job Developer,
// Students, Food Distribution). Shows the selection count plus whatever
// actions the caller passes in (real, wired-up actions only -- e.g. bulk
// delete reuses the same per-row remove function each page already has),
// plus a Clear button that resets the selection. Renders nothing when count
// is 0. An info-tone strip, announced politely as the count changes.
import { X } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { Button } from "./ui/button.jsx";

export default function BulkActionsBar({ count, onClear, children }) {
  const t = useT();
  if (!count) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-control border border-tone-info-border bg-tone-info-bg px-4 py-2.5">
      <div className="text-ui font-semibold tabular-nums text-tone-info-ink" aria-live="polite">{t("bulkSelectedLabel").replace("{n}", String(count))}</div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear} className="text-tone-info-ink hover:bg-card">
          <X className="h-4 w-4" aria-hidden="true" />{t("clearSelectionLabel")}
        </Button>
      </div>
    </div>
  );
}
