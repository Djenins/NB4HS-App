// FoodDistribution.jsx -- section for tracking households receiving food
// distribution and their pickup history. Structurally the same shape as
// CaseManagement.jsx (add-household form + searchable/paginated table of
// clients, click a name to open the household's history) using the "food"
// CLIENT_KIND added to clients.js -- deliberately left out: an appointments
// section (no scheduling need here) and any pickup frequency limit (per the
// client's answer: show history, no automatic restriction). Import (new
// households only) and export (household roster + a date-ranged
// distribution log) were added after the fact, mirroring Case Management's
// import and Reports' CSV/Excel export + date-range picker respectively.
// Split into its own module menu (see SECTIONS below).
//
// On the NB4HS Operate design system (plans/ui-design-system.md, batch 3e):
// PageHeader, KpiCard row, collapsible SectionCards for the forms, and
// DataTables (stacked rows below lg) with each household's pickups in a
// Drawer. Data and behaviour are unchanged: every clients.js/clientsData.js
// helper is called exactly as before, and the duplicate check, bulk delete
// and per-row delete still confirm. From the stale PR #21 the Add a
// Household form takes per-field error text, a submitting state and a
// confirmation before Clear throws away what was typed; it keeps today's
// rules for what is required.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, FileUp, Home, LayoutGrid, Plus, Repeat, ShoppingBasket, Trash2, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import {
  allDistributions, buildClient, buildImportedFoodClients, clientDisplayName, clientMatchesSearch, downloadFoodClientTemplate,
  exportFoodDistributionCSV, exportFoodDistributionExcel, exportFoodRosterCSV, exportFoodRosterExcel
} from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { createFoodClient, deleteFoodClient, fetchAllDistributions, subscribeClientsTable } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { inRange, rangeForPreset } from "../lib/reports_data.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { fmtDateLong, formatPhone, todayStr } from "../lib/utils.js";
import AddressInput from "../components/AddressInput.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import FoodClientCard, { FoodClientDrawer, foodClientColumns } from "../components/FoodClientCard.jsx";
import ModuleNav from "../components/ModuleNav.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { CollapsibleSection } from "../components/ui/collapsible-section.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select } from "../components/ui/field.jsx";
import { FilterBar, FilterField } from "../components/ui/filter-bar.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { RangeBar } from "../components/ui/range-bar.jsx";
import { SearchInput } from "../components/ui/search-input.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { SegmentedControl } from "../components/ui/segmented-control.jsx";

const HOUSEHOLD_SIZES = ["1", "2", "3", "4", "5", "6+"];

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", householdSize: "", intakeDate: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const FIELD_IDS = { firstName: "new-food-client-first-name", lastName: "new-food-client-last-name", phone: "new-food-client-phone" };
const EXPORT_PRESETS = ["today", "week", "month", "quarter", "year", "custom"];
const EXPORT_PRESET_LABEL_KEY = { today: "today", week: "thisWeek", month: "thisMonth", quarter: "thisQuarter", year: "thisYear", custom: "custom" };

// One titled group of the Add a Household form: the title/description
// beside the fields from lg up (stacked below), as in Case Management.
function FormSection({ title, desc, children }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-line-subtle pb-6 last:border-b-0 last:pb-0 lg:grid-cols-3 lg:gap-6">
      <div>
        <h3 className="m-0 text-ui font-semibold text-card-foreground">{title}</h3>
        <p className="m-0 mt-1 text-meta text-muted">{desc}</p>
      </div>
      <div className="space-y-4 lg:col-span-2">{children}</div>
    </div>
  );
}

// The same rules as before the redesign: first and last name, and a phone
// number only if one was typed. Each failure gets its own message.
function validateHousehold(fields, t) {
  const errs = {};
  if (!fields.firstName.trim()) errs.firstName = t("fieldRequired");
  if (!fields.lastName.trim()) errs.lastName = t("fieldRequired");
  if (fields.phone.trim() && !PHONE_RE.test(fields.phone.trim())) errs.phone = t("invalidPhone");
  return errs;
}

