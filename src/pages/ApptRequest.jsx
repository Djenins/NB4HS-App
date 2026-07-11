// ApptRequest.jsx -- client-facing "request an appointment" form (no login
// required, reached from the Login page or the kiosk). Ported from
// checkin_checkout.js's renderApptRequest()/attachApptRequestHandlers().
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { buildAppointment } from "../lib/appointments.js";
import FormField from "../components/FormField.jsx";

export default function ApptRequest() {
  const { setData, setKiosk, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [errors, setErrors] = useState([]);

  function handleSubmit(e) {
    e.preventDefault();
    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();

    const fields = {
      firstName: val("firstName"), lastName: val("lastName"), phone: val("phone"), email: val("email"),
      date: val("date"), time: val("time"), reason: val("reason"),
      assignedEmail: "", meetingWith: val("meetingWith") || "case_manager"
    };
    const requiredNames = ["firstName", "lastName", "phone", "date", "time"];
    const errs = requiredNames.filter((f) => !fields[f]);
    if (errs.length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);

    const appt = buildAppointment(fields, "client");
    if (!appt) return;
    setData((prev) => Object.assign({}, prev, { appointments: (prev.appointments || []).concat([appt]) }));
    navigate("/appointments/request/success");
  }

  const isInvalid = (name) => errors.indexOf(name) !== -1;

  return (
    <div className="kiosk-wrap">
      <div className="card">
        <button className="btn-ghost" style={{ marginBottom: 14 }} onClick={() => { setKiosk(false); navigate("/"); }}>
          &larr; {t("back")}
        </button>
        <h1>{t("requestApptTitle")}</h1>
        <p className="muted">{t("requestApptDesc")}</p>
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-section-head">
              <h3>{t("sectionApptYourInfo")}</h3>
              <p>{t("sectionApptYourInfoDesc")}</p>
            </div>
            <div className="form-section-body">
              <div className="grid grid-2">
                <FormField name="firstName" label={t("firstName")} required invalid={isInvalid("firstName")} />
                <FormField name="lastName" label={t("lastName")} required invalid={isInvalid("lastName")} />
                <FormField name="phone" label={t("phone")} required invalid={isInvalid("phone")} />
                <FormField name="email" label={t("email")} />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-head">
              <h3>{t("sectionApptDetails")}</h3>
              <p>{t("sectionApptDetailsDesc")}</p>
            </div>
            <div className="form-section-body">
              <div className="field">
                <label className="required" htmlFor="appt-req-meeting-with">{t("apptMeetingWithLabel")}</label>
                <select name="meetingWith" id="appt-req-meeting-with" defaultValue="case_manager">
                  <option value="case_manager">{t("roleCaseManager")}</option>
                  <option value="job_developer">{t("roleJobDeveloper")}</option>
                </select>
              </div>
              <div className="grid grid-2">
                <FormField name="date" label={t("apptPreferredDateLabel")} type="date" required invalid={isInvalid("date")} />
                <FormField name="time" label={t("apptPreferredTimeLabel")} type="time" required invalid={isInvalid("time")} />
              </div>
              <div className="field">
                <label htmlFor="checkin-field-reason">{t("apptReasonLabel")}</label>
                <textarea name="reason" id="checkin-field-reason" rows={3} />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block">{t("submitApptRequestBtn")}</button>
        </form>
      </div>
    </div>
  );
}
