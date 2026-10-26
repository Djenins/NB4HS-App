// PlacementCheckinCard.jsx -- one 30/60/90/180-day check-in's form on
// PlacementDetail.jsx, as a ui SectionCard: the period as its title, its
// state (completed on a date, or due on a date) as the header badge, the
// fields in the body and the two actions in the footer. Local draft state +
// a Save button (batched, same idiom as this app's other edit forms) plus a
// separate "Mark Complete" action. Anchored by id="placement-checkin-<type>"
// so PlacementTimeline.jsx can scroll to it.
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { checkinState, checkinTypeLabel, PERFORMANCE_RATINGS } from "../lib/placements.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { Button } from "./ui/button.jsx";
import { Field, Select, Textarea } from "./ui/field.jsx";
import { SectionCard } from "./ui/section-card.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

export default function PlacementCheckinCard({ checkin, onUpdate }) {
  const t = useT();
  const [fields, setFields] = useState({
    performanceRating: checkin.performanceRating, attendanceNotes: checkin.attendanceNotes,
    promotion: checkin.promotion, raise: checkin.raise,
    employerFeedback: checkin.employerFeedback, participantFeedback: checkin.participantFeedback, notes: checkin.notes
  });
  const [busy, setBusy] = useState(null); // "save" | "complete" while a write runs
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function run(kind, patch) {
    setBusy(kind);
    try {
      await onUpdate(patch);
    } finally {
      setBusy(null);
    }
  }

  const idBase = "checkin-" + checkin.id;
  const state = checkinState(checkin);

  return (
    <div id={"placement-checkin-" + checkin.checkinType} className="scroll-mt-4">
      <SectionCard
        title={checkinTypeLabel(checkin.checkinType)}
        action={
          <StatusBadge domain="checkin" status={state} className="tabular-nums">
            {checkin.completed
              ? t("checkinCompletedLabel") + " · " + fmtDateLong(checkin.completedDate)
              : t("checkinDueLabel") + " · " + fmtDateLong(checkin.dueDate)}
          </StatusBadge>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" variant="secondary" loading={busy === "save"} disabled={!!busy} onClick={() => run("save", fields)}>
              {t("saveLabel")}
            </Button>
            {!checkin.completed && (
              <Button
                type="button" size="sm" loading={busy === "complete"} disabled={!!busy}
                onClick={() => run("complete", Object.assign({}, fields, { completed: true, completedDate: todayStr() }))}
              >
                {busy === "complete" ? null : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />} {t("markCompleteBtn")}
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
            <Field label={t("performanceRatingLabel")} htmlFor={idBase + "-rating"}>
              <Select id={idBase + "-rating"} value={fields.performanceRating} onChange={(e) => setField("performanceRating", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {PERFORMANCE_RATINGS.map((r) => <option key={r.key} value={r.key}>{r.en}</option>)}
              </Select>
            </Field>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-ui text-card-foreground">
                <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer accent-primary" checked={fields.promotion} onChange={(e) => setField("promotion", e.target.checked)} />
                {t("promotionLabel")}
              </label>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-ui text-card-foreground">
                <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer accent-primary" checked={fields.raise} onChange={(e) => setField("raise", e.target.checked)} />
                {t("raiseLabel")}
              </label>
            </div>
          </div>
          <Field label={t("attendanceNotesLabel")} htmlFor={idBase + "-attendance"}>
            <Textarea id={idBase + "-attendance"} rows={2} value={fields.attendanceNotes} onChange={(e) => setField("attendanceNotes", e.target.value)} placeholder={t("phAttendanceNotes")} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("employerFeedbackLabel")} htmlFor={idBase + "-employer"}>
              <Textarea id={idBase + "-employer"} rows={2} value={fields.employerFeedback} onChange={(e) => setField("employerFeedback", e.target.value)} placeholder={t("phEmployerFeedback")} />
            </Field>
            <Field label={t("participantFeedbackLabel")} htmlFor={idBase + "-participant"}>
              <Textarea id={idBase + "-participant"} rows={2} value={fields.participantFeedback} onChange={(e) => setField("participantFeedback", e.target.value)} placeholder={t("phParticipantFeedback")} />
            </Field>
          </div>
          <Field label={t("noteContentLabel")} htmlFor={idBase + "-notes"}>
            <Textarea id={idBase + "-notes"} rows={2} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("phCheckinNotes")} />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}
