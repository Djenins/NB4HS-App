// AppointmentsSection.jsx -- the "schedule an appointment" form + list of
// existing appointments, shared by Case Management and Job Developer.
// Ported from appointments.js's renderAppointmentsCard()/
// attachAppointmentsSectionHandlers()/attachAppointmentRowActionHandlers().
// Presentation is on the NB4HS Operate design system (a collapsible
// SectionCard, Field controls, a divided appointment list); props, the
// open/onToggle contract and every data call are unchanged.
import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { sortedAppointments } from "../lib/appointments.js";
import { clientDisplayName } from "../lib/clients.js";
import {
  cancelAppointmentSeries, createAppointment, createAppointmentSeries, deleteAppointment, updateAppointmentStatus
} from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import { formatPhone } from "../lib/utils.js";
import DatePicker from "./DatePicker.jsx";
import AppointmentRow from "./AppointmentRow.jsx";
import { Button } from "./ui/button.jsx";
import { EmptyState } from "./ui/empty-state.jsx";
import { Field, Input, Select, Textarea } from "./ui/field.jsx";
import { IconButton } from "./ui/icon-button.jsx";
import { SectionCard } from "./ui/section-card.jsx";

const EMPTY_FORM = { clientId: "", firstName: "", lastName: "", phone: "", email: "", staffEmail: "", date: "", time: "", reason: "", repeat: "none", occurrences: "6" };

const REPEAT_INTERVAL_DAYS = { weekly: 7, biweekly: 14 };

