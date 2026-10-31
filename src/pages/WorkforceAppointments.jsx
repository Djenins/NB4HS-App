// WorkforceAppointments.jsx -- Workforce's Appointments section
// (/workforce/appointments), the job developers' counterpart of Case
// Management's Appointments tab: requests waiting for confirmation and the
// scheduling form, for meetings with a job developer. Same access as Job
// Seekers (routeKey "jobdeveloper"), whose clients these appointments are.
// A client profile's "Schedule Appointment" lands here with
// { openAppointments, appointmentClientId } in history state (forwarded by
// JobDeveloper.jsx) to pre-fill the form.
import { useLocation } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import WorkforceNav from "../components/WorkforceNav.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";

export default function WorkforceAppointments() {
  const { data } = useApp();
  const t = useT();
  const location = useLocation();
  const scheduleClientId = location.state && location.state.openAppointments ? location.state.appointmentClientId : undefined;

  return (
    <>
      <WorkforceNav value="appointments" />
      <PageHeader title={t("appointmentsTitle")} />
      <AppointmentsSection
        open
        onToggle={() => {}}
        meetingWith="job_developer"
        clientList={data.jobClients || []}
        staffList={activeJobDevelopers(data.profiles)}
        staffLabelKey="apptJobDeveloperLabel"
        initialClientId={scheduleClientId}
      />
    </>
  );
}
