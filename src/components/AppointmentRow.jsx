// AppointmentRow.jsx -- one row in the appointments list on Case Management/
// Job Developer. Ported from appointments.js's renderAppointmentRow().
import { useApp, useT } from "../context/AppContext.jsx";
import { apptStatusBadgeClass, apptStatusLabel, meetingWithLabel } from "../lib/appointments.js";
import { fmtDateLong } from "../lib/utils.js";

export default function AppointmentRow({ appt, onConfirm, onComplete, onCancel, onDelete }) {
  const { lang } = useApp();
  const t = useT();
  const mgrLabel = appt.assignedEmail ? appt.assignedEmail : t("apptUnassignedOption");

  return (
    <div className="appt-row">
      <div className="flex-between">
        <div>
          <strong>{appt.firstName} {appt.lastName}</strong>{" "}
          <span className={"badge " + apptStatusBadgeClass(appt.status)}>{apptStatusLabel(appt.status, lang)}</span>
        </div>
        <div>
          {appt.status === "requested" && (
            <>
              <button className="btn-secondary btn-sm" onClick={onConfirm}>{t("confirmApptBtn")}</button>{" "}
              <button className="btn-ghost btn-sm btn-outline-danger" onClick={onCancel}>{t("cancelApptBtn")}</button>{" "}
            </>
          )}
          {appt.status === "scheduled" && (
            <>
              <button className="btn-secondary btn-sm" onClick={onComplete}>{t("completeApptBtn")}</button>{" "}
              <button className="btn-ghost btn-sm btn-outline-danger" onClick={onCancel}>{t("cancelApptBtn")}</button>{" "}
            </>
          )}
          <button className="btn-ghost btn-icon btn-icon-danger" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onDelete}>&times;</button>
        </div>
      </div>
      <div className="muted" style={{ marginTop: 4, fontSize: ".9rem" }}>
        {fmtDateLong(appt.date)}{appt.time ? " · " + appt.time : ""} — {meetingWithLabel(appt.meetingWith, lang)}: {mgrLabel}
      </div>
      {appt.reason && <div style={{ marginTop: 4, fontSize: ".9rem" }}>{appt.reason}</div>}
      {(appt.phone || appt.email) && (
        <div className="muted" style={{ fontSize: ".8rem" }}>{appt.phone || ""}{appt.email ? " · " + appt.email : ""}</div>
      )}
    </div>
  );
}
