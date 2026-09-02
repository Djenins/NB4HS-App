// BulkActionsBar.jsx -- appears above a table once one or more row
// checkboxes are selected (Assessments, Case Management, Job Developer,
// Food Distribution). Shows the selection count plus whatever actions the
// caller passes in (real, wired-up actions only -- e.g. bulk delete reuses
// the same per-row remove function each page already has), plus a Clear
// button that resets the selection. Renders nothing when count is 0.
import { X } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { Button } from "./ui/button.jsx";

export default function BulkActionsBar({ count, onClear, children }) {
  const t = useT();
  if (!count) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-soft bg-primary-tint px-4 py-3">
      <div className="text-sm font-bold text-primary">{t("bulkSelectedLabel").replace("{n}", String(count))}</div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1.5 text-primary hover:bg-card">
          <X className="h-3.5 w-3.5" />{t("clearSelectionLabel")}
        </Button>
      </div>
    </div>
  );
}
