// EndPlacementModal.jsx -- the "Mark Ended" confirm-with-reason dialog (end
// date + reason), which sets current_status: "ended" on the placement.
// Ending a placement is consequential, so the submit is the danger variant
// and focus starts on Cancel -- a stray Enter can't end anything.
import { useState } from "react";
import { useT } from "../context/AppContext.jsx";
import { todayStr } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import { Button } from "./ui/button.jsx";
import { Dialog } from "./ui/dialog.jsx";
import { Field, Textarea } from "./ui/field.jsx";

export default function EndPlacementModal({ onSave, onCancel }) {
  const t = useT();
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ endDate, reasonForLeaving: reason });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title={t("markEndedBtn")}
      description={t("endPlacementDesc")}
      size="sm"
      closeLabel={t("closeLabel")}
      as="form"
      panelProps={{ onSubmit: submit }}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving} data-autofocus>{t("cancelLabel")}</Button>
          <Button type="submit" variant="danger" loading={saving}>{t("markEndedBtn")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("endDateLabel")} htmlFor="placement-end-date">
          <DatePicker id="placement-end-date" value={endDate} onChange={setEndDate} />
        </Field>
        <Field label={t("reasonForLeavingLabel")} htmlFor="placement-end-reason">
          <Textarea id="placement-end-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("phEndReason")} />
        </Field>
      </div>
    </Dialog>
  );
}
