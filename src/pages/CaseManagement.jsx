// CaseManagement.jsx -- Tailwind/shadcn redesign pass (same idiom as
// Students.jsx/Search.jsx/Dashboard.jsx), reusing every existing
// clients.js/appointments.js lib helper and the AppointmentsSection/
// CaseClientCard/Pagination/DatePicker components as-is. Only the
// presentation layer changed: the three <details className="card">
// accordions became collapsible Cards, and legacy .field/.grid form
// markup became Tailwind form-section layouts matching Students.jsx's
// EnrollStudentPanel idiom.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock, CalendarPlus, ChevronDown, ChevronUp, Clock3, Download, FileUp, Mail,
  Phone, Plus, Search as SearchIcon, SlidersHorizontal, Trash2, UploadCloud, UserPlus, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { CASE_SERVICES, IMMIGRATION_STATUSES } from "../lib/constants.js";
import { activeCaseManagers } from "../lib/appointments.js";
import { buildClient, buildImportedCaseClients, caseServiceLabel, clientMatchesSearch, downloadCaseClientTemplate, immigrationStatusLabel } from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { createCaseClient, deleteCaseClient } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { cn } from "../lib/cn.js";
import { formatPhone, todayStr } from "../lib/utils.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import CaseClientCard from "../components/CaseClientCard.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import EmptyState from "../components/EmptyState.jsx";
import IntakeFormCard from "../components/IntakeFormCard.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", immigrationStatus: "", intakeDate: "", dob: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

function KpiStat({ icon: Icon, tint, label, value }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + tint}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-muted">{label}</div>
          <div className="mt-1 text-2xl font-extrabold tracking-tight text-card-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// Collapsible Card header shared by the Add a Client/Import Contacts cards
// (AppointmentsSection renders its own header since it also needs the
// "Schedule an Appointment" sub-heading/side panel inside).
function SectionCardHeader({ icon: Icon, title, collapsed, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex min-h-0 w-full items-center gap-3 border-0 bg-transparent p-0 text-left"
    >
      {collapsed ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted" />}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <CardTitle className="m-0">{title}</CardTitle>
    </button>
  );
}

function FormSection({ title, desc, children }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-border pb-6 last:border-b-0 last:pb-0 md:grid-cols-[220px_1fr]">
      <div>
        <h3 className="m-0 text-sm font-bold text-card-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted">{desc}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextField({ id, label, required, invalid, value, onChange, placeholder, type }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      <input
        id={id}
        type={type || "text"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "h-11 min-h-0 w-full rounded-lg border bg-background px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/15",
          invalid ? "border-accent bg-tint-danger" : "border-border focus:border-primary"
        )}
      />
    </div>
  );
}

