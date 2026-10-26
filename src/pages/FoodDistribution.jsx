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
import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  allDistributions, buildImportedFoodClients, clientMatchesSearch, downloadFoodClientTemplate,
  exportFoodDistributionCSV, exportFoodDistributionExcel, exportFoodRosterCSV, exportFoodRosterExcel
} from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { createFoodClient, deleteFoodClient, fetchAllDistributions, subscribeClientsTable } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { inRange, rangeForPreset } from "../lib/reports_data.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { todayStr } from "../lib/utils.js";
import AddHouseholdCard from "../components/AddHouseholdCard.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FoodClientCard from "../components/FoodClientCard.jsx";
import Icon from "../components/Icon.jsx";
import Pagination from "../components/Pagination.jsx";
import StatCard from "../components/StatCard.jsx";
import { Button } from "../components/ui/button.jsx";

const HOUSEHOLD_SIZES = ["1", "2", "3", "4", "5", "6+"];

const EXPORT_PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const EXPORT_PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

function ImportHouseholdsDetails({ open, onToggle }) {
  const { data, showToast } = useApp();
  const t = useT();
  const fileRef = useRef(null);

  async function importRows(rows) {
    const result = buildImportedFoodClients(rows);
    if (!result) { showToast(t("importError")); return; }
    // Bulk import has no UI for a per-row duplicate review -- silently
    // attach each imported household to the best existing master-client
    // match or create a new one, same as Case Management/Students imports.
    for (const row of result.added) {
      const matches = findPossibleDuplicates(row, data.clients || []);
      await createFoodClient(row, row, matches.length ? matches[0].client.id : null);
    }
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
  const { data, requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addHousehold: true, importHouseholds: false, exportData: false });
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  // Distributions are their own table now (food_distributions), fetched
  // separately and re-attached here as `.distributions` on each household
  // so the existing lastDistributionDate()/allDistributions()/export
  // helpers (lib/clients.js) keep working unchanged -- see clientsData.js.
  const [allDists, setAllDists] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchAllDistributions().then((rows) => { if (!cancelled) setAllDists(rows); });
    const unsub = subscribeClientsTable("food_distributions", () => {
      fetchAllDistributions().then((rows) => { if (!cancelled) setAllDists(rows); });
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  const foodClients = (data.foodClients || []).map((c) => Object.assign({}, c, {
    distributions: allDists.filter((d) => d.foodClientId === c.id)
  }));
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
    await deleteFoodClient(id);
  }

  async function removeSelected() {
    const ok = await requestConfirm(t("bulkDeleteConfirm").replace("{n}", String(selected.size)), { danger: true });
    if (!ok) return;
    await Promise.all(Array.from(selected).map((id) => deleteFoodClient(id)));
    setSelected(new Set());
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

      <AddHouseholdCard open={opens.addHousehold} onToggle={(v) => setOpen("addHousehold", v)} />
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
