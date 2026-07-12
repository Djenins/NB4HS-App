// CaseManagement.jsx -- ported from clients.js's renderCaseManagement() +
// its attach* handlers. Uses the shared clients.js/appointments.js lib
// helpers and the AppointmentsSection/CaseClientCard/Pagination components.
import { useRef, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { CASE_SERVICES, IMMIGRATION_STATUSES } from "../lib/constants.js";
import { activeCaseManagers } from "../lib/appointments.js";
import { buildClient, buildImportedCaseClients, caseServiceLabel, clientMatchesSearch, downloadCaseClientTemplate, immigrationStatusLabel } from "../lib/clients.js";
import { paginateList } from "../lib/pagination.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { todayStr, uid } from "../lib/utils.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import CaseClientCard from "../components/CaseClientCard.jsx";
import DatePicker from "../components/DatePicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", immigrationStatus: "", intakeDate: "", dob: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

function AddClientDetails({ open, onToggle }) {
  const { data, lang, setData, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [services, setServices] = useState([]);
  const [errors, setErrors] = useState([]);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function toggleService(key) {
    setServices((prev) => (prev.indexOf(key) !== -1 ? prev.filter((k) => k !== key) : prev.concat([key])));
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
    const client = buildClient("case", fields, { services });
    if (!client) return;
    setData((prev) => Object.assign({}, prev, { caseClients: (prev.caseClients || []).concat([client]) }));
    setFields(EMPTY_NEW_CLIENT);
    setServices([]);
    showToast(t("clientAdded"));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("addClientTitle")}</summary>
      <div className="details-body">
        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionPersonalDetails")}</h3>
            <p>{t("sectionPersonalDetailsDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <div className="field"><label htmlFor="new-client-first-name">{t("firstName")}</label><input type="text" id="new-client-first-name" className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-client-last-name">{t("lastName")}</label><input type="text" id="new-client-last-name" className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-client-phone">{t("phone")}</label><input type="tel" id="new-client-phone" className={errors.indexOf("phone") !== -1 ? "field-invalid" : ""} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-client-email">{t("email")}</label><input type="text" id="new-client-email" value={fields.email} onChange={(e) => setField("email", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-client-intake-date">{t("intakeDateLabel")}</label><DatePicker id="new-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
              <div className="field"><label htmlFor="new-client-dob">{t("dobLabel")}</label><DatePicker id="new-client-dob" value={fields.dob} onChange={(v) => setField("dob", v)} /></div>
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
              <div className="field"><label htmlFor="new-client-street">{t("address")}</label><input type="text" id="new-client-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-client-city">{t("city")}</label><input type="text" id="new-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-client-zip">{t("zip")}</label><input type="text" id="new-client-zip" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionCaseDetails")}</h3>
            <p>{t("sectionCaseDetailsDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="field">
              <label htmlFor="new-client-immigration-status">{t("immigrationStatusLabel")}</label>
              <select id="new-client-immigration-status" value={fields.immigrationStatus} onChange={(e) => setField("immigrationStatus", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {IMMIGRATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{immigrationStatusLabel(s.key, lang)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t("clientServicesLabel")}</label>
              <div className="grid grid-3">
                {CASE_SERVICES.map((s) => (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, margin: "4px 0" }} key={s.key}>
                    <input type="checkbox" checked={services.indexOf(s.key) !== -1} onChange={() => toggleService(s.key)} />
                    {caseServiceLabel(s.key, lang)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pill-row" style={{ marginTop: 4 }}><button className="btn-primary" onClick={submit}>{t("addClientBtn")}</button></div>
      </div>
    </details>
  );
}

function ImportContactsDetails({ open, onToggle }) {
  const { setData, showToast } = useApp();
  const t = useT();
  const fileRef = useRef(null);

  function importRows(rows) {
    const result = buildImportedCaseClients(rows);
    if (!result) { showToast(t("importError")); return; }
    setData((prev) => Object.assign({}, prev, { caseClients: (prev.caseClients || []).concat(result.added) }));
    let msg = result.added.length + " " + t("clientsImported");
    const flags = [];
    if (result.unmatchedStatus) flags.push(result.unmatchedStatus + " " + t("unmatchedImmigrationStatus"));
    if (result.unmatchedSvc) flags.push(result.unmatchedSvc + " " + t("unmatchedServices"));
    if (flags.length) msg += " (" + flags.join("; ") + ")";
    showToast(msg);
  }

  function handleImportClick() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importRows, () => showToast(t("importError")));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("importContactsTitle")}</summary>
      <div className="details-body">
        <p className="muted">{t("importContactsDesc")}</p>
        <div className="pill-row"><button className="btn-secondary" onClick={downloadCaseClientTemplate}>{t("downloadClientTemplate")}</button></div>
        <div className="grid grid-2" style={{ alignItems: "center" }}>
          <div className="field" style={{ marginBottom: 0 }}><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" /></div>
          <button className="btn-primary" onClick={handleImportClick}>{t("importBtn")}</button>
        </div>
      </div>
    </details>
  );
}

export default function CaseManagement() {
  const { data, lang, setData, requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addClient: false, importContacts: false, appointments: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notesOpenId, setNotesOpenId] = useState(null);

  const term = search.trim().toLowerCase();
  const matched = (data.caseClients || []).filter((c) => clientMatchesSearch("case", c, term, lang));
  const sorted = sortStudentsList(matched.map((c) => ({ firstName: c.firstName, lastName: c.lastName, __ref: c }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page);

  async function removeClient(id) {
    const ok = await requestConfirm(t("removeClientConfirm"), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { caseClients: (prev.caseClients || []).filter((c) => c.id !== id) }));
  }

  function addNote(client, text) {
    setData((prev) => Object.assign({}, prev, {
      caseClients: (prev.caseClients || []).map((c) => (c.id === client.id ? Object.assign({}, c, { notes: (c.notes || []).concat([{ id: uid(), text, date: todayStr() }]) }) : c))
    }));
  }

  function setOpen(key, val) { setOpens((prev) => Object.assign({}, prev, { [key]: val })); }

  return (
    <>
      <h1>{t("caseManagementTitle")}</h1>
      <div className="card">
        <p className="muted">{t("caseManagementDesc")}</p>
        <div className="muted">{t("totalClientsLabel")}: {(data.caseClients || []).length}</div>
      </div>

      <AddClientDetails open={opens.addClient} onToggle={(v) => setOpen("addClient", v)} />
      <ImportContactsDetails open={opens.importContacts} onToggle={(v) => setOpen("importContacts", v)} />
      <AppointmentsSection
        open={opens.appointments}
        onToggle={(v) => setOpen("appointments", v)}
        meetingWith="case_manager"
        clientList={data.caseClients || []}
        staffList={activeCaseManagers(data.users)}
        staffLabelKey="apptCaseManagerLabel"
      />

      <div className="card">
        <div className="student-search-bar">
          <input type="text" placeholder={t("clientSearchPlaceholder")} aria-label={t("clientSearchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
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
                  <th>{t("immigrationStatusLabel")}</th>
                  <th>{t("intakeDateLabel")}</th>
                  <th>{t("actionsLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((c) => (
                  <CaseClientCard
                    key={c.id}
                    client={c}
                    open={notesOpenId === c.id}
                    onToggle={() => setNotesOpenId((cur) => (cur === c.id ? null : c.id))}
                    onRemove={() => removeClient(c.id)}
                    onAddNote={(text) => addNote(c, text)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="users" message={t("noClientsYet")} />
        )}
        <Pagination page={paged.page} totalPages={paged.totalPages} onChange={(delta) => setPage(paged.page + delta)} />
      </div>
    </>
  );
}