function AddClientCard({ collapsed, onToggle, forwardRef }) {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [services, setServices] = useState([]);
  const [errors, setErrors] = useState([]);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function toggleService(key) {
    setServices((prev) => (prev.indexOf(key) !== -1 ? prev.filter((k) => k !== key) : prev.concat([key])));
  }

  async function finalizeCreate(client, matchedClient) {
    await createCaseClient(client, client, matchedClient ? matchedClient.id : null);
    setFields(EMPTY_NEW_CLIENT);
    setServices([]);
    setDupMatches(null);
    setPendingClient(null);
    showToast(t("clientAdded"));
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
    const matches = findPossibleDuplicates(fields, data.clients || []);
    if (matches.length) {
      setPendingClient(client);
      setDupMatches(matches);
      return;
    }
    finalizeCreate(client, null);
  }

  return (
    <Card ref={forwardRef} className="mb-5">
      <CardHeader className="space-y-0">
        <SectionCardHeader icon={UserPlus} title={t("addClientTitle")} collapsed={collapsed} onToggle={onToggle} />
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6 pt-0">
          <FormSection title={t("sectionPersonalDetails")} desc={t("sectionPersonalDetailsDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="new-client-first-name" label={t("firstName")} required invalid={errors.indexOf("firstName") !== -1} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
              <TextField id="new-client-last-name" label={t("lastName")} required invalid={errors.indexOf("lastName") !== -1} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
              <TextField id="new-client-phone" label={t("phone")} invalid={errors.indexOf("phone") !== -1} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder="(401) 123-4567" />
              <TextField id="new-client-email" label={t("email")} value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder="name@example.com" />
              <div>
                <label htmlFor="new-client-intake-date" className="mb-1 block text-xs font-semibold text-card-foreground">{t("intakeDateLabel")}</label>
                <DatePicker id="new-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} />
              </div>
              <div>
                <label htmlFor="new-client-dob" className="mb-1 block text-xs font-semibold text-card-foreground">{t("dobLabel")}</label>
                <DatePicker id="new-client-dob" value={fields.dob} onChange={(v) => setField("dob", v)} />
              </div>
            </div>
          </FormSection>

          <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-client-street" label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
              <TextField id="new-client-city" label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
              <TextField id="new-client-zip" label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </div>
            <p className="text-xs text-muted">{t("stateAlwaysRI")}</p>
          </FormSection>

          <FormSection title={t("sectionCaseDetails")} desc={t("sectionCaseDetailsDesc")}>
            <div>
              <label htmlFor="new-client-immigration-status" className="mb-1 block text-xs font-semibold text-card-foreground">{t("immigrationStatusLabel")}</label>
              <select
                id="new-client-immigration-status"
                value={fields.immigrationStatus}
                onChange={(e) => setField("immigrationStatus", e.target.value)}
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              >
                <option value="">{t("pleaseSelect")}</option>
                {IMMIGRATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{immigrationStatusLabel(s.key, lang)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-card-foreground">{t("clientServicesLabel")}</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CASE_SERVICES.map((s) => (
                  <label key={s.key} className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                    <input type="checkbox" checked={services.indexOf(s.key) !== -1} onChange={() => toggleService(s.key)} className="h-4 w-4 shrink-0" />
                    {caseServiceLabel(s.key, lang)}
                  </label>
                ))}
              </div>
            </div>
          </FormSection>

          <Button onClick={submit}>{t("addClientBtn")}</Button>
        </CardContent>
      )}
      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingClient(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingClient, matchedClient)}
          onCreateAnyway={() => finalizeCreate(pendingClient, null)}
          onCancel={() => { setDupMatches(null); setPendingClient(null); }}
        />
      )}
    </Card>
  );
}