export default function AppointmentsSection({ open, onToggle, meetingWith, clientList, staffList, staffLabelKey, initialClientId }) {
  const { data, session, requestConfirm, showToast } = useApp();
  const t = useT();
  const bodyId = useId();
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

  // Pre-selects the client this section was opened for, e.g. ClientHeader's
  // "Schedule Appointment" navigating here from ClientProfile.jsx with the
  // program-row id in router state. Only fires once -- appliedRef guards
  // against re-running (and clobbering whatever the user's typed since) on
  // every clientList refetch, since clientList changes identity on each
  // realtime update.
  const appliedInitialClientRef = useRef(false);
  useEffect(() => {
    if (appliedInitialClientRef.current || !initialClientId) return;
    if (!(clientList || []).some((c) => c.id === initialClientId)) return;
    appliedInitialClientRef.current = true;
    pickClient(initialClientId);
  }, [initialClientId, clientList]);

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
    if (form.repeat !== "none" && !form.date) {
      setErrors((prev) => prev.concat(["date"]));
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const selectedProgramClient = (clientList || []).find((c) => c.id === form.clientId);
    const master = selectedProgramClient && selectedProgramClient.nbId
      ? (data.clients || []).find((mc) => mc.nbId === selectedProgramClient.nbId) : null;
    const baseFields = {
      clientId: master ? master.id : null,
      firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email,
      assignedEmail: form.staffEmail, meetingWith: meetingWith, date: form.date, time: form.time, reason: form.reason,
      source: "staff"
    };
    if (form.repeat === "none") {
      await createAppointment(baseFields);
      showToast(t("apptScheduled"));
    } else {
      const count = Math.min(52, Math.max(2, parseInt(form.occurrences, 10) || 1));
      await createAppointmentSeries(baseFields, REPEAT_INTERVAL_DAYS[form.repeat], count);
      showToast(t("apptSeriesScheduled").replace("{count}", count));
    }
    setForm(EMPTY_FORM);
  }

  async function cancelAppt(id) {
    const ok = await requestConfirm(t("apptCancelConfirm"), { danger: true });
    if (ok) await updateAppointmentStatus(id, "cancelled");
  }
  async function cancelSeries(seriesId) {
    const ok = await requestConfirm(t("apptCancelSeriesConfirm"), { danger: true });
    if (!ok) return;
    await cancelAppointmentSeries(seriesId, new Date().toISOString().slice(0, 10));
    showToast(t("apptSeriesCancelled"));
  }
  async function deleteAppt(id) {
    const ok = await requestConfirm(t("apptDeleteConfirm"), { danger: true });
    if (!ok) return;
    await deleteAppointment(id);
  }

  const invalid = (name) => errors.indexOf(name) !== -1 || undefined;

  return (
    <SectionCard
      title={t("appointmentsTitle")}
      description={t("appointmentsDesc")}
      flush={!open}
      className="mb-5"
      action={
        <IconButton
          variant="secondary"
          label={open ? t("collapseSectionLabel") : t("expandSectionLabel")}
          aria-expanded={!!open}
          aria-controls={bodyId}
          onClick={() => onToggle(!open)}
        >
          <ChevronDown className={cn("transition-transform duration-fast", open && "rotate-180")} aria-hidden="true" />
        </IconButton>
      }
    >
      {open ? (
        <div id={bodyId} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <h3 className="m-0 text-section font-semibold text-card-foreground">{t("scheduleApptTitle")}</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label={t("apptClientSelectLabel")} htmlFor="appt-client-select">
                <Select id="appt-client-select" value={form.clientId} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">{t("apptNewClientOption")}</option>
                  {(clientList || []).map((c) => <option key={c.id} value={c.id}>{clientDisplayName(c)}</option>)}
                </Select>
              </Field>
              <Field label={t("firstName")} htmlFor="appt-first-name" required>
                <Input id="appt-first-name" aria-invalid={invalid("firstName")} placeholder={t("phFirstName")} value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} />
              </Field>
              <Field label={t("lastName")} htmlFor="appt-last-name" required>
                <Input id="appt-last-name" aria-invalid={invalid("lastName")} placeholder={t("phLastName")} value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} />
              </Field>
              <Field label={t("phone")} htmlFor="appt-phone">
                <Input id="appt-phone" type="tel" placeholder={t("phPhone")} value={form.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
              </Field>
              <Field label={t("email")} htmlFor="appt-email">
                <Input id="appt-email" type="email" placeholder={t("phEmail")} value={form.email} onChange={(e) => setField("email", e.target.value)} />
              </Field>
              <Field label={t(staffLabelKey)} htmlFor="appt-staff-select">
                <Select id="appt-staff-select" value={form.staffEmail} onChange={(e) => setField("staffEmail", e.target.value)}>
                  <option value="">{t("apptUnassignedOption")}</option>
                  {(staffList || []).map((u) => <option key={u.id} value={u.email}>{u.email}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("apptDateLabel")} htmlFor="appt-date">
                <div className="ds-control">
                  <DatePicker id="appt-date" value={form.date} onChange={(v) => setField("date", v)} />
                </div>
              </Field>
              <Field label={t("apptTimeLabel")} htmlFor="appt-time">
                <Input type="time" id="appt-time" value={form.time} onChange={(e) => setField("time", e.target.value)} />
              </Field>
            </div>

            <Field label={t("apptReasonLabel")} htmlFor="appt-reason">
              <Textarea id="appt-reason" rows={2} placeholder={t("apptReasonPlaceholder")} value={form.reason} onChange={(e) => setField("reason", e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("apptRepeatLabel")} htmlFor="appt-repeat">
                <Select id="appt-repeat" value={form.repeat} onChange={(e) => setField("repeat", e.target.value)}>
                  <option value="none">{t("apptRepeatNone")}</option>
                  <option value="weekly">{t("apptRepeatWeekly")}</option>
                  <option value="biweekly">{t("apptRepeatBiweekly")}</option>
                </Select>
              </Field>
              {form.repeat !== "none" ? (
                <Field label={t("apptOccurrencesLabel")} htmlFor="appt-occurrences">
                  <Input
                    type="number" id="appt-occurrences" min={2} max={52} className="tabular-nums" placeholder={t("phOccurrences")}
                    value={form.occurrences} onChange={(e) => setField("occurrences", e.target.value)}
                  />
                </Field>
              ) : null}
            </div>

            <Button onClick={schedule}>{form.repeat === "none" ? t("scheduleApptBtn") : t("scheduleApptSeriesBtn")}</Button>
          </div>

          {/* The list sits beside the form at lg, under it below; a hairline
              separates them instead of a nested bordered box. */}
          <div className="min-w-0 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {apptList.length ? (
              <div className="divide-y divide-line-subtle">
                {apptList.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appt={a}
                    onConfirm={() => updateAppointmentStatus(a.id, "scheduled")}
                    onComplete={() => updateAppointmentStatus(a.id, "completed")}
                    onCancel={() => cancelAppt(a.id)}
                    onCancelSeries={a.seriesId ? () => cancelSeries(a.seriesId) : undefined}
                    onDelete={() => deleteAppt(a.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState compact icon={CalendarClock} title={t("noAppointmentsYet")} description={t("apptEmptyHint")} />
            )}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
