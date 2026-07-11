// JobDeveloper.jsx -- ported from clients.js's renderJobDeveloper() + its
// attach* handlers. Structurally the mirror of CaseManagement.jsx (shared
// clients.js/appointments.js lib helpers), with the job-client-specific
// fields (work permit, resume upload) instead of immigration status/services.
import { useRef, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { buildClient, clientMatchesSearch } from "../lib/clients.js";
import { paginateList } from "../lib/pagination.js";
import { sortStudentsList } from "../lib/students.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import DatePicker from "../components/DatePicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import JobClientCard from "../components/JobClientCard.jsx";
import Pagination from "../components/Pagination.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", intakeDate: "", street: "", city: "", zip: "", workPermit: "no", workPermitExpiration: "", hasResume: "no" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

function AddJobClientDetails({ open, onToggle }) {
  const { setData, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState([]);
  const fileRef = useRef(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  function finishAdd(extra) {
    const client = buildClient("job", {
      firstName: fields.firstName, lastName: fields.lastName, phone: fields.phone, email: fields.email, intakeDate: fields.intakeDate,
      street: fields.street, city: fields.city, zip: fields.zip,
      workPermit: fields.workPermit === "yes",
      workPermitExpiration: fields.workPermit === "yes" ? fields.workPermitExpiration : "",
      hasResume: fields.hasResume === "yes"
    }, extra || {});
    if (!client) return;
    setData((prev) => Object.assign({}, prev, { jobClients: (prev.jobClients || []).concat([client]) }));
    setFields(EMPTY_NEW_CLIENT);
    if (fileRef.current) fileRef.current.value = "";
    showToast(t("jobClientAdded"));
  }

  function submit() {
    const errs = ["firstName", "lastName"].filter((f) => !fields[f].trim());
    if (fields.phone.trim() && !PHONE_RE.test(fields.phone.trim())) errs.push("phone");
    if (errs.length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const file = fields.hasResume === "yes" && fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => finishAdd({ resumeDataUri: e.target.result, resumeFileName: file.name });
      reader.onerror = () => finishAdd({});
      reader.readAsDataURL(file);
    } else {
      finishAdd({});
    }
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("addJobClientTitle")}</summary>
      <div className="details-body">
        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionPersonalDetails")}</h3>
            <p>{t("sectionPersonalDetailsDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <div className="field"><label htmlFor="new-job-client-first-name">{t("firstName")}</label><input type="text" id="new-job-client-first-name" className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-job-client-last-name">{t("lastName")}</label><input type="text" id="new-job-client-last-name" className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-job-client-phone">{t("phone")}</label><input type="tel" id="new-job-client-phone" className={errors.indexOf("phone") !== -1 ? "field-invalid" : ""} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-job-client-email">{t("email")}</label><input type="text" id="new-job-client-email" value={fields.email} onChange={(e) => setField("email", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-job-client-intake-date">{t("intakeDateLabel")}</label><DatePicker id="new-job-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionAddress")}</h3>
            <p>{t("sectionAddressDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-3">
              <div className="field"><label htmlFor="new-job-client-street">{t("address")}</label><input type="text" id="new-job-client-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-job-client-city">{t("city")}</label><input type="text" id="new-job-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-job-client-zip">{t("zip")}</label><input type="text" id="new-job-client-zip" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionJobDetails")}</h3>
            <p>{t("sectionJobDetailsDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="new-job-client-work-permit">{t("workPermitLabel")}</label>
                <select id="new-job-client-work-permit" value={fields.workPermit} onChange={(e) => setField("workPermit", e.target.value)}>
                  <option value="no">{t("noOption")}</option>
                  <option value="yes">{t("yesOption")}</option>
                </select>
              </div>
              {fields.workPermit === "yes" && (
                <div className="field">
                  <label htmlFor="new-job-client-work-permit-expiration">{t("workPermitExpirationLabel")}</label>
                  <DatePicker id="new-job-client-work-permit-expiration" value={fields.workPermitExpiration} onChange={(v) => setField("workPermitExpiration", v)} />
                </div>
              )}
            </div>
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="new-job-client-has-resume">{t("resumeQuestionLabel")}</label>
                <select id="new-job-client-has-resume" value={fields.hasResume} onChange={(e) => setField("hasResume", e.target.value)}>
                  <option value="no">{t("noOption")}</option>
                  <option value="yes">{t("yesOption")}</option>
                </select>
              </div>
              {fields.hasResume === "yes" && (
                <div className="field">
                  <label htmlFor="new-job-client-resume-file">{t("uploadResumeLabel")}</label>
                  <input ref={fileRef} type="file" id="new-job-client-resume-file" accept=".pdf,.doc,.docx" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pill-row" style={{ marginTop: 4 }}><button className="btn-primary" onClick={submit}>{t("addJobClientBtn")}</button></div>
      </div>
    </details>
  );
}

export default function JobDeveloper() {
  const { data, requestConfirm, setData } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addJobClient: false, appointments: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const matched = (data.jobClients || []).filter((c) => clientMatchesSearch("job", c, term));
  const sorted = sortStudentsList(matched.map((c) => ({ firstName: c.firstName, lastName: c.lastName, __ref: c }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page);

  function setOpen(key, val) { setOpens((prev) => Object.assign({}, prev, { [key]: val })); }

  async function removeClient(id) {
    const ok = await requestConfirm(t("removeJobClientConfirm"), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { jobClients: (prev.jobClients || []).filter((c) => c.id !== id) }));
  }

  return (
    <>
      <h1>{t("jobDeveloperTitle")}</h1>
      <div className="card">
        <p className="muted">{t("jobDeveloperDesc")}</p>
        <div className="muted">{t("totalJobClientsLabel")}: {(data.jobClients || []).length}</div>
      </div>

      <AddJobClientDetails open={opens.addJobClient} onToggle={(v) => setOpen("addJobClient", v)} />
      <AppointmentsSection
        open={opens.appointments}
        onToggle={(v) => setOpen("appointments", v)}
        meetingWith="job_developer"
        clientList={data.jobClients || []}
        staffList={activeJobDevelopers(data.users)}
        staffLabelKey="apptJobDeveloperLabel"
      />

      <div className="card">
        <div className="student-search-bar">
          <input type="text" placeholder={t("jobClientSearchPlaceholder")} aria-label={t("jobClientSearchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        {paged.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("nameLabel")}</th>
                  <th>{t("phoneLabel")}</th>
                  <th>{t("emailLabel")}</th>
                  <th>{t("address")}</th>
                  <th>{t("workPermitLabel")}</th>
                  <th>{t("resumeLabel")}</th>
                  <th>{t("intakeDateLabel")}</th>
                  <th>{t("actionsLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((c) => <JobClientCard key={c.id} client={c} onRemove={() => removeClient(c.id)} />)}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="jobdeveloper" message={t("noJobClientsYet")} />
        )}
        <Pagination page={paged.page} totalPages={paged.totalPages} onChange={(delta) => setPage(paged.page + delta)} />
      </div>
    </>
  );
}
