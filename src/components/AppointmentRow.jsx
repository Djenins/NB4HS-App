// AppointmentRow.jsx -- one row in the appointments list on Case Management/
// Job Developer. Tailwind/shadcn redesign pass -- Badge for status, same
// confirm/complete/cancel/delete handlers as before, plus an inline
// reschedule (new date/time) action.
import { useState } from "react";
import { Repeat, X } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { updateAppointment } from "../lib/clientsData.js";
import { fmtDateLong, formatPhone } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

function apptStatusBadgeVariant(status) {
  if (status === "requested") return "warn";
  if (status === "cancelled") return "neutral";
  return "success";
}

export default function AppointmentRow({ appt, onConfirm, onComplete, onCancel, onCancelSeries, onDelete }) {
  const { lang, showToast } = useApp();
  const t = useT();
  const mgrLabel = appt.assignedEmail ? appt.assignedEmail : t("apptUnassignedOption");
  const [rescheduling, setRescheduling] = useState(false);
  const [date, setDate] = useState(appt.date || "");
  const [time, setTime] = useState(appt.time || "");

  async function saveReschedule() {
    await updateAppointment(appt.id, { date, time });
    setRescheduling(false);
    showToast(t("apptRescheduled"));
  }

  return (
    <div className="rounded-lg p-3 hover:bg-background">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-card-foreground">{appt.firstName} {appt.lastName}</span>
            <Badge variant={apptStatusBadgeVariant(appt.status)}>{apptStatusLabel(appt.status, lang)}</Badge>
            {appt.seriesId ? (
              <Badge variant="neutral" className="gap-1"><Repeat className="h-3 w-3" /> {t("apptRecurringBadge")}</Badge>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-muted">
            {fmtDateLong(appt.date)}{appt.time ? " · " + appt.time : ""} — {meetingWithLabel(appt.meetingWith, lang)}: {mgrLabel}
          </div>
          {appt.reason && <div className="mt-1 text-xs text-card-foreground">{appt.reason}</div>}
          {(appt.phone || appt.email) && (
            <div className="mt-1 text-xs text-muted">{formatPhone(appt.phone)}{appt.email ? " · " + appt.email : ""}</div>
          )}
        </div>
        <Button variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onDelete} className="h-7 w-7 shrink-0 text-muted hover:bg-tint-danger hover:text-accent">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {!rescheduling && (appt.status === "requested" || appt.status === "scheduled") && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {appt.status === "requested" && (
            <Button size="sm" variant="secondary" onClick={onConfirm}>{t("confirmApptBtn")}</Button>
          )}
          {appt.status === "scheduled" && (
            <Button size="sm" variant="secondary" onClick={onComplete}>{t("completeApptBtn")}</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setRescheduling(true)}>{t("rescheduleApptBtn")}</Button>
          <Button size="sm" variant="ghost" className="text-accent hover:bg-tint-danger" onClick={onCancel}>{t("cancelApptBtn")}</Button>
          {onCancelSeries ? (
            <Button size="sm" variant="ghost" className="text-accent hover:bg-tint-danger" onClick={onCancelSeries}>{t("cancelApptSeriesBtn")}</Button>
          ) : null}
        </div>
      )}
      {rescheduling && (
        <div className="mt-2 space-y-2 rounded-lg border border-border bg-background p-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 min-h-0 w-full rounded-md border border-border bg-card px-2 text-xs" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 min-h-0 w-full rounded-md border border-border bg-card px-2 text-xs" />
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={saveReschedule}>{t("saveRescheduleBtn")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setRescheduling(false)}>{t("cancelRescheduleBtn")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
