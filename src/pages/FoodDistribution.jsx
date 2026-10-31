// FoodDistribution.jsx -- section for tracking households receiving food
// distribution and their pickup history. Structurally the same shape as
// CaseManagement.jsx (add-household form + searchable/paginated table of
// clients, click a name to expand history) using the "food" CLIENT_KIND
// added to clients.js -- deliberately left out: an appointments section (no
// scheduling need here) and any pickup frequency limit (per the client's
// answer: show history, no automatic restriction). Import (new households
// only) and export (household roster + a date-ranged distribution log)
// were added after the fact, mirroring Case Management's import and
// Reports' CSV/Excel export + date-range picker respectively. Now split
// into its own module menu (see SECTIONS below).
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BarChart3, ChevronDown, Download, Filter, Home, LayoutGrid, Plus, Ruler, ShoppingBasket, ShoppingCart, Trash2, Upload, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  allDistributions, buildClient, buildImportedFoodClients, clientMatchesSearch, downloadFoodClientTemplate,
  exportFoodDistributionCSV, exportFoodDistributionExcel, exportFoodRosterCSV, exportFoodRosterExcel
} from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { createFoodClient, deleteFoodClient, fetchAllDistributions, subscribeClientsTable } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { inRange, rangeForPreset } from "../lib/reports_data.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { fmtDateLong, formatPhone, todayStr } from "../lib/utils.js";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import EmptyState from "../components/EmptyState.jsx";
import FoodClientCard from "../components/FoodClientCard.jsx";
import Icon from "../components/Icon.jsx";
import ModuleNav from "../components/ModuleNav.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { FilterChips } from "../components/ui/filter-chips.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { cn } from "../lib/cn.js";
import AddressInput from "../components/AddressInput.jsx";

const HOUSEHOLD_SIZES = ["1", "2", "3", "4", "5", "6+"];

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", householdSize: "", intakeDate: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const EXPORT_PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const EXPORT_PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

// A collapsible card for the add/import forms above the household list:
// native <details> (keyboard and screen reader behaviour for free) on the
// card surface, with a chevron that turns when it opens.
function Disclosure({ open, onToggle, icon: DisclosureIcon, title, children }) {
  return (
    <details
      className="group mb-4 overflow-hidden rounded-surface border border-border bg-card shadow-card"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
    >
      <summary className="flex min-h-[64px] cursor-pointer list-none items-center gap-3 px-5 py-3 text-section font-semibold text-card-foreground transition-colors duration-fast hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 group-open:border-b group-open:border-border sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-primary-tint text-primary">
          <DisclosureIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform duration-fast group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </details>
  );
}