function ImportContactsCard({ collapsed, onToggle, onImported }) {
  const { data, showToast } = useApp();
  const t = useT();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");

  async function importRows(rows) {
    const result = buildImportedCaseClients(rows);
    if (!result) { showToast(t("importError")); return; }
    // Bulk import has no UI for a per-row duplicate review -- silently
    // attach each imported row to the best existing master-client match
    // (same matcher the interactive add-client flow uses) or create a new
    // one, mirroring the one-time migration's approach.
    for (const row of result.added) {
      const matches = findPossibleDuplicates(row, data.clients || []);
      await createCaseClient(row, row, matches.length ? matches[0].client.id : null);
    }
    onImported(result.added.length);
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
    <Card className="mb-5">
      <CardHeader className="space-y-0">
        <SectionCardHeader icon={UploadCloud} title={t("importContactsTitle")} collapsed={collapsed} onToggle={onToggle} />
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="pt-0">
          <p className="text-sm text-muted">{t("importContactsDesc")}</p>
          <Button variant="secondary" size="sm" className="mt-3 gap-2" onClick={downloadCaseClientTemplate}>
            <Download className="h-4 w-4" /> {t("downloadClientTemplate")}
          </Button>
          <div className="mt-3 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
            <label className="flex h-11 min-h-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 text-sm text-muted transition-colors hover:border-primary hover:text-card-foreground">
              <FileUp className="h-4 w-4 shrink-0" />
              <span className="truncate">{fileName || t("chooseFileFirst")}</span>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
              />
            </label>
            <Button onClick={handleImportClick} className="sm:w-auto">{t("importBtn")}</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function CaseManagement() {
  const { data, lang, requestConfirm, session } = useApp();
  const t = useT();
  const canUseIntakeForm = !!session && (session.role === "administrator" || session.role === "case_manager");
  const [opens, setOpens] = useState({ addClient: true, importContacts: false, intakeForm: false, appointments: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [notesOpenId, setNotesOpenId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [importedCount, setImportedCount] = useState(0);
  const addClientRef = useRef(null);

  const term = search.trim().toLowerCase();
  const matched = (data.caseClients || []).filter((c) => clientMatchesSearch("case", c, term, lang));
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
    const ok = await requestConfirm(t("removeClientConfirm"), { danger: true });
    if (!ok) return;
    await deleteCaseClient(id);
  }

  async function removeSelected() {
    const ok = await requestConfirm(t("bulkDeleteConfirm").replace("{n}", String(selected.size)), { danger: true });
    if (!ok) return;
    await Promise.all(Array.from(selected).map((id) => deleteCaseClient(id)));
    setSelected(new Set());
  }

  function setOpen(key, val) { setOpens((prev) => Object.assign({}, prev, { [key]: val })); }

  function scrollToAddClient() {
    setOpen("addClient", true);
    addClientRef.current && addClientRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalClients = (data.caseClients || []).length;
  const activeClients = (data.caseClients || []).filter((c) => c.active !== false).length;
  const today = todayStr();
  const upcomingAppointments = (data.appointments || []).filter((a) => a.meetingWith === "case_manager" && a.date >= today && a.status !== "cancelled").length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("caseManagementTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("caseManagementPageSubtitle")}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={scrollToAddClient}>
          <Plus className="h-4 w-4" /> {t("addClientShortcutBtn")}
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStat icon={Users} tint="bg-primary-tint text-primary" label={t("totalClientsLabel")} value={totalClients} />
        <KpiStat icon={CalendarClock} tint="bg-tint-success text-success" label={t("statUpcomingAppointmentsLabel")} value={upcomingAppointments} />
        <KpiStat icon={Users} tint="bg-violet-100 text-violet-700" label={t("statActiveClientsLabel")} value={activeClients} />
        <KpiStat icon={Clock3} tint="bg-tint-warn text-warn" label={t("statImportedContactsLabel")} value={importedCount} />
      </div>

      <AddClientCard forwardRef={addClientRef} collapsed={!opens.addClient} onToggle={() => setOpen("addClient", !opens.addClient)} />
      <ImportContactsCard collapsed={!opens.importContacts} onToggle={() => setOpen("importContacts", !opens.importContacts)} onImported={(n) => setImportedCount((c) => c + n)} />
      {canUseIntakeForm && (
        <IntakeFormCard collapsed={!opens.intakeForm} onToggle={() => setOpen("intakeForm", !opens.intakeForm)} />
      )}
      <AppointmentsSection
        open={opens.appointments}
        onToggle={(v) => setOpen("appointments", v)}
        meetingWith="case_manager"
        clientList={data.caseClients || []}
        staffList={activeCaseManagers(data.profiles)}
        staffLabelKey="apptCaseManagerLabel"
      />

      <Card className="mt-5">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("clientSearchPlaceholder")}
                aria-label={t("clientSearchPlaceholder")}
                className="h-12 min-h-0 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-base text-card-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </div>
            <button
              type="button"
              aria-label={t("filterLabel")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-muted transition-colors hover:border-[#b7c0d1] hover:text-card-foreground"
            >
              <SlidersHorizontal className="h-4.5 w-4.5" />
            </button>
          </div>

          <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={removeSelected}><Trash2 className="h-3.5 w-3.5" />{t("deleteSelectedLabel")}</Button>
          </BulkActionsBar>

          {paged.items.length ? (
            <div className="mt-4 overflow-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-card px-3 py-3 shadow-[0_1px_0_var(--border)]">
                      <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} aria-label={t("selectAllLabel")} />
                    </th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("nameLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("phoneLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("emailLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("address")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("immigrationStatusLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("intakeDateLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("actionsLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.items.map((c) => (
                    <CaseClientCard
                      key={c.id}
                      client={c}
                      open={notesOpenId === c.id}
                      onToggle={() => setNotesOpenId((cur) => (cur === c.id ? null : c.id))}
                      onRemove={() => removeClient(c.id)}
                      selected={selected.has(c.id)}
                      onToggleSelect={() => toggleSelect(c.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4"><EmptyState icon="users" message={t("noClientsYet")} /></div>
          )}
          <Pagination
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelClients")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        </CardContent>
      </Card>
    </>
  );
}
