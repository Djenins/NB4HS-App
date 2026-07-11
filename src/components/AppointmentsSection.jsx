// AppointmentsSection.jsx -- the "schedule an appointment" form + list of
// existing appointments, shared by Case Management and Job Developer.
// Ported from appointments.js's renderAppointmentsCard()/
// attachAppointmentsSectionHandlers()/attachAppointmentRowActionHandlers().
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { buildAppointment, sortedAppointments } from "../lib/appointments.js";
import { clientDisplayName } from "../lib/clients.js";
import DatePicker from "./DatePicker.jsx";
import EmptyState from "./EmptyState.jsx";
import AppointmentRow from "./AppointmentRow.jsx";

const EMPTY_FORM = { clientId: "", firstName: "", lastName: "", phone: "", email: "", staffEmail: "", date: "", time: "", reason: "" };

export default function AppointmentsSection({ open, onToggle, meetingWith, clientList, staffList, staffLabelKey }) {
  const { data, session, setData, requestConfirm, showToast } = useApp();
  const t = useT();
  // Defaults the staff-assignment dropdown to whoever's currently signed in,
  // if they're one of the eligible staff -- same as the original.
  const [form, setForm] = useState(() => {
    const currentEmail = (session && session.currentUserEmail || "").toLowerCase();
    const isStaffChoice = (staffList || []).some((u) => u.email.toLowerCase() === currentEmail);
    return Object.assign({}, EMPTY_FORM, { staffEmail: isStaffChoice ? session.currentUserEmail : "" });
  });
  const [errors, setErrors] = useState([]);

  const apptList = sortedAppointments(data.appointments, meetingWith);

  function setField(name, value) { setForm((prev) => Object.assign({}, prev, { [name]: value })); }

  function pickClient(clientId) {
    const client = (clientList || []).find((c) => c.id === clientId);
    setForm((prev) => Object.assign({}, prev, {
      clientId,
      firstName: client ? (client.firstName || "") : prev.firstName,
      lastName: client ? (client.lastName || "") : prev.lastName,
      phone: client ? (client.phone || "") : prev.phone,
      email: client ? (client.email || "") : prev.email
    }));
  }

  function schedule() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErrors(["firstName", "lastName"].filter((f) => !form[f].trim()));
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const appt = buildAppointment({
      linkedClientId: form.clientId || null,
      firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email,
      assignedEmail: form.staffEmail, meetingWith: meetingWith, date: form.date, time: form.time, reason: form.reason
    }, "staff");
    if (!appt) return;
    setData((prev) => Object.assign({}, prev, { appointments: (prev.appointments || []).concat([appt]) }));
    setForm(EMPTY_FORM);
    showToast(t("apptScheduled"));
  }

  function updateStatus(id, status) {
    setData((prev) => Object.assign({}, prev, {
      appointments: (prev.appointments || []).map((a) => (a.id === id ? Object.assign({}, a, { status }) : a))
    }));
  }
  async function cancelAppt(id) {
    const ok = await requestConfirm(t("apptCancelConfirm"), { danger: true });
    if (ok) updateStatus(id, "cancelled");
  }
  async function deleteAppt(id) {
    const ok = await requestConfirm(t("apptDeleteConfirm"), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { appointments: (prev.appointments || []).filter((a) => a.id !== id) }));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("appointmentsTitle")}</summary>
      <div className="details-body">
        <p className="muted">{t("appointmentsDesc")}</p>
        <h4 style={{ margin: "14px 0 8px 0" }}>{t("scheduleApptTitle")}</h4>
        <div className="grid grid-3">
          <div className="field">
            <label htmlFor="appt-client-select">{t("apptClientSelectLabel")}</label>
            <select id="appt-client-select" value={form.clientId} onChange={(e) => pickClient(e.target.value)}>
              <option value="">{t("apptNewClientOption")}</option>
              {(clientList || []).map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="appt-first-name">{t("firstName")}</label><input type="text" id="appt-first-name" className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
          <div className="field"><label htmlFor="appt-last-name">{t("lastName")}</label><input type="text" id="appt-last-name" className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
        </div>
        <div className="grid grid-3">
          <div className="field"><label htmlFor="appt-phone">{t("phone")}</label><input type="text" id="appt-phone" value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
          <div className="field"><label htmlFor="appt-email">{t("email")}</label><input type="text" id="appt-email" value={form.email} onChange={(e) => setField("email", e.target.value)} /></div>
          <div className="field">
            <label htmlFor="appt-staff-select">{t(staffLabelKey)}</label>
            <select id="appt-staff-select" value={form.staffEmail} onChange={(e) => setField("staffEmail", e.target.value)}>
              <option value="">{t("apptUnassignedOption")}</option>
              {(staffList || []).map((u) => <option key={u.id} value={u.email}>{u.email}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-2">
          <div className="field"><label htmlFor="appt-date">{t("apptDateLabel")}</label><DatePicker id="appt-date" value={form.date} onChange={(v) => setField("date", v)} /></div>
          <div className="field"><label htmlFor="appt-time">{t("apptTimeLabel")}</label><input type="time" id="appt-time" value={form.time} onChange={(e) => setField("time", e.target.value)} /></div>
        </div>
        <div className="field"><label htmlFor="appt-reason">{t("apptReasonLabel")}</label><textarea id="appt-reason" rows={2} value={form.reason} onChange={(e) => setField("reason", e.target.value)} /></div>
        <div className="pill-row" style={{ marginTop: 12 }}><button className="btn-primary" onClick={schedule}>{t("scheduleApptBtn")}</button></div>

        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          {apptList.length ? (
            apptList.map((a) => (
              <AppointmentRow
                key={a.id}
                appt={a}
                onConfirm={() => updateStatus(a.id, "scheduled")}
                onComplete={() => updateStatus(a.id, "completed")}
                onCancel={() => cancelAppt(a.id)}
                onDelete={() => deleteAppt(a.id)}
              />
            ))
          ) : (
            <EmptyState icon="calendar" message={t("noAppointmentsYet")} />
          )}
        </div>
      </div>
    </details>
  );
}
