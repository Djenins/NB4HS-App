// AppointmentRow.jsx -- one row in the appointments list on Case Management/
// Job Developer. Tailwind/shadcn redesign pass -- Badge for status, same
// confirm/complete/cancel/delete handlers as before.
import { X } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { fmtDateLong, formatPhone } from "../lib/utils.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";

function apptStatusBadgeVariant(status) {
  if (status === "requested") return "warn";
  if (status === "cancelled") return "neutral";
  return "success";
}

export default function AppointmentRow({ appt, onConfirm, onComplete, onCancel, onDelete }) {
  const { lang } = useApp();
  const t = useT();
  const mgrLabel = appt.assignedEmail ? appt.assignedEmail : t("apptUnassignedOption");

  return (
    <div className="rounded-lg p-3 hover:bg-background">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-card-foreground">{appt.firstName} {appt.lastName}</span>
            <Badge variant={apptStatusBadgeVariant(appt.status)}>{apptStatusLabel(appt.status, lang)}</Badge>
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
      {(appt.status === "requested" || appt.status === "scheduled") && (
        <div className="mt-2 flex gap-1.5">
          {appt.status === "requested" && (
            <Button size="sm" variant="secondary" onClick={onConfirm}>{t("confirmApptBtn")}</Button>
          )}
          {appt.status === "scheduled" && (
            <Button size="sm" variant="secondary" onClick={onComplete}>{t("completeApptBtn")}</Button>
          )}
          <Button size="sm" variant="ghost" className="text-accent hover:bg-tint-danger" onClick={onCancel}>{t("cancelApptBtn")}</Button>
        </div>
      )}
    </div>
  );
}
