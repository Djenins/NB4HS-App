// EndPlacementModal.jsx -- small "Mark Ended" form (end date + reason),
// sets current_status: "ended" on the placement.
import { useState } from "react";
import { useT } from "../context/AppContext.jsx";
import { todayStr } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";

export default function EndPlacementModal({ onSave, onCancel }) {
  const t = useT();
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState("");

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-box max-w-md" role="dialog" aria-modal="true">
        <p className="mb-4 text-base font-bold text-card-foreground">{t("markEndedBtn")}</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("endDateLabel")}</label>
            <DatePicker id="placement-end-date" value={endDate} onChange={setEndDate} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("reasonForLeavingLabel")}</label>
            <textarea
              rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
        <div className="pill-row" style={{ justifyContent: "flex-end", marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn-secondary" onClick={onCancel}>{t("cancelLabel")}</button>
          <Button variant="destructive" onClick={() => onSave({ endDate, reasonForLeaving: reason })}>{t("markEndedBtn")}</Button>
        </div>
      </div>
    </div>
  );
}
