// AppointmentsSection.jsx -- the "schedule an appointment" form + list of
// existing appointments, shared by Case Management and Job Developer.
// Ported from appointments.js's renderAppointmentsCard()/
// attachAppointmentsSectionHandlers()/attachAppointmentRowActionHandlers().
import { useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { sortedAppointments } from "../lib/appointments.js";
import { clientDisplayName } from "../lib/clients.js";
import { createAppointment, deleteAppointment, updateAppointmentStatus } from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import { formatPhone } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import EmptyState from "./EmptyState.jsx";
import AppointmentRow from "./AppointmentRow.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card.jsx";

const EMPTY_FORM = { clientId: "", firstName: "", lastName: "", phone: "", email: "", staffEmail: "", date: "", time: "", reason: "" };

const fieldInputClass = "h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";
function Field({ id, label, required, invalid, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function AppointmentsSection({ open, onToggle, meetingWith, clientList, staffList, staffLabelKey }) {
  const { data, session, requestConfirm, showToast } = useApp();
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

  // `form.clientId` is the picked *program row*'s id (matches the <select>
  // options below) -- appointments now store the *master* clients.id
  // directly (see plans/wobbly-munching-rose.md), so it's resolved via the
  // program row's nbId only at submit time, not stashed in form state
  // (which would break the controlled <select>'s displayed value).
  async function schedule() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setErrors(["firstName", "lastName"].filter((f) => !form[f].trim()));
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const selectedProgramClient = (clientList || []).find((c) => c.id === form.clientId);
    const master = selectedProgramClient && selectedProgramClient.nbId
      ? (data.clients || []).find((mc) => mc.nbId === selectedProgramClient.nbId) : null;
    await createAppointment({
      clientId: master ? master.id : null,
      firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email,
      assignedEmail: form.staffEmail, meetingWith: meetingWith, date: form.date, time: form.time, reason: form.reason,
      source: "staff"
    });
    setForm(EMPTY_FORM);
    showToast(t("apptScheduled"));
  }

  async function cancelAppt(id) {
    const ok = await requestConfirm(t("apptCancelConfirm"), { danger: true });
    if (ok) await updateAppointmentStatus(id, "cancelled");
  }
  async function deleteAppt(id) {
    const ok = await requestConfirm(t("apptDeleteConfirm"), { danger: true });
    if (!ok) return;
    await deleteAppointment(id);
  }

  return (
    <Card className="mb-5">
      <CardHeader className="space-y-0">
        <button
          type="button"
          onClick={() => onToggle(!open)}
          aria-expanded={open}
          className="flex min-h-0 w-full items-center gap-3 border-0 bg-transparent p-0 text-left"
        >
          {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted" />}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <CalendarClock className="h-4.5 w-4.5" />
          </span>
          <CardTitle className="m-0">{t("appointmentsTitle")}</CardTitle>
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="pt-0">
          <p className="text-sm text-muted">{t("appointmentsDesc")}</p>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <h4 className="m-0 text-sm font-bold text-card-foreground">{t("scheduleApptTitle")}</h4>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field id="appt-client-select" label={t("apptClientSelectLabel")}>
                  <select id="appt-client-select" value={form.clientId} onChange={(e) => pickClient(e.target.value)} className={fieldInputClass}>
                    <option value="">{t("apptNewClientOption")}</option>
                    {(clientList || []).map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
                  </select>
                </Field>
                <Field id="appt-first-name" label={t("firstName")} required>
                  <input type="text" id="appt-first-name" className={cn(fieldInputClass, errors.indexOf("firstName") !== -1 && "border-accent bg-tint-danger")} value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
                </Field>
                <Field id="appt-last-name" label={t("lastName")} required>
                  <input type="text" id="appt-last-name" className={cn(fieldInputClass, errors.indexOf("lastName") !== -1 && "border-accent bg-tint-danger")} value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field id="appt-phone" label={t("phone")}>
                  <input type="text" id="appt-phone" className={fieldInputClass} value={form.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
                </Field>
                <Field id="appt-email" label={t("email")}>
                  <input type="text" id="appt-email" className={fieldInputClass} value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </Field>
                <Field id="appt-staff-select" label={t(staffLabelKey)}>
                  <select id="appt-staff-select" value={form.staffEmail} onChange={(e) => setField("staffEmail", e.target.value)} className={fieldInputClass}>
                    <option value="">{t("apptUnassignedOption")}</option>
                    {(staffList || []).map((u) => <option key={u.id} value={u.email}>{u.email}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field id="appt-date" label={t("apptDateLabel")}>
                  <DatePicker id="appt-date" value={form.date} onChange={(v) => setField("date", v)} />
                </Field>
                <Field id="appt-time" label={t("apptTimeLabel")}>
                  <input type="time" id="appt-time" className={fieldInputClass} value={form.time} onChange={(e) => setField("time", e.target.value)} />
                </Field>
              </div>

              <Field id="appt-reason" label={t("apptReasonLabel")}>
                <textarea id="appt-reason" rows={2} className="min-h-0 w-full rounded-lg border border-border bg-background p-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" value={form.reason} onChange={(e) => setField("reason", e.target.value)} />
              </Field>

              <Button onClick={schedule}>{t("scheduleApptBtn")}</Button>
            </div>

            <div className="rounded-xl border border-border">
              {apptList.length ? (
                <div className="divide-y divide-border p-1">
                  {apptList.map((a) => (
                    <AppointmentRow
                      key={a.id}
                      appt={a}
                      onConfirm={() => updateAppointmentStatus(a.id, "scheduled")}
                      onComplete={() => updateAppointmentStatus(a.id, "completed")}
                      onCancel={() => cancelAppt(a.id)}
                      onDelete={() => deleteAppt(a.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-6">
                  <EmptyState icon="calendar" message={t("noAppointmentsYet")} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
