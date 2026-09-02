// AppointmentDetailsSection.jsx -- right card of the "Request an Appointment"
// kiosk: who the visitor would like to meet and when.
//
// The two staff controls keep the exact relationship they always had. "Meet
// With" lists the live staff_directory (fetched by the page, never hardcoded)
// plus a "No preference" option; "Meeting With" -- the role fallback -- only
// appears while no specific person is chosen, because picking a person
// already determines the role. Preferred Date is still the app-wide
// DatePicker, Preferred Time still a native time input, so neither field
// gained or lost any availability rule in this redesign.
import { CalendarCheck, Clock, MessageSquare, Users } from "lucide-react";
import ApptRequestCard from "./ApptRequestCard.jsx";
import { ApptDateField, ApptField, ApptSelect, ApptTextarea } from "./ApptRequestField.jsx";

export default function AppointmentDetailsSection({ t, errors, staffList, staffId, onStaffChange, open, onToggle }) {
  return (
    <ApptRequestCard
      id="appt-req-details"
      icon={CalendarCheck}
      title={t("sectionApptDetails")}
      description={t("sectionApptDetailsDesc")}
      open={open}
      onToggle={onToggle}
    >
      <div className="appt-fields flex flex-col gap-3 sm:gap-4">
        <ApptSelect
          name="staffId"
          id="appt-req-meeting-with"
          label={t("apptStaffPickerLabel")}
          required
          icon={Users}
          value={staffId}
          onChange={onStaffChange}
        >
          <option value="">{t("apptStaffPickerAnyOption")}</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.role === "job_developer" ? t("roleJobDeveloper") : t("roleCaseManager")}
            </option>
          ))}
        </ApptSelect>

        {!staffId && (
          <ApptSelect
            name="meetingWith"
            id="appt-req-meeting-with-role"
            label={t("apptMeetingWithLabel")}
            icon={Users}
            defaultValue="case_manager"
          >
            <option value="case_manager">{t("roleCaseManager")}</option>
            <option value="job_developer">{t("roleJobDeveloper")}</option>
          </ApptSelect>
        )}

        <div className="appt-fields grid gap-3 sm:grid-cols-2 sm:gap-4">
          <ApptDateField name="date" label={t("apptPreferredDateLabel")} required error={errors.date} />
          <ApptField
            name="time" label={t("apptPreferredTimeLabel")} type="time" required
            icon={Clock} error={errors.time}
          />
        </div>

        <ApptTextarea
          name="reason"
          label={t("apptReasonLabel")}
          icon={MessageSquare}
          placeholder={t("apptReasonPlaceholder")}
          hint={t("apptReasonHint")}
        />
      </div>
    </ApptRequestCard>
  );
}
