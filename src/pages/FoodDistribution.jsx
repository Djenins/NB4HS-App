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
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  allDistributions, buildClient, buildImportedFoodClients, clientMatchesSearch, downloadFoodClientTemplate,
  exportFoodDistributionCSV, exportFoodDistributionExcel, exportFoodRosterCSV, exportFoodRosterExcel
} from "../lib/clients.js";
import { attachClientToProgram, findPossibleDuplicates } from "../lib/masterClients.js";
import { paginateList } from "../lib/pagination.js";
import { inRange, rangeForPreset } from "../lib/reports_data.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { formatPhone, todayStr, uid } from "../lib/utils.js";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FoodClientCard from "../components/FoodClientCard.jsx";
import Icon from "../components/Icon.jsx";
import Pagination from "../components/Pagination.jsx";
import StatCard from "../components/StatCard.jsx";
import { Button } from "../components/ui/button.jsx";

const HOUSEHOLD_SIZES = ["1", "2", "3", "4", "5", "6+"];

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", householdSize: "", intakeDate: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const EXPORT_PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const EXPORT_PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

function AddHouseholdDetails({ open, onToggle }) {
  const { data, setData, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState([]);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  function finalizeCreate(client, matchedClient) {
    setData((prev) => attachClientToProgram(prev, "food", client, matchedClient));
    setFields(EMPTY_NEW_CLIENT);
    setDupMatches(null);
    setPendingClient(null);
    showToast(t("foodClientAdded"));
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
    const client = buildClient("food", fields);
    if (!client) return;
    const matches = findPossibleDuplicates(fields, data.clients || []);
    if (matches.length) {
      setPendingClient(client);
      setDupMatches(matches);
      return;
    }
    finalizeCreate(client, null);
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="icon-badge round"><Icon name="user" /></span>
          {t("addFoodClientTitle")}
        </span>
      </summary>
      <div className="details-body">
        <div className="form-section">
          <div className="form-section-head-row">
            <div className="icon-badge round"><Icon name="user" /></div>
            <div className="form-section-head">
              <h3>{t("sectionPersonalDetails")}</h3>
              <p>{t("sectionPersonalDetailsDesc")}</p>
            </div>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <div className="field">
                <label htmlFor="new-food-client-first-name">{t("firstName")}</label>
                <div className="field-icon-wrap">
                  <Icon name="user" />
                  <input type="text" id="new-food-client-first-name" className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-last-name">{t("lastName")}</label>
                <div className="field-icon-wrap">
                  <Icon name="user" />
                  <input type="text" id="new-food-client-last-name" className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-phone">{t("phone")}</label>
                <div className="field-icon-wrap">
                  <Icon name="phone" />
                  <input type="tel" id="new-food-client-phone" className={errors.indexOf("phone") !== -1 ? "field-invalid" : ""} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-email">{t("email")}</label>
                <div className="field-icon-wrap">
                  <Icon name="mail" />
                  <input type="text" id="new-food-client-email" value={fields.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-household-size">{t("householdSizeLabel")}</label>
                <div className="field-icon-wrap">
                  <Icon name="users" />
                  <select id="new-food-client-household-size" value={fields.householdSize} onChange={(e) => setField("householdSize", e.target.value)}>
                    <option value="">{t("selectHouseholdSize")}</option>
                    {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div className="field"><label htmlFor="new-food-client-intake-date">{t("intakeDateLabel")}</label><DatePicker id="new-food-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-head-row">
            <div className="icon-badge round"><Icon name="mappin" /></div>
            <div className="form-section-head">
              <h3>{t("sectionAddress")}</h3>
              <p>{t("sectionAddressDesc")}</p>
            </div>
          </div>
          <div className="form-section-body">
            <div className="grid grid-3">
              <div className="field">
                <label htmlFor="new-food-client-street">{t("address")}</label>
                <div className="field-icon-wrap">
                  <Icon name="mappin" />
                  <input type="text" id="new-food-client-street" placeholder={t("streetAddressPlaceholder")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-city">{t("city")}</label>
                <div className="field-icon-wrap">
                  <Icon name="city" />
                  <input type="text" id="new-food-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-zip">{t("zip")}</label>
                <div className="field-icon-wrap">
                  <Icon name="hash" />
                  <input type="text" id="new-food-client-zip" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
                </div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="pill-row" style={{ marginTop: 4, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={() => setFields(EMPTY_NEW_CLIENT)}>{t("clearLabel")}</button>
          <button className="btn-primary" onClick={submit}><Icon name="plus" /> {t("addFoodClientBtn")}</button>
        </div>
      </div>
      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingClient(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingClient, matchedClient)}
          onCreateAnyway={() => finalizeCreate(pendingClient, null)}
          onCancel={() => { setDupMatches(null); setPendingClient(null); }}
        />
      )}
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
    // Bulk import has no UI for a per-row duplicate review -- silently
    // attach each imported household to the best existing master-client
    // match or create a new one, same as Case Management/Students imports.
    setData((prev) => {
      let next = prev;
      result.added.forEach((row) => {
        const matches = findPossibleDuplicates(row, next.clients || []);
        next = attachClientToProgram(next, "food", row, matches.length ? matches[0].client : null);
      });
      return next;
    });
    showToast(result.added.length + " " + t("householdsImported"));
  }

  function handleImportClick() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importRows, () => showToast(t("importError")));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="icon-badge round"><Icon name="cloudupload" /></span>
          {t("importHouseholdsTitle")}
        </span>
      </summary>
      <div className="details-body">
        <p className="muted">{t("importHouseholdsDesc")}</p>
        <div className="pill-row"><button className="btn-secondary" onClick={downloadFoodClientTemplate}><Icon name="download" /> {t("downloadHouseholdTemplate")}</button></div>
        <div className="grid grid-2" style={{ alignItems: "center" }}>
          <div className="field" style={{ marginBottom: 0 }}><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" /></div>
          <button className="btn-primary" onClick={handleImportClick}><Icon name="upload" /> {t("importBtn")}</button>
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
      <summary>
        <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="icon-badge round"><Icon name="download" /></span>
          {t("exportDataTitle")}
        </span>
      </summary>
      <div className="details-body">
        <h3 style={{ marginTop: 0 }}>{t("exportRosterTitle")}</h3>
        <p className="muted">{t("exportRosterDesc")}</p>
        <div className="pill-row">
          <button className="btn-secondary" onClick={exportRosterCSV}><Icon name="download" /> {t("exportCSV")}</button>
          <button className="btn-secondary" onClick={exportRosterExcel}><Icon name="download" /> {t("exportExcel")}</button>
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
          <button className="btn-secondary" onClick={exportLogCSV}><Icon name="download" /> {t("exportCSV")}</button>
          <button className="btn-secondary" onClick={exportLogExcel}><Icon name="download" /> {t("exportExcel")}</button>
        </div>
      </div>
    </details>
  );
}

export default function FoodDistribution() {
  const { data, setData, requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addHousehold: true, importHouseholds: false, exportData: false });
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const foodClients = data.foodClients || [];
  const term = search.trim().toLowerCase();
  let matched = foodClients.filter((c) => clientMatchesSearch("food", c, term));
  if (sizeFilter) matched = matched.filter((c) => (c.householdSize || "") === sizeFilter);
  const sorted = sortStudentsList(matched.map((c) => ({ firstName: c.firstName, lastName: c.lastName, __ref: c }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page, pageSize);
  const allOnPageSelected = paged.items.length > 0 && paged.items.every((c) => selected.has(c.id));

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.items.forEach((c) => next.delete(c.id));
      else paged.items.forEach((c) => next.add(c.id));
      return next;
    });
  }

  const monthRange = rangeForPreset("month");
  const dists = allDistributions(foodClients);
  const pickupsThisMonth = dists.filter((d) => inRange(d, monthRange.from, monthRange.to)).length;
  const avgHouseholdSize = foodClients.length
    ? (foodClients.reduce((sum, c) => sum + (parseFloat(c.householdSize) || 0), 0) / foodClients.length).toFixed(1)
    : 0;

  async function removeClient(id) {
    const ok = await requestConfirm(t("removeFoodClientConfirm"), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { foodClients: (prev.foodClients || []).filter((c) => c.id !== id) }));
  }

  async function removeSelected() {
    const ok = await requestConfirm(t("bulkDeleteConfirm").replace("{n}", String(selected.size)), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { foodClients: (prev.foodClients || []).filter((c) => !selected.has(c.id)) }));
    setSelected(new Set());
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
      <div className="page-header">
        <div className="icon-badge"><Icon name="fooddistribution" className="icon-lg" /></div>
        <div>
          <h1>{t("foodDistributionTitle")}</h1>
          <p className="muted">{t("foodDistributionDesc")}</p>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <StatCard icon="users" variant="violet" num={foodClients.length} label={t("totalHouseholdsLabel")} />
        <StatCard icon="cart" variant="success" num={pickupsThisMonth} label={t("pickupsThisMonthLabel")} />
        <StatCard icon="reports" num={dists.length} label={t("totalPickupsLabel")} />
        <StatCard icon="calendar" variant="warn" num={avgHouseholdSize} label={t("avgHouseholdSizeLabel")} />
      </div>

      <AddHouseholdDetails open={opens.addHousehold} onToggle={(v) => setOpen("addHousehold", v)} />
      <ImportHouseholdsDetails open={opens.importHouseholds} onToggle={(v) => setOpen("importHouseholds", v)} />
      <ExportDataDetails open={opens.exportData} onToggle={(v) => setOpen("exportData", v)} />

      <div className="card">
        <div className="student-search-bar" style={{ position: "relative" }}>
          <div className="field-icon-wrap" style={{ flex: 1, minWidth: 220 }}>
            <Icon name="search" />
            <input
              type="text" placeholder={t("foodClientSearchPlaceholder")} aria-label={t("foodClientSearchPlaceholder")}
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <button type="button" className="btn-secondary" onClick={() => setFiltersOpen((v) => !v)}>
              <Icon name="filter" /> {t("filtersLabel")} <Icon name="chevrondn" />
            </button>
            {filtersOpen && (
              <div className="date-picker-panel" style={{ right: 0, left: "auto", width: 220 }}>
                <div className="field">
                  <label htmlFor="food-size-filter">{t("householdSizeLabel")}</label>
                  <select
                    id="food-size-filter" value={sizeFilter}
                    onChange={(e) => { setSizeFilter(e.target.value); setPage(1); }}
                  >
                    <option value="">{t("allHouseholdSizes")}</option>
                    {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                {sizeFilter && (
                  <button type="button" className="btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => { setSizeFilter(""); setPage(1); }}>
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={removeSelected}><Trash2 className="h-3.5 w-3.5" />{t("deleteSelectedLabel")}</Button>
        </BulkActionsBar>

        {paged.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} aria-label={t("selectAllLabel")} /></th>
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
                    selected={selected.has(c.id)}
                    onToggleSelect={() => toggleSelect(c.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="fooddistribution" message={t("noFoodClientsYet")} />
        )}
        <Pagination
          page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelHouseholds")}
          onChange={(delta) => setPage(paged.page + delta)}
        />
      </div>
    </>
  );
}
