// FoodDistribution.jsx -- section for tracking households receiving food
// distribution and their pickup history. Structurally the same shape as
// CaseManagement.jsx (add-household form + searchable/paginated table of
// clients, click a name to expand history) using the "food" CLIENT_KIND
// added to clients.js -- deliberately left out: an appointments section (no
// scheduling need here) and any pickup frequency limit (per the client's
// answer: show history, no automatic restriction). Import (new households
// only) and export (household roster + a date-ranged distribution log)
// were added after the fact, mirroring Case Management's import and
// Reports' CSV/Excel export + date-range picker respectively.
import { useRef, useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  buildClient, buildImportedFoodClients, clientMatchesSearch, downloadFoodClientTemplate,
  exportFoodDistributionCSV, exportFoodDistributionExcel, exportFoodRosterCSV, exportFoodRosterExcel
} from "../lib/clients.js";
import { paginateList } from "../lib/pagination.js";
import { rangeForPreset } from "../lib/reports_data.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { todayStr, uid } from "../lib/utils.js";
import DatePicker from "../components/DatePicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FoodClientCard from "../components/FoodClientCard.jsx";
import Pagination from "../components/Pagination.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", householdSize: "", intakeDate: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const EXPORT_PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const EXPORT_PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

function AddHouseholdDetails({ open, onToggle }) {
  const { setData, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState([]);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  function submit() {
    const errs = ["firstName", "lastName"].filter((f) => !fields[f].trim());
    if (fields.phone.trim() && !PHONE_RE.test(fields.phone.trim())) errs.push("phone");
    if (errs.length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const client = buildClient("food", fields);
    if (!client) return;
    setData((prev) => Object.assign({}, prev, { foodClients: (prev.foodClients || []).concat([client]) }));
    setFields(EMPTY_NEW_CLIENT);
    showToast(t("foodClientAdded"));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("addFoodClientTitle")}</summary>
      <div className="details-body">
        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionPersonalDetails")}</h3>
            <p>{t("sectionPersonalDetailsDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <div className="field"><label htmlFor="new-food-client-first-name">{t("firstName")}</label><input type="text" id="new-food-client-first-name" className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-last-name">{t("lastName")}</label><input type="text" id="new-food-client-last-name" className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-phone">{t("phone")}</label><input type="tel" id="new-food-client-phone" className={errors.indexOf("phone") !== -1 ? "field-invalid" : ""} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-email">{t("email")}</label><input type="text" id="new-food-client-email" value={fields.email} onChange={(e) => setField("email", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-household-size">{t("householdSizeLabel")}</label><input type="number" min="1" id="new-food-client-household-size" value={fields.householdSize} onChange={(e) => setField("householdSize", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-intake-date">{t("intakeDateLabel")}</label><DatePicker id="new-food-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
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
              <div className="field"><label htmlFor="new-food-client-street">{t("address")}</label><input type="text" id="new-food-client-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-city">{t("city")}</label><input type="text" id="new-food-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} /></div>
              <div className="field"><label htmlFor="new-food-client-zip">{t("zip")}</label><input type="text" id="new-food-client-zip" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="pill-row" style={{ marginTop: 4 }}><button className="btn-primary" onClick={submit}>{t("addFoodClientBtn")}</button></div>
      </div>
    </details>
  );
}

function ImportHouseholdsDetails({ open, onToggle }) {
  const { setData, showToast } = useApp();
  const t = useT();
  const fileRef = useRef(null);

  function importRows(rows) {
    const result = buildImportedFoodClients(rows);
    if (!result) { showToast(t("importError")); return; }
    setData((prev) => Object.assign({}, prev, { foodClients: (prev.foodClients || []).concat(result.added) }));
    showToast(result.added.length + " " + t("householdsImported"));
  }

  function handleImportClick() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importRows, () => showToast(t("importError")));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("importHouseholdsTitle")}</summary>
      <div className="details-body">
        <p className="muted">{t("importHouseholdsDesc")}</p>
        <div className="pill-row"><button className="btn-secondary" onClick={downloadFoodClientTemplate}>{t("downloadHouseholdTemplate")}</button></div>
        <div className="grid grid-2">
          <div className="field"><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" /></div>
          <button className="btn-primary" onClick={handleImportClick}>{t("importBtn")}</button>
        </div>
      </div>
    </details>
  );
}

function ExportDataDetails({ open, onToggle }) {
  const { data, showToast } = useApp();
  const t = useT();
  const [preset, setPreset] = useState("month");
  const [customFrom, setCustomFrom] = useState(todayStr());
  const [customTo, setCustomTo] = useState(todayStr());

  const range = preset === "custom" ? { from: customFrom || todayStr(), to: customTo || todayStr() } : rangeForPreset(preset);
  const foodClients = data.foodClients || [];

  function exportRosterCSV() { exportFoodRosterCSV(foodClients); showToast(t("exportCSV") + " ✓"); }
  function exportRosterExcel() { exportFoodRosterExcel(foodClients); showToast(t("exportExcel") + " ✓"); }
  function exportLogCSV() { exportFoodDistributionCSV(foodClients, range); showToast(t("exportCSV") + " ✓"); }
  function exportLogExcel() { exportFoodDistributionExcel(foodClients, range); showToast(t("exportExcel") + " ✓"); }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("exportDataTitle")}</summary>
      <div className="details-body">
        <h3 style={{ marginTop: 0 }}>{t("exportRosterTitle")}</h3>
        <p className="muted">{t("exportRosterDesc")}</p>
        <div className="pill-row">
          <button className="btn-secondary" onClick={exportRosterCSV}>{t("exportCSV")}</button>
          <button className="btn-secondary" onClick={exportRosterExcel}>{t("exportExcel")}</button>
        </div>

        <h3>{t("exportDistributionLogTitle")}</h3>
        <p className="muted">{t("exportDistributionLogDesc")}</p>
        <div className="pill-row">
          {EXPORT_PRESETS.map((p) => (
            <button key={p} className={"pill" + (preset === p ? " active" : "")} onClick={() => setPreset(p)}>
              {t(EXPORT_PRESET_LABEL_KEY[p])}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="grid grid-2" style={{ marginTop: 10 }}>
            <div className="field"><label htmlFor="food-export-from">{t("filterDateFrom")}</label><DatePicker id="food-export-from" value={customFrom} onChange={setCustomFrom} /></div>
            <div className="field"><label htmlFor="food-export-to">{t("filterDateTo")}</label><DatePicker id="food-export-to" value={customTo} onChange={setCustomTo} /></div>
          </div>
        )}
        <div className="pill-row" style={{ marginTop: 14 }}>
          <button className="btn-secondary" onClick={exportLogCSV}>{t("exportCSV")}</button>
          <button className="btn-secondary" onClick={exportLogExcel}>{t("exportExcel")}</button>
        </div>
      </div>
    </details>
  );
}

export default function FoodDistribution() {
  const { data, setData, requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addHousehold: false, importHouseholds: false, exportData: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const term = search.trim().toLowerCase();
  const matched = (data.foodClients || []).filter((c) => clientMatchesSearch("food", c, term));
  const sorted = sortStudentsList(matched.map((c) => ({ firstName: c.firstName, lastName: c.lastName, __ref: c }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page);

  async function removeClient(id) {
    const ok = await requestConfirm(t("removeFoodClientConfirm"), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { foodClients: (prev.foodClients || []).filter((c) => c.id !== id) }));
  }

  function addDistribution(client, entry) {
    setData((prev) => Object.assign({}, prev, {
      foodClients: (prev.foodClients || []).map((c) => (c.id === client.id ? Object.assign({}, c, {
        distributions: (c.distributions || []).concat([{ id: uid(), date: entry.date || todayStr(), items: entry.items, quantity: entry.quantity }])
      }) : c))
    }));
  }

  function setOpen(key, val) { setOpens((prev) => Object.assign({}, prev, { [key]: val })); }

  return (
    <>
      <h1>{t("foodDistributionTitle")}</h1>
      <div className="card">
        <p className="muted">{t("foodDistributionDesc")}</p>
        <div className="muted">{t("totalHouseholdsLabel")}: {(data.foodClients || []).length}</div>
      </div>

      <AddHouseholdDetails open={opens.addHousehold} onToggle={(v) => setOpen("addHousehold", v)} />
      <ImportHouseholdsDetails open={opens.importHouseholds} onToggle={(v) => setOpen("importHouseholds", v)} />
      <ExportDataDetails open={opens.exportData} onToggle={(v) => setOpen("exportData", v)} />

      <div className="card">
        <div className="student-search-bar">
          <input type="text" placeholder={t("foodClientSearchPlaceholder")} aria-label={t("foodClientSearchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>

        {paged.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("nameLabel")}</th>
                  <th>{t("phoneLabel")}</th>
                  <th>{t("householdSizeLabel")}</th>
                  <th>{t("address")}</th>
                  <th>{t("lastDistributionLabel")}</th>
                  <th>{t("actionsLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((c) => (
                  <FoodClientCard
                    key={c.id}
                    client={c}
                    open={openId === c.id}
                    onToggle={() => setOpenId((cur) => (cur === c.id ? null : c.id))}
                    onRemove={() => removeClient(c.id)}
                    onAddDistribution={(entry) => addDistribution(c, entry)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="fooddistribution" message={t("noFoodClientsYet")} />
        )}
        <Pagination page={paged.page} totalPages={paged.totalPages} onChange={(delta) => setPage(paged.page + delta)} />
      </div>
    </>
  );
}
