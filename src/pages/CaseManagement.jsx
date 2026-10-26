// CaseManagement.jsx -- Case Management: add/import clients, the intake
// form, appointments, and the client list. On the NB4HS Operate design
// system (plans/ui-design-system.md): PageHeader, KpiCard row, collapsible
// SectionCards for the forms, and a DataTable (stacked rows below lg) for
// the client list, with each client's notes in a Drawer.
//
// Data and behaviour are unchanged: every clients.js/clientsData.js/
// appointments.js helper is called exactly as before, the duplicate check,
// bulk delete and per-row delete still confirm through requestConfirm, and
// ClientProfile's "Schedule Appointment" still lands on an open, pre-filled
// appointments form via router state.
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CalendarClock, ChevronDown, Clock3, Download, FileUp, Plus, Trash2, UserCheck, Users
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { CASE_SERVICES, IMMIGRATION_STATUSES } from "../lib/constants.js";
import { activeCaseManagers } from "../lib/appointments.js";
import { buildClient, buildImportedCaseClients, caseServiceLabel, clientDisplayName, clientMatchesSearch, downloadCaseClientTemplate, immigrationStatusLabel } from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { createCaseClient, deleteCaseClient } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { readRowsFromFile, sortStudentsList } from "../lib/students.js";
import { cn } from "../lib/cn.js";
import { formatPhone, todayStr } from "../lib/utils.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import CaseClientCard, { CaseClientDrawer, caseClientColumns } from "../components/CaseClientCard.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import IntakeFormCard from "../components/IntakeFormCard.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Field, Input, Select } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SearchInput } from "../components/ui/search-input.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", immigrationStatus: "", intakeDate: "", dob: "", street: "", city: "", zip: "" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

// A SectionCard whose body can be collapsed. The toggle is a real button
// with aria-expanded in the card's action slot; collapsed, only the header
// (and any `extra`, e.g. a duplicate-client warning) renders.
function CollapsibleSection({ title, description, collapsed, onToggle, cardRef, children, extra }) {
  const t = useT();
  const bodyId = useId();
  return (
    <div ref={cardRef} className="mb-5 scroll-mt-4">
      <SectionCard
        title={title}
        description={description}
        flush={collapsed}
       
        action={
          <IconButton
            variant="secondary"
            label={collapsed ? t("expandSectionLabel") : t("collapseSectionLabel")}
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={onToggle}
          >
            <ChevronDown className={cn("transition-transform duration-fast", !collapsed && "rotate-180")} aria-hidden="true" />
          </IconButton>
        }
      >
        {collapsed ? (extra || null) : <><div id={bodyId}>{children}</div>{extra}</>}
      </SectionCard>
    </div>
  );
}

