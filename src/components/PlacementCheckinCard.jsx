// PlacementCheckinCard.jsx -- one 30/60/90/180-day check-in's form on
// PlacementDetail.jsx. Local draft state + a Save button (batched, same
// idiom as this app's other edit forms) plus a separate "Mark Complete"
// action. Anchored by id="placement-checkin-<type>" so
// PlacementTimeline.jsx can scroll to it.
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { checkinTypeLabel, PERFORMANCE_RATINGS } from "../lib/placements.js";
import { fmtDateLong, todayStr } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent } from "./ui/card.jsx";

const inputClass = "h-10 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
const textareaClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

export default function PlacementCheckinCard({ checkin, onUpdate }) {
  const t = useT();
  const [fields, setFields] = useState({
    performanceRating: checkin.performanceRating, attendanceNotes: checkin.attendanceNotes,
    promotion: checkin.promotion, raise: checkin.raise,
    employerFeedback: checkin.employerFeedback, participantFeedback: checkin.participantFeedback, notes: checkin.notes
  });
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  return (
    <Card id={"placement-checkin-" + checkin.checkinType}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-bold text-card-foreground">{checkinTypeLabel(checkin.checkinType)}</h3>
          {checkin.completed ? (
            <Badge variant="success">{t("checkinCompletedLabel")} · {fmtDateLong(checkin.completedDate)}</Badge>
          ) : (
            <Badge variant="neutral">{fmtDateLong(checkin.dueDate)}</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("performanceRatingLabel")}</label>
            <select className={inputClass} value={fields.performanceRating} onChange={(e) => setField("performanceRating", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {PERFORMANCE_RATINGS.map((r) => <option key={r.key} value={r.key}>{r.en}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-4 pt-5">
            <label className="flex items-center gap-2 text-sm text-card-foreground">
              <input type="checkbox" checked={fields.promotion} onChange={(e) => setField("promotion", e.target.checked)} /> {t("promotionLabel")}
            </label>
            <label className="flex items-center gap-2 text-sm text-card-foreground">
              <input type="checkbox" checked={fields.raise} onChange={(e) => setField("raise", e.target.checked)} /> {t("raiseLabel")}
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("attendanceNotesLabel")}</label>
          <textarea rows={2} className={textareaClass} value={fields.attendanceNotes} onChange={(e) => setField("attendanceNotes", e.target.value)} placeholder={t("phAttendanceNotes")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("employerFeedbackLabel")}</label>
          <textarea rows={2} className={textareaClass} value={fields.employerFeedback} onChange={(e) => setField("employerFeedback", e.target.value)} placeholder={t("phEmployerFeedback")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("participantFeedbackLabel")}</label>
          <textarea rows={2} className={textareaClass} value={fields.participantFeedback} onChange={(e) => setField("participantFeedback", e.target.value)} placeholder={t("phParticipantFeedback")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("noteContentLabel")}</label>
          <textarea rows={2} className={textareaClass} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} placeholder={t("phCheckinNotes")} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button size="sm" variant="secondary" onClick={() => onUpdate(fields)}>{t("saveLabel")}</Button>
          {!checkin.completed && (
            <Button size="sm" className="gap-1.5" onClick={() => onUpdate(Object.assign({}, fields, { completed: true, completedDate: todayStr() }))}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("markCompleteBtn")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
