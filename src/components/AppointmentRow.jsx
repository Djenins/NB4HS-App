// AppointmentRow.jsx -- one row in the appointments list on Case Management/
// Job Developer (NB4HS Operate design system). Status comes from
// statusTone's "appointment" domain through StatusBadge. Same confirm/
// complete/cancel/delete handlers as before, plus the inline reschedule
// (new date/time) action.
import { useId, useState } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { updateAppointment } from "../lib/clientsData.js";
import { fmtDateLong, formatPhone } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Field, Input } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { StatusBadge } from "./ui/status-badge.jsx";

const DANGER_GHOST = "text-tone-danger-ink hover:bg-tone-danger-bg";

export default function AppointmentRow({ appt, onConfirm, onComplete, onCancel, onCancelSeries, onDelete }) {
  const { lang, showToast } = useApp();
  const t = useT();
  const idBase = useId();
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
    <div className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-ui font-semibold text-card-foreground">{appt.firstName} {appt.lastName}</span>
            <StatusBadge domain="appointment" status={appt.status}>{apptStatusLabel(appt.status, lang)}</StatusBadge>
            {appt.seriesId ? (
              <Badge variant="neutral"><Repeat className="h-3 w-3" aria-hidden="true" />{t("apptRecurringBadge")}</Badge>
            ) : null}
          </div>
          <div className="mt-1 text-meta tabular-nums text-muted">
            {fmtDateLong(appt.date)}{appt.time ? " · " + appt.time : ""} — {meetingWithLabel(appt.meetingWith, lang)}: <span className="break-all">{mgrLabel}</span>
          </div>
          {appt.reason ? <div className="mt-1 text-meta text-card-foreground">{appt.reason}</div> : null}
          {appt.phone || appt.email ? (
            <div className="mt-1 break-all text-meta tabular-nums text-muted">{formatPhone(appt.phone)}{appt.email ? " · " + appt.email : ""}</div>
          ) : null}
        </div>
        <IconButton size="sm" variant="danger" label={t("deleteLabel")} onClick={onDelete}>
          <Trash2 aria-hidden="true" />
        </IconButton>
      </div>
      {!rescheduling && (appt.status === "requested" || appt.status === "scheduled") ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {appt.status === "requested" ? (
            <Button size="sm" variant="secondary" onClick={onConfirm}>{t("confirmApptBtn")}</Button>
          ) : null}
          {appt.status === "scheduled" ? (
            <Button size="sm" variant="secondary" onClick={onComplete}>{t("completeApptBtn")}</Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setRescheduling(true)}>{t("rescheduleApptBtn")}</Button>
          <Button size="sm" variant="ghost" className={DANGER_GHOST} onClick={onCancel}>{t("cancelApptBtn")}</Button>
          {onCancelSeries ? (
            <Button size="sm" variant="ghost" className={DANGER_GHOST} onClick={onCancelSeries}>{t("cancelApptSeriesBtn")}</Button>
          ) : null}
        </div>
      ) : null}
      {rescheduling ? (
        <div className="mt-2 space-y-3 rounded-control bg-surface-sunken p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("apptDateLabel")} htmlFor={idBase + "-date"}>
              <Input id={idBase + "-date"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={t("apptTimeLabel")} htmlFor={idBase + "-time"}>
              <Input id={idBase + "-time"} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={saveReschedule}>{t("saveRescheduleBtn")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setRescheduling(false)}>{t("cancelRescheduleBtn")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