// One titled group of the Add a Client form: the title/description beside
// the fields from lg up (stacked below, where the sidebar leaves ~500px).
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

  const invalid = (name) => errors.indexOf(name) !== -1 || undefined;

  return (
    <CollapsibleSection
      cardRef={forwardRef}
      title={t("addClientTitle")}
      collapsed={collapsed}
      onToggle={onToggle}
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
            <Field label={t("firstName")} htmlFor="new-client-first-name" required>
              <Input id="new-client-first-name" aria-invalid={invalid("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
            </Field>
            <Field label={t("lastName")} htmlFor="new-client-last-name" required>
              <Input id="new-client-last-name" aria-invalid={invalid("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
            </Field>
            <Field label={t("phone")} htmlFor="new-client-phone">
              <Input id="new-client-phone" type="tel" aria-invalid={invalid("phone")} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder={t("phPhone")} />
            </Field>
            <Field label={t("email")} htmlFor="new-client-email">
              <Input id="new-client-email" type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder={t("phEmail")} />
            </Field>
            <Field label={t("intakeDateLabel")} htmlFor="new-client-intake-date">
              <div className="ds-control"><DatePicker id="new-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
            </Field>
            <Field label={t("dobLabel")} htmlFor="new-client-dob">
              <div className="ds-control"><DatePicker id="new-client-dob" value={fields.dob} onChange={(v) => setField("dob", v)} /></div>
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t("address")} htmlFor="new-client-street" className="sm:col-span-2 xl:col-span-1">
              <Input id="new-client-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} />
            </Field>
            <Field label={t("city")} htmlFor="new-client-city">
              <Input id="new-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} />
            </Field>
            <Field label={t("zip")} htmlFor="new-client-zip">
              <Input id="new-client-zip" inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </Field>
          </div>
          <p className="m-0 text-meta text-muted">{t("stateAlwaysRI")}</p>
        </FormSection>

        <FormSection title={t("sectionCaseDetails")} desc={t("sectionCaseDetailsDesc")}>
          <Field label={t("immigrationStatusLabel")} htmlFor="new-client-immigration-status">
            <Select id="new-client-immigration-status" value={fields.immigrationStatus} onChange={(e) => setField("immigrationStatus", e.target.value)}>
              <option value="">{t("pleaseSelect")}</option>
              {IMMIGRATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{immigrationStatusLabel(s.key, lang)}</option>)}
            </Select>
          </Field>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="mb-2 p-0 text-meta font-semibold text-card-foreground">{t("clientServicesLabel")}</legend>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
              {CASE_SERVICES.map((s) => (
                <label key={s.key} className="flex min-h-9 cursor-pointer items-center gap-2 text-ui text-card-foreground">
                  <input type="checkbox" checked={services.indexOf(s.key) !== -1} onChange={() => toggleService(s.key)} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />
                  {caseServiceLabel(s.key, lang)}
                </label>
              ))}
            </div>
          </fieldset>
        </FormSection>

        <Button onClick={submit}><Plus className="h-4 w-4" aria-hidden="true" />{t("addClientBtn")}</Button>
      </div>
    </CollapsibleSection>
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
    <CollapsibleSection title={t("importContactsTitle")} description={collapsed ? null : t("importContactsDesc")} collapsed={collapsed} onToggle={onToggle}>
      <Button variant="secondary" size="sm" onClick={downloadCaseClientTemplate}>
        <Download className="h-4 w-4" aria-hidden="true" />{t("downloadClientTemplate")}
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
  const appointmentsRef = useRef(null);
  const location = useLocation();
  // ClientHeader's "Schedule Appointment" (ClientProfile.jsx) navigates here
  // with this state to land directly on a pre-filled, expanded appointments
  // form instead of a generic client list -- see AppointmentsSection.jsx's
  // initialClientId prop for the pre-fill half.
  const scheduleClientId = location.state && location.state.openAppointments ? location.state.appointmentClientId : undefined;
  useEffect(() => {
    if (location.state && location.state.openAppointments) {
      setOpen("appointments", true);
      appointmentsRef.current && appointmentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allClients = data.caseClients || [];
  const term = search.trim().toLowerCase();
  const matched = allClients.filter((c) => clientMatchesSearch("case", c, term, lang));
  const sorted = sortStudentsList(matched.map((c) => ({ firstName: c.firstName, lastName: c.lastName, __ref: c }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page, pageSize);
  const allOnPageSelected = paged.items.length > 0 && paged.items.every((c) => selected.has(c.id));
  // Looked up live so the drawer follows realtime edits to the record.
  const notesClient = notesOpenId ? allClients.find((c) => c.id === notesOpenId) || null : null;

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

  function clearSearch() { setSearch(""); setPage(1); }

  const totalClients = allClients.length;
  const activeClients = allClients.filter((c) => c.active !== false).length;
  const today = todayStr();
  const upcomingAppointments = (data.appointments || []).filter((a) => a.meetingWith === "case_manager" && a.date >= today && a.status !== "cancelled").length;

  const openNotes = (c) => setNotesOpenId(c.id);
  const columns = caseClientColumns({ t, lang, onOpen: openNotes, onRemove: (c) => removeClient(c.id) });

  const emptyState = totalClients ? (
    <EmptyState
      variant="no-results"
      title={t("caseClientsNoResultsTitle")}
      description={t("caseClientsNoResultsHint")}
      action={<Button variant="secondary" onClick={clearSearch}>{t("clearLabel")}</Button>}
    />
  ) : (
    <EmptyState
      icon={Users}
      title={t("noClientsYet")}
      description={t("caseClientsEmptyHint")}
      action={<Button onClick={scrollToAddClient}><Plus className="h-4 w-4" aria-hidden="true" />{t("addClientShortcutBtn")}</Button>}
    />
  );

  return (
    <>
      <PageHeader
        title={t("caseManagementTitle")}
        description={t("caseManagementPageSubtitle")}
        actions={
          <Button onClick={scrollToAddClient}>
            <Plus className="h-4 w-4" aria-hidden="true" />{t("addClientShortcutBtn")}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("totalClientsLabel")} value={totalClients} icon={Users} tone="info" />
        <KpiCard label={t("statUpcomingAppointmentsLabel")} value={upcomingAppointments} icon={CalendarClock} tone="violet" />
        <KpiCard label={t("statActiveClientsLabel")} value={activeClients} icon={UserCheck} tone="success" />
        <KpiCard label={t("statImportedContactsLabel")} value={importedCount} icon={Clock3} tone="neutral" />
      </div>

      <AddClientCard forwardRef={addClientRef} collapsed={!opens.addClient} onToggle={() => setOpen("addClient", !opens.addClient)} />
      <ImportContactsCard collapsed={!opens.importContacts} onToggle={() => setOpen("importContacts", !opens.importContacts)} onImported={(n) => setImportedCount((c) => c + n)} />
      {canUseIntakeForm && (
        <IntakeFormCard collapsed={!opens.intakeForm} onToggle={() => setOpen("intakeForm", !opens.intakeForm)} />
      )}
      <div ref={appointmentsRef} className="scroll-mt-4">
        <AppointmentsSection
          open={opens.appointments}
          onToggle={(v) => setOpen("appointments", v)}
          meetingWith="case_manager"
          clientList={allClients}
          staffList={activeCaseManagers(data.profiles)}
          staffLabelKey="apptCaseManagerLabel"
          initialClientId={scheduleClientId}
        />
      </div>

      <Card className="p-4 sm:p-5">
        <SearchInput
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onClear={clearSearch}
          clearLabel={t("clearLabel")}
          placeholder={t("clientSearchPlaceholder")}
          aria-label={t("clientSearchPlaceholder")}
        />

        <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-ui tabular-nums text-muted" aria-live="polite">
            {t("showingResultsLabel").replace("{shown}", String(paged.items.length)).replace("{total}", String(paged.total))}
          </p>
        </div>

        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="danger" size="sm" onClick={removeSelected}><Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteSelectedLabel")}</Button>
        </BulkActionsBar>

        <DataTable
          caption={t("caseManagementTitle")}
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
          renderCard={(c) => <CaseClientCard client={c} onOpen={() => openNotes(c)} onRemove={() => removeClient(c.id)} />}
          empty={emptyState}
        />

        {paged.total ? (
          <Pagination
            bare
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelClients")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        ) : null}
      </Card>

      <CaseClientDrawer client={notesClient} onClose={() => setNotesOpenId(null)} />
    </>
  );
}
