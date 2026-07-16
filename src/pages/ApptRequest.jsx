// ApptRequest.jsx -- client-facing "request an appointment" form (no login
// required, reached from the Login page or the kiosk). Ported from
// checkin_checkout.js's renderApptRequest()/attachApptRequestHandlers().
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { createAppointment, fetchStaffDirectory } from "../lib/clientsData.js";
import FormField from "../components/FormField.jsx";
import Icon from "../components/Icon.jsx";

export default function ApptRequest() {
  const { setKiosk, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [errors, setErrors] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [staffId, setStaffId] = useState("");

  useEffect(() => { fetchStaffDirectory().then(setStaffList); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const picked = staffList.find((s) => s.id === staffId);

    const fields = {
      firstName: val("firstName"), lastName: val("lastName"), phone: val("phone"), email: val("email"),
      date: val("date"), time: val("time"), reason: val("reason"),
      assignedEmail: picked ? picked.email : "", meetingWith: picked ? picked.role : (val("meetingWith") || "case_manager")
    };
    const requiredNames = ["firstName", "lastName", "phone", "date", "time"];
    const errs = requiredNames.filter((f) => !fields[f]);
    if (errs.length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);

    await createAppointment(Object.assign({}, fields, { source: "client" }));
    navigate("/appointments/request/success");
  }

  const isInvalid = (name) => errors.indexOf(name) !== -1;

  return (
    <div className="kiosk-wrap">
      <div className="card">
        <button className="btn-ghost" style={{ marginBottom: 14 }} onClick={() => { setKiosk(false); navigate("/"); }}>
          &larr; {t("back")}
        </button>
        <div className="page-header">
          <div className="icon-badge"><Icon name="calendar" className="icon-lg" /></div>
          <div>
            <h1>{t("requestApptTitle")}</h1>
            <p className="muted">{t("requestApptDesc")}</p>
          </div>
        </div>
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="form-section">
            <div className="form-section-head-row">
              <div className="icon-badge round"><Icon name="user" /></div>
              <div className="form-section-head">
                <h3>{t("sectionApptYourInfo")}</h3>
                <p>{t("sectionApptYourInfoDesc")}</p>
              </div>
            </div>
            <div className="form-section-body">
              <div className="grid grid-2">
                <FormField name="firstName" label={t("firstName")} icon="user" required invalid={isInvalid("firstName")} />
                <FormField name="lastName" label={t("lastName")} icon="user" required invalid={isInvalid("lastName")} />
                <FormField name="phone" label={t("phone")} type="tel" icon="phone" required invalid={isInvalid("phone")} />
                <FormField name="email" label={t("email")} type="email" icon="mail" />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-head-row">
              <div className="icon-badge round"><Icon name="calendar" /></div>
              <div className="form-section-head">
                <h3>{t("sectionApptDetails")}</h3>
                <p>{t("sectionApptDetailsDesc")}</p>
              </div>
            </div>
            <div className="form-section-body">
              <div className="field">
                <label className="required" htmlFor="appt-req-meeting-with">{t("apptStaffPickerLabel")}</label>
                <div className="field-icon-wrap">
                  <Icon name="users" />
                  <select
                    name="staffId"
                    id="appt-req-meeting-with"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                  >
                    <option value="">{t("apptStaffPickerAnyOption")}</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.role === "job_developer" ? t("roleJobDeveloper") : t("roleCaseManager")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!staffId && (
                <div className="field">
                  <label htmlFor="appt-req-meeting-with-role">{t("apptMeetingWithLabel")}</label>
                  <div className="field-icon-wrap">
                    <Icon name="users" />
                    <select name="meetingWith" id="appt-req-meeting-with-role" defaultValue="case_manager">
                      <option value="case_manager">{t("roleCaseManager")}</option>
                      <option value="job_developer">{t("roleJobDeveloper")}</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-2">
                <FormField name="date" label={t("apptPreferredDateLabel")} type="date" required invalid={isInvalid("date")} />
                <FormField name="time" label={t("apptPreferredTimeLabel")} type="time" required invalid={isInvalid("time")} />
              </div>
              <div className="field">
                <label htmlFor="checkin-field-reason">{t("apptReasonLabel")}</label>
                <div className="field-icon-wrap">
                  <Icon name="message" />
                  <textarea name="reason" id="checkin-field-reason" rows={3} style={{ paddingLeft: 42 }} />
                </div>
                <p className="muted" style={{ fontSize: ".82rem", margin: "6px 0 0 0" }}>{t("apptReasonHint")}</p>
              </div>
            </div>
          </div>

          <div className="info-callout">
            <Icon name="info" />
            <div>
              <strong>{t("apptWhatsNextTitle")}</strong>
              <p>{t("apptWhatsNextDesc")}</p>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block">
            <Icon name="send" /> {t("submitApptRequestBtn")}
          </button>
        </form>
      </div>
    </div>
  );
}