function AddHouseholdCard({ collapsed, onToggle, forwardRef }) {
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

  // Editing a field clears that field's error, so a corrected entry stops
  // showing as wrong before the next submit re-runs the whole check.
  function setField(name, value) {
    setFields((prev) => Object.assign({}, prev, { [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = Object.assign({}, prev);
      delete next[name];
      return next;
    });
  }

  function reset() {
    setFields(EMPTY_NEW_CLIENT);
    setErrors({});
    setDupMatches(null);
    setPendingClient(null);
  }

  async function finalizeCreate(client, matchedClient) {
    setSubmitting(true);
    try {
      await createFoodClient(client, client, matchedClient ? matchedClient.id : null);
      reset();
      showToast(t("foodClientAdded"));
    } catch (err) {
      console.warn("createFoodClient failed", err);
      setDupMatches(null);
      setPendingClient(null);
      showToast(t("foodClientAddError"));
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (submitting) return;
    const errs = validateHousehold(fields, t);
    const invalid = Object.keys(errs);
    if (invalid.length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      // Take the keyboard to the first field that needs fixing.
      const first = document.getElementById(FIELD_IDS[invalid[0]]);
      if (first) first.focus();
      return;
    }
    setErrors({});
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

  // Clear asks first only when there's something to lose; an untouched
  // form just resets.
  async function clear() {
    const dirty = Object.keys(EMPTY_NEW_CLIENT).some((k) => String(fields[k] || "").trim());
    if (dirty && !(await requestConfirm(t("clearFormConfirm"), { confirmLabel: t("clearLabel") }))) return;
    reset();
  }

  // Wires a control to its Field's error text (Field renders it as
  // `<id>-error`), so a screen reader reads the error with the input.
  const errorProps = (name, id) => (errors[name] ? { "aria-invalid": true, "aria-describedby": id + "-error" } : {});

  return (
    <CollapsibleSection
      cardRef={forwardRef}
      title={t("addFoodClientTitle")}
      collapsed={collapsed}
      onToggle={onToggle}
      expandLabel={t("expandSectionLabel")}
      collapseLabel={t("collapseSectionLabel")}
      extra={dupMatches ? (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingClient(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingClient, matchedClient)}
          onCreateAnyway={() => finalizeCreate(pendingClient, null)}
          onCancel={() => { setDupMatches(null); setPendingClient(null); }}
        />
      ) : null}
    >
      <div className="space-y-6">
        <FormSection title={t("sectionPersonalDetails")} desc={t("sectionPersonalDetailsDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("firstName")} htmlFor="new-food-client-first-name" required error={errors.firstName}>
              <Input id="new-food-client-first-name" {...errorProps("firstName", "new-food-client-first-name")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
            </Field>
            <Field label={t("lastName")} htmlFor="new-food-client-last-name" required error={errors.lastName}>
              <Input id="new-food-client-last-name" {...errorProps("lastName", "new-food-client-last-name")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
            </Field>
            <Field label={t("phone")} htmlFor="new-food-client-phone" error={errors.phone}>
              <Input id="new-food-client-phone" type="tel" {...errorProps("phone", "new-food-client-phone")} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder={t("phPhone")} />
            </Field>
            <Field label={t("email")} htmlFor="new-food-client-email">
              <Input id="new-food-client-email" type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder={t("phEmail")} />
            </Field>
            <Field label={t("householdSizeLabel")} htmlFor="new-food-client-household-size">
              <Select id="new-food-client-household-size" value={fields.householdSize} onChange={(e) => setField("householdSize", e.target.value)}>
                <option value="">{t("selectHouseholdSize")}</option>
                {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
            </Field>
            <Field label={t("intakeDateLabel")} htmlFor="new-food-client-intake-date">
              <div className="ds-control"><DatePicker id="new-food-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t("address")} htmlFor="new-food-client-street" className="sm:col-span-2 xl:col-span-1">
              <AddressInput as={Input} id="new-food-client-street" placeholder={t("streetAddressPlaceholder")} value={fields.street} onChange={(e) => setField("street", e.target.value)} onAddressSelect={(a) => setFields((prev) => Object.assign({}, prev, { street: a.street, city: a.city || prev.city, zip: a.zip || prev.zip }))} />
            </Field>
            <Field label={t("city")} htmlFor="new-food-client-city">
              <Input id="new-food-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} />
            </Field>
            <Field label={t("zip")} htmlFor="new-food-client-zip">
              <Input id="new-food-client-zip" inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </Field>
          </div>
          <p className="m-0 text-meta text-muted">{t("stateAlwaysRI")}</p>
        </FormSection>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={clear} disabled={submitting}>{t("clearLabel")}</Button>
          <Button onClick={submit} loading={submitting}>
            {submitting ? null : <Plus className="h-4 w-4" aria-hidden="true" />}
            {submitting ? t("addingFoodClientBtn") : t("addFoodClientBtn")}
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function ImportHouseholdsCard({ collapsed, onToggle }) {
  const { data, showToast } = useApp();
  const t = useT();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");

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
    <CollapsibleSection
      title={t("importHouseholdsTitle")}
      description={collapsed ? null : t("importHouseholdsDesc")}
      collapsed={collapsed}
      onToggle={onToggle}
      expandLabel={t("expandSectionLabel")}
      collapseLabel={t("collapseSectionLabel")}
    >
      <Button variant="secondary" size="sm" onClick={downloadFoodClientTemplate}>
        <Download className="h-4 w-4" aria-hidden="true" />{t("downloadHouseholdTemplate")}
      </Button>
      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {/* The file input stays focusable (sr-only, not display:none) so the
            picker opens from the keyboard; the label draws the drop zone. */}
        <label className="flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-control border border-dashed border-border bg-card px-3 text-ui text-muted transition-colors duration-fast focus-within:border-primary focus-within:ring-2 hover:border-primary hover:text-card-foreground [@media(pointer:coarse)]:h-11">
          <FileUp className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{fileName || t("chooseFileFirst")}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
          />
        </label>
        <Button onClick={handleImportClick}>{t("importBtn")}</Button>
      </div>
    </CollapsibleSection>
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

  const exportButtons = (onCSV, onExcel) => (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={onCSV}><Download className="h-4 w-4" aria-hidden="true" />{t("exportCSV")}</Button>
      <Button variant="secondary" onClick={onExcel}><Download className="h-4 w-4" aria-hidden="true" />{t("exportExcel")}</Button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <SectionCard title={t("exportRosterTitle")} description={t("exportRosterDesc")}>
        {exportButtons(exportRosterCSV, exportRosterExcel)}
      </SectionCard>
      <SectionCard title={t("exportDistributionLogTitle")} description={t("exportDistributionLogDesc")}>
        <RangeBar
          idBase="food-export"
          className="mb-5"
          label={t("dateRangeLabel")}
          value={preset}
          onChange={setPreset}
          options={EXPORT_PRESETS.map((p) => ({ value: p, label: t(EXPORT_PRESET_LABEL_KEY[p]) }))}
          custom={{ from: customFrom, to: customTo, onFrom: setCustomFrom, onTo: setCustomTo, fromLabel: t("filterDateFrom"), toLabel: t("filterDateTo") }}
        />
        {exportButtons(exportLogCSV, exportLogExcel)}
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

// A pickup row's columns, shared by the dashboard's recent list and the
// full log; `withSize` adds the household size column the log shows.
function pickupColumns({ t, lang, byId, withSize }) {
  const name = (d) => (byId[d.clientId] ? clientDisplayName(byId[d.clientId]) : "—");
  return [
    { key: "date", header: t("date"), className: "whitespace-nowrap", cell: (d) => fmtDateLong(d.date, lang) },
    { key: "name", header: t("nameLabel"), cell: name },
    { key: "size", header: t("householdSizeLabel"), hidden: !withSize, cell: (d) => (byId[d.clientId] && byId[d.clientId].householdSize) || "—" },
    { key: "items", header: t("itemsLabel"), cell: (d) => d.items || "—" },
    { key: "qty", header: t("quantityLabel"), cell: (d) => d.quantity || "—" }
  ];
}

function PickupCard({ d, byId, lang, t }) {
  const c = byId[d.clientId];
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-ui font-semibold text-card-foreground">{c ? clientDisplayName(c) : "—"}</span>
        <span className="text-meta tabular-nums text-muted">{fmtDateLong(d.date, lang)}</span>
      </div>
      <div className="mt-1 break-words text-meta text-muted">
        {[d.items, d.quantity].filter(Boolean).join(" · ") || "—"}
      </div>
    </div>
  );
}

function indexById(foodClients) {
  const byId = {};
  foodClients.forEach((c) => { byId[c.id] = c; });
  return byId;
}

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
  const byId = indexById(foodClients);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("totalHouseholdsLabel")} value={foodClients.length} icon={Home} tone="violet" onClick={() => onNavigate("households")} />
        <KpiCard label={t("pickupsThisMonthLabel")} value={pickupsThisMonth} icon={ShoppingBasket} tone="success" onClick={() => onNavigate("distributions")} />
        <KpiCard label={t("totalPickupsLabel")} value={dists.length} icon={Repeat} tone="info" />
        <KpiCard label={t("avgHouseholdSizeLabel")} value={avgHouseholdSize} icon={Users} tone="warning" />
      </div>
      <SectionCard
        title={t("foodRecentPickupsTitle")}
        action={<Button variant="secondary" size="sm" onClick={() => onNavigate("distributions")}>{t("foodViewAllPickups")}</Button>}
      >
        <DataTable
          caption={t("foodRecentPickupsTitle")}
          columns={pickupColumns({ t, lang, byId })}
          rows={recent}
          getRowId={(d) => d.id}
          renderCard={(d) => <PickupCard d={d} byId={byId} lang={lang} t={t} />}
          empty={<EmptyState compact icon={ShoppingBasket} title={t("foodNoPickupsYet")} description={t("foodPickupsEmptyHint")} />}
        />
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
  const byId = indexById(foodClients);
  const rows = allDistributions(foodClients)
    .filter((d) => inRange(d, range.from, range.to))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paged = paginateList(rows, page, pageSize);

  return (
    <SectionCard title={t("exportDistributionLogTitle")}>
      <SegmentedControl
        className="mb-4"
        label={t("dateRangeLabel")}
        value={preset}
        onChange={(p) => { setPreset(p); setPage(1); }}
        options={LOG_PRESETS.map((p) => ({ value: p, label: t(EXPORT_PRESET_LABEL_KEY[p]) }))}
      />
      <DataTable
        caption={t("exportDistributionLogTitle")}
        columns={pickupColumns({ t, lang, byId, withSize: true })}
        rows={paged.items}
        getRowId={(d) => d.id}
        renderCard={(d) => <PickupCard d={d} byId={byId} lang={lang} t={t} />}
        empty={<EmptyState compact variant="no-results" title={t("foodNoPickupsInRange")} description={t("foodPickupsRangeHint")} />}
      />
      {paged.total ? (
        <Pagination
          bare
          page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelPickups")}
          onChange={(delta) => setPage(paged.page + delta)}
        />
      ) : null}
    </SectionCard>
  );
}

function FoodHouseholds({ foodClients }) {
  const { requestConfirm } = useApp();
  const t = useT();
  const [opens, setOpens] = useState({ addHousehold: false, importHouseholds: false });
  const [search, setSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openId, setOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const addRef = useRef(null);

  const term = search.trim().toLowerCase();
  let matched = foodClients.filter((c) => clientMatchesSearch("food", c, term));
  if (sizeFilter) matched = matched.filter((c) => (c.householdSize || "") === sizeFilter);
  const sorted = sortStudentsList(matched.map((c) => ({ firstName: c.firstName, lastName: c.lastName, __ref: c }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page, pageSize);
  const allOnPageSelected = paged.items.length > 0 && paged.items.every((c) => selected.has(c.id));
  // Looked up live so the drawer follows realtime edits and new pickups.
  const openClient = openId ? foodClients.find((c) => c.id === openId) || null : null;

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

  function scrollToAdd() {
    setOpen("addHousehold", true);
    addRef.current && addRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() { setSearch(""); setSizeFilter(""); setPage(1); }

  const columns = foodClientColumns({ t, onOpen: (c) => setOpenId(c.id), onRemove: (c) => removeClient(c.id) });

  const emptyState = foodClients.length ? (
    <EmptyState
      variant="no-results"
      title={t("foodHouseholdsNoResultsTitle")}
      description={t("foodHouseholdsNoResultsHint")}
      action={<Button variant="secondary" onClick={clearFilters}>{t("clearFilters")}</Button>}
    />
  ) : (
    <EmptyState
      icon={Home}
      title={t("noFoodClientsYet")}
      description={t("foodHouseholdsEmptyHint")}
      action={<Button onClick={scrollToAdd}><Plus className="h-4 w-4" aria-hidden="true" />{t("addFoodClientBtn")}</Button>}
    />
  );

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={scrollToAdd}><Plus className="h-4 w-4" aria-hidden="true" />{t("addFoodClientBtn")}</Button>
      </div>
      <AddHouseholdCard forwardRef={addRef} collapsed={!opens.addHousehold} onToggle={() => setOpen("addHousehold", !opens.addHousehold)} />
      <ImportHouseholdsCard collapsed={!opens.importHouseholds} onToggle={() => setOpen("importHouseholds", !opens.importHouseholds)} />

      <FilterBar
        className="mb-5"
        search={
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onClear={() => { setSearch(""); setPage(1); }}
            clearLabel={t("clearLabel")}
            placeholder={t("foodClientSearchPlaceholder")}
            aria-label={t("foodClientSearchPlaceholder")}
          />
        }
        activeCount={sizeFilter ? 1 : 0}
        canClear={!!(sizeFilter || search)}
        onClear={clearFilters}
        clearLabel={t("clearFilters")}
        filtersLabel={t("filtersLabel")}
        gridClassName="sm:grid-cols-2 lg:grid-cols-3"
      >
        <FilterField label={t("householdSizeLabel")} htmlFor="food-size-filter">
          <Select id="food-size-filter" value={sizeFilter} onChange={(e) => { setSizeFilter(e.target.value); setPage(1); }}>
            <option value="">{t("allHouseholdSizes")}</option>
            {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      <Card className="p-4 sm:p-5">
        <p className="m-0 mb-3 text-ui tabular-nums text-muted" aria-live="polite">
          {t("showingResultsLabel").replace("{shown}", String(paged.items.length)).replace("{total}", String(paged.total))}
        </p>

        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="danger" size="sm" onClick={removeSelected}><Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteSelectedLabel")}</Button>
        </BulkActionsBar>

        <DataTable
          caption={t("foodSectionHouseholds")}
          columns={columns}
          rows={paged.items}
          getRowId={(c) => c.id}
          selection={{
            selected,
            onToggle: toggleSelect,
            onToggleAll: toggleSelectAll,
            allLabel: t("selectAllLabel"),
            rowLabel: (c) => clientDisplayName(c)
          }}
          renderCard={(c) => <FoodClientCard client={c} onOpen={() => setOpenId(c.id)} onRemove={() => removeClient(c.id)} />}
          empty={emptyState}
        />

        {paged.total ? (
          <Pagination
            bare
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelHouseholds")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        ) : null}
      </Card>

      <FoodClientDrawer client={openClient} onClose={() => setOpenId(null)} />
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