function AddHouseholdDetails({ open, onToggle }) {
  const { data, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState([]);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function finalizeCreate(client, matchedClient) {
    await createFoodClient(client, client, matchedClient ? matchedClient.id : null);
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
    <Disclosure open={open} onToggle={onToggle} icon={Plus} title={t("addFoodClientTitle")}>
      <div>
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
                  <input type="text" id="new-food-client-first-name" placeholder={t("phFirstName")} className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-last-name">{t("lastName")}</label>
                <div className="field-icon-wrap">
                  <Icon name="user" />
                  <input type="text" id="new-food-client-last-name" placeholder={t("phLastName")} className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-phone">{t("phone")}</label>
                <div className="field-icon-wrap">
                  <Icon name="phone" />
                  <input type="tel" id="new-food-client-phone" placeholder={t("phPhone")} className={errors.indexOf("phone") !== -1 ? "field-invalid" : ""} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-email">{t("email")}</label>
                <div className="field-icon-wrap">
                  <Icon name="mail" />
                  <input type="text" id="new-food-client-email" placeholder={t("phEmail")} value={fields.email} onChange={(e) => setField("email", e.target.value)} />
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
                  <AddressInput type="text" id="new-food-client-street" placeholder={t("streetAddressPlaceholder")} value={fields.street} onChange={(e) => setField("street", e.target.value)} onAddressSelect={(a) => { setField("street", a.street); if (a.city) setField("city", a.city); if (a.zip) setField("zip", a.zip); }} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-city">{t("city")}</label>
                <div className="field-icon-wrap">
                  <Icon name="city" />
                  <input type="text" id="new-food-client-city" placeholder={t("phCity")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="new-food-client-zip">{t("zip")}</label>
                <div className="field-icon-wrap">
                  <Icon name="hash" />
                  <input type="text" id="new-food-client-zip" placeholder={t("phZip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
                </div>
              </div>
            </div>
            <p className="m-0 text-meta text-muted">{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setFields(EMPTY_NEW_CLIENT)}>{t("clearLabel")}</Button>
          <Button onClick={submit}><Plus className="h-4 w-4" aria-hidden="true" />{t("addFoodClientBtn")}</Button>
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
    </Disclosure>
  );
}

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
    <Disclosure open={open} onToggle={onToggle} icon={Upload} title={t("importHouseholdsTitle")}>
      <p className="m-0 max-w-[65ch] text-body text-muted">{t("importHouseholdsDesc")}</p>
      <div className="mt-4">
        <Button variant="secondary" onClick={downloadFoodClientTemplate}><Download className="h-4 w-4" aria-hidden="true" />{t("downloadHouseholdTemplate")}</Button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="food-import-file" className="sr-only">{t("importHouseholdsTitle")}</label>
        <input id="food-import-file" ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="min-h-0 min-w-0 flex-1 text-ui text-card-foreground file:mr-3 file:h-10 file:cursor-pointer file:rounded-control file:border file:border-solid file:border-secondary-border file:bg-card file:px-4 file:text-ui file:font-semibold file:text-navy hover:file:bg-primary-tint" />
        <Button onClick={handleImportClick}><Upload className="h-4 w-4" aria-hidden="true" />{t("importBtn")}</Button>
      </div>
    </Disclosure>
  );
}

function ExportData() {
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
    <div className="grid gap-6">
      <SectionCard title={t("exportRosterTitle")} description={t("exportRosterDesc")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportRosterCSV}><Download className="h-4 w-4" aria-hidden="true" />{t("exportCSV")}</Button>
          <Button variant="secondary" onClick={exportRosterExcel}><Download className="h-4 w-4" aria-hidden="true" />{t("exportExcel")}</Button>
        </div>
      </SectionCard>

      <SectionCard title={t("exportDistributionLogTitle")} description={t("exportDistributionLogDesc")}>
        <FilterChips
          label={t("exportDistributionLogTitle")}
          value={preset}
          onChange={setPreset}
          options={EXPORT_PRESETS.map((p) => ({ value: p, label: t(EXPORT_PRESET_LABEL_KEY[p]) }))}
        />
        {preset === "custom" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="field"><label htmlFor="food-export-from">{t("filterDateFrom")}</label><DatePicker id="food-export-from" value={customFrom} onChange={setCustomFrom} /></div>
            <div className="field"><label htmlFor="food-export-to">{t("filterDateTo")}</label><DatePicker id="food-export-to" value={customTo} onChange={setCustomTo} /></div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportLogCSV}><Download className="h-4 w-4" aria-hidden="true" />{t("exportCSV")}</Button>
          <Button variant="secondary" onClick={exportLogExcel}><Download className="h-4 w-4" aria-hidden="true" />{t("exportExcel")}</Button>
        </div>
      </SectionCard>
    </div>
  );
}

// The module's own menu (ModuleNav, same strip as Outreach/Workforce and
// Case Management): Dashboard / Households / Distributions / Export, one URL
// per section (/food/:section).
const SECTIONS = [
  { key: "dashboard", label: "snapSectionDashboard", icon: LayoutGrid },
  { key: "households", label: "foodSectionHouseholds", icon: Home },
  { key: "distributions", label: "foodSectionDistributions", icon: ShoppingBasket },
  { key: "export", label: "exportDataTitle", icon: Download }
];
const LOG_PRESETS = ["week", "month", "quarter", "year"];

function FoodDashboard({ foodClients, onNavigate }) {
  const { lang } = useApp();
  const t = useT();
  const monthRange = rangeForPreset("month");
  const dists = allDistributions(foodClients);
  const pickupsThisMonth = dists.filter((d) => inRange(d, monthRange.from, monthRange.to)).length;
  const avgHouseholdSize = foodClients.length
    ? (foodClients.reduce((sum, c) => sum + (parseFloat(c.householdSize) || 0), 0) / foodClients.length).toFixed(1)
    : 0;
  const recent = dists.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
  const byId = {};
  foodClients.forEach((c) => { byId[c.id] = c; });

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("totalHouseholdsLabel")} value={foodClients.length} icon={Users} tone="violet" onClick={() => onNavigate("households")} />
        <KpiCard label={t("pickupsThisMonthLabel")} value={pickupsThisMonth} icon={ShoppingCart} tone="success" onClick={() => onNavigate("distributions")} />
        <KpiCard label={t("totalPickupsLabel")} value={dists.length} icon={BarChart3} tone="info" />
        <KpiCard label={t("avgHouseholdSizeLabel")} value={avgHouseholdSize} icon={Ruler} tone="warning" />
      </div>
      <SectionCard
        title={t("foodRecentPickupsTitle")}
        action={<Button variant="secondary" size="sm" onClick={() => onNavigate("distributions")}>{t("foodViewAllPickups")}</Button>}
      >
        {recent.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("date")}</th><th>{t("nameLabel")}</th><th>{t("itemsLabel")}</th><th>{t("quantityLabel")}</th></tr></thead>
              <tbody>
                {recent.map((d) => {
                  const c = byId[d.clientId];
                  return (
                    <tr key={d.id}>
                      <td>{fmtDateLong(d.date, lang)}</td>
                      <td>{c ? c.firstName + " " + c.lastName : "—"}</td>
                      <td>{d.items || "—"}</td>
                      <td>{d.quantity || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="fooddistribution" message={t("foodNoPickupsYet")} />
        )}
      </SectionCard>
    </>
  );
}

function DistributionLog({ foodClients }) {
  const { lang } = useApp();
  const t = useT();
  const [preset, setPreset] = useState("month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const range = rangeForPreset(preset);
  const byId = {};
  foodClients.forEach((c) => { byId[c.id] = c; });
  const rows = allDistributions(foodClients)
    .filter((d) => inRange(d, range.from, range.to))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paged = paginateList(rows, page, pageSize);

  return (
    <SectionCard title={t("exportDistributionLogTitle")}>
      <FilterChips
        label={t("exportDistributionLogTitle")}
        value={preset}
        onChange={(p) => { setPreset(p); setPage(1); }}
        options={LOG_PRESETS.map((p) => ({ value: p, label: t(EXPORT_PRESET_LABEL_KEY[p]) }))}
      />
      {paged.items.length ? (
        <div className="table-wrap mt-4">
          <table>
            <thead><tr><th>{t("date")}</th><th>{t("nameLabel")}</th><th>{t("householdSizeLabel")}</th><th>{t("itemsLabel")}</th><th>{t("quantityLabel")}</th></tr></thead>
            <tbody>
              {paged.items.map((d) => {
                const c = byId[d.clientId];
                return (
                  <tr key={d.id}>
                    <td>{fmtDateLong(d.date, lang)}</td>
                    <td>{c ? c.firstName + " " + c.lastName : "—"}</td>
                    <td>{c && c.householdSize ? c.householdSize : "—"}</td>
                    <td>{d.items || "—"}</td>
                    <td>{d.quantity || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="fooddistribution" message={t("foodNoPickupsInRange")} />
      )}
      <Pagination
        page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
        onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelPickups")}
        onChange={(delta) => setPage(paged.page + delta)}
      />
    </SectionCard>
  );
}

function FoodHouseholds({ foodClients }) {
  const { requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addHousehold: false, importHouseholds: false });
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

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
      <AddHouseholdDetails open={opens.addHousehold} onToggle={(v) => setOpen("addHousehold", v)} />
      <ImportHouseholdsDetails open={opens.importHouseholds} onToggle={(v) => setOpen("importHouseholds", v)} />

      <Card className="p-4 sm:p-5">
        <div className="student-search-bar" style={{ position: "relative" }}>
          <div className="field-icon-wrap" style={{ flex: 1, minWidth: 220 }}>
            <Icon name="search" />
            <input
              type="text" placeholder={t("foodClientSearchPlaceholder")} aria-label={t("foodClientSearchPlaceholder")}
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <Button variant="secondary" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
              <Filter className="h-4 w-4" aria-hidden="true" />{t("filtersLabel")}{sizeFilter ? " (1)" : ""}
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-fast", filtersOpen && "rotate-180")} aria-hidden="true" />
            </Button>
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
                  <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => { setSizeFilter(""); setPage(1); }}>
                    {t("clearFilters")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={removeSelected}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{t("deleteSelectedLabel")}</Button>
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
      </Card>
    </>
  );
}

export default function FoodDistribution() {
  const { data } = useApp();
  const t = useT();
  const params = useParams();
  const navigate = useNavigate();
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
  const section = SECTIONS.some((s) => s.key === params.section) ? params.section : "dashboard";
  const go = (key) => navigate("/food/" + key);

  return (
    <>
      <ModuleNav
        label={t("navFoodDistribution")}
        items={SECTIONS.map((s) => ({ key: s.key, label: t(s.label), icon: s.icon }))}
        value={section}
        onChange={go}
      />
      <PageHeader title={t("foodDistributionTitle")} description={t("foodDistributionDesc")} />

      {section === "dashboard" && <FoodDashboard foodClients={foodClients} onNavigate={go} />}
      {section === "households" && <FoodHouseholds foodClients={foodClients} />}
      {section === "distributions" && <DistributionLog foodClients={foodClients} />}
      {section === "export" && <ExportData />}
    </>
  );
}
