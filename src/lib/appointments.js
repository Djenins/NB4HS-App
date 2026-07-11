// appointments.js -- pure helpers for the Appointments feature, now
// including the staff-side scheduling/listing pieces used by the Case
// Management and Job Developer pages.
import { t } from "./i18n.js";
import { uid } from "./utils.js";

export function activeStaffByRole(users, role) {
  return (users || []).filter(function (u) { return u.role === role && u.active !== false; });
}
export function activeCaseManagers(users) { return activeStaffByRole(users, "case_manager"); }
export function activeJobDevelopers(users) { return activeStaffByRole(users, "job_developer"); }

export function meetingWithLabel(key, lang) {
  if (key === "job_developer") return t("roleJobDeveloper", lang);
  return t("roleCaseManager", lang);
}
export function apptStatusLabel(status, lang) {
  if (status === "requested") return t("apptStatusRequested", lang);
  if (status === "scheduled") return t("apptStatusScheduled", lang);
  if (status === "completed") return t("apptStatusCompleted", lang);
  if (status === "cancelled") return t("apptStatusCancelled", lang);
  return status;
}
export function apptStatusBadgeClass(status) {
  if (status === "requested") return "badge-warn";
  if (status === "cancelled") return "badge-out";
  return "badge-in";
}
export function sortedAppointments(appointments, meetingWith) {
  var list = (appointments || []).slice();
  if (meetingWith) list = list.filter(function (a) { return a.meetingWith === meetingWith; });
  return list.sort(function (a, b) {
    var ak = (a.date || "9999-99-99") + " " + (a.time || "00:00");
    var bk = (b.date || "9999-99-99") + " " + (b.time || "00:00");
    return ak.localeCompare(bk);
  });
}

export function pendingApptCount(appointments, meetingWith) {
  return (appointments || []).filter(function (a) { return a.status === "requested" && a.meetingWith === meetingWith; }).length;
}

// Pure version of the original's createAppointment(): builds the appointment
// object and returns it (or null if required fields are missing) instead of
// pushing onto App.data.appointments and calling save() itself -- the caller
// (a component, via AppContext's setData) owns persisting it.
export function buildAppointment(fields, source) {
  var firstName = (fields.firstName || "").trim();
  var lastName = (fields.lastName || "").trim();
  if (!firstName || !lastName) return null;
  return {
    id: uid(),
    linkedClientId: fields.linkedClientId || null,
    firstName: firstName,
    lastName: lastName,
    phone: (fields.phone || "").trim(),
    email: (fields.email || "").trim(),
    date: fields.date || "",
    time: fields.time || "",
    reason: (fields.reason || "").trim(),
    assignedEmail: fields.assignedEmail || "",
    meetingWith: fields.meetingWith || "case_manager",
    status: source === "client" ? "requested" : "scheduled",
    source: source,
    createdAt: new Date().toISOString()
  };
}
