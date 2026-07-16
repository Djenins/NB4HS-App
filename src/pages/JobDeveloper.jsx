// JobDeveloper.jsx -- Tailwind/shadcn redesign pass (same idiom as
// CaseManagement.jsx/Students.jsx), reusing every existing
// clients.js/appointments.js lib helper and the AppointmentsSection/
// JobClientCard/Pagination/DatePicker components as-is. Only the
// presentation layer changed: the "Add a Client" <details className="card">
// accordion became a collapsible Card, and legacy .field/.grid form markup
// became Tailwind form-section layouts matching CaseManagement.jsx's
// AddClientCard idiom.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, CalendarClock, ChevronDown, ChevronUp, FileCheck2, MoreHorizontal, Plus, Trash2, User, UserPlus, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { buildClient, clientMatchesSearch } from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { countApplicationsWithInterview, createJobClient, deleteJobClient, updateJobClient } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { sortStudentsList } from "../lib/students.js";
import { cn } from "../lib/cn.js";
import { formatPhone } from "../lib/utils.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import { uploadClientFile } from "../lib/clientsData.js";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import EmptyState from "../components/EmptyState.jsx";
import JobClientCard from "../components/JobClientCard.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", intakeDate: "", street: "", city: "", zip: "", workPermit: "no", workPermitExpiration: "", hasResume: "no" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

function KpiStat({ icon: Icon, tint, label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl " + tint}>
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
        <div className="mt-3 truncate text-sm font-semibold text-muted">{label}</div>
        <div className="mt-1 text-4xl font-extrabold tracking-tight text-card-foreground">{value}</div>
        {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
      </CardContent>
    </Card>
  );
}

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

function AddJobClientCard({ collapsed, onToggle, forwardRef }) {
  const { data, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState(EMPTY_NEW_CLIENT);
  const [errors, setErrors] = useState([]);
  const fileRef = useRef(null);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingClient, setPendingClient] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  // Resume upload is now a two-step process: the job client row has to
  // exist first (Supabase Storage paths are prefixed by its id -- see
  // clientsData.js), so a file picked in the form gets uploaded *after*
  // createJobClient() returns, then patched onto the new row.
  async function finalizeCreate(payload, matchedClient, file) {
    const { row } = await createJobClient(payload, payload, matchedClient ? matchedClient.id : null);
    if (file) {
      const path = await uploadClientFile(row.id, file);
      await updateJobClient(row.id, { hasResume: true, resumeStoragePath: path, resumeFileName: file.name });
    }
    setFields(EMPTY_NEW_CLIENT);
    if (fileRef.current) fileRef.current.value = "";
    setDupMatches(null);
    setPendingClient(null);
    showToast(t("jobClientAdded"));
  }

  function finishAdd(file) {
    const client = buildClient("job", {
      firstName: fields.firstName, lastName: fields.lastName, phone: fields.phone, email: fields.email, intakeDate: fields.intakeDate,
      street: fields.street, city: fields.city, zip: fields.zip,
      workPermit: fields.workPermit === "yes",
      workPermitExpiration: fields.workPermit === "yes" ? fields.workPermitExpiration : "",
      hasResume: false
    }, {});
    if (!client) return;
    const matches = findPossibleDuplicates(fields, data.clients || []);
    if (matches.length) {
      setPendingClient({ payload: client, file: file || null });
      setDupMatches(matches);
      return;
    }
    finalizeCreate(client, null, file || null);
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
    finishAdd(file);
  }

  return (
    <Card ref={forwardRef} className="mb-5">
      <CardHeader className="space-y-0">
        <SectionCardHeader icon={UserPlus} title={t("addJobClientTitle")} collapsed={collapsed} onToggle={onToggle} />
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6 pt-0">
          <FormSection title={t("sectionPersonalDetails")} desc={t("sectionPersonalDetailsDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="new-job-client-first-name" label={t("firstName")} required invalid={errors.indexOf("firstName") !== -1} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
              <TextField id="new-job-client-last-name" label={t("lastName")} required invalid={errors.indexOf("lastName") !== -1} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
              <TextField id="new-job-client-phone" label={t("phone")} invalid={errors.indexOf("phone") !== -1} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder="(401) 555-0123" />
              <TextField id="new-job-client-email" label={t("email")} value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder="name@example.com" />
              <div>
                <label htmlFor="new-job-client-intake-date" className="mb-1 block text-xs font-semibold text-card-foreground">{t("intakeDateLabel")}</label>
                <DatePicker id="new-job-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} />
              </div>
            </div>
          </FormSection>

          <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-job-client-street" label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
              <TextField id="new-job-client-city" label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
              <TextField id="new-job-client-zip" label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </div>
            <p className="text-xs text-muted">{t("stateAlwaysRI")}</p>
          </FormSection>

          <FormSection title={t("sectionJobDetails")} desc={t("sectionJobDetailsDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-job-client-work-permit" className="mb-1 block text-xs font-semibold text-card-foreground">{t("workPermitLabel")}</label>
                <select
                  id="new-job-client-work-permit"
                  value={fields.workPermit}
                  onChange={(e) => setField("workPermit", e.target.value)}
                  className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="no">{t("noOption")}</option>
                  <option value="yes">{t("yesOption")}</option>
                </select>
              </div>
              {fields.workPermit === "yes" && (
                <div>
                  <label htmlFor="new-job-client-work-permit-expiration" className="mb-1 block text-xs font-semibold text-card-foreground">{t("workPermitExpirationLabel")}</label>
                  <DatePicker id="new-job-client-work-permit-expiration" value={fields.workPermitExpiration} onChange={(v) => setField("workPermitExpiration", v)} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="new-job-client-has-resume" className="mb-1 block text-xs font-semibold text-card-foreground">{t("resumeQuestionLabel")}</label>
                <select
                  id="new-job-client-has-resume"
                  value={fields.hasResume}
                  onChange={(e) => setField("hasResume", e.target.value)}
                  className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="no">{t("noOption")}</option>
                  <option value="yes">{t("yesOption")}</option>
                </select>
              </div>
              {fields.hasResume === "yes" && (
                <div>
                  <label htmlFor="new-job-client-resume-file" className="mb-1 block text-xs font-semibold text-card-foreground">{t("uploadResumeLabel")}</label>
                  <input ref={fileRef} type="file" id="new-job-client-resume-file" accept=".pdf,.doc,.docx" className="block w-full text-sm text-card-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary-tint file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary" />
                </div>
              )}
            </div>
          </FormSection>

          <Button onClick={submit}>{t("addJobClientBtn")}</Button>
        </CardContent>
      )}
      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingClient(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingClient.payload, matchedClient, pendingClient.file)}
          onCreateAnyway={() => finalizeCreate(pendingClient.payload, null, pendingClient.file)}
          onCancel={() => { setDupMatches(null); setPendingClient(null); }}
        />
      )}
    </Card>
  );
}

export default function JobDeveloper() {
  const { data, requestConfirm } = useApp();
  const t = useT();
  const [interviewsScheduled, setInterviewsScheduled] = useState(0);
  useEffect(() => {
    let cancelled = false;
    countApplicationsWithInterview().then((n) => { if (!cancelled) setInterviewsScheduled(n); });
    return () => { cancelled = true; };
  }, [data.jobClients]);
  const [opens, setOpens] = useState({ addJobClient: true, appointments: false });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(() => new Set());
  const addClientRef = useRef(null);
  const appointmentsRef = useRef(null);

  const term = search.trim().toLowerCase();
  const matched = (data.jobClients || []).filter((c) => clientMatchesSearch("job", c, term));
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

  function setOpen(key, val) { setOpens((prev) => Object.assign({}, prev, { [key]: val })); }

  function scrollToAddClient() {
    setOpen("addJobClient", true);
    addClientRef.current && addClientRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToAppointments() {
    setOpen("appointments", true);
    appointmentsRef.current && appointmentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeClient(id) {
    const ok = await requestConfirm(t("removeJobClientConfirm"), { danger: true });
    if (!ok) return;
    await deleteJobClient(id);
  }

  async function removeSelected() {
    const ok = await requestConfirm(t("bulkDeleteConfirm").replace("{n}", String(selected.size)), { danger: true });
    if (!ok) return;
    await Promise.all(Array.from(selected).map((id) => deleteJobClient(id)));
    setSelected(new Set());
  }

  const jobClients = data.jobClients || [];
  const totalClients = jobClients.length;
  const activelyLooking = jobClients.filter((c) => c.employmentStatus === "actively_looking").length;
  const employed = jobClients.filter((c) => c.employmentStatus === "employed").length;
  const resumesCompleted = jobClients.filter((c) => c.hasResume).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("jobDeveloperTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("jobDeveloperDesc")}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="lg" variant="secondary" className="gap-2">
                {t("actionsLabel")} <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={scrollToAppointments}>
                <CalendarClock className="h-3.5 w-3.5" /> {t("appointmentsTitle")}
              </DropdownMenuItem>
              {selected.size > 0 && (
                <DropdownMenuItem onSelect={removeSelected} className="text-accent focus:bg-tint-danger">
                  <Trash2 className="h-3.5 w-3.5" /> {t("deleteSelectedLabel")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="lg" className="gap-2" onClick={scrollToAddClient}>
            <Plus className="h-4 w-4" /> {t("addClientShortcutBtn")}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        <KpiStat icon={Users} tint="bg-primary-tint text-primary" label={t("totalJobClientsLabel")} value={totalClients} sub={t("statAllTimeLabel")} />
        <KpiStat icon={Calendar} tint="bg-tint-success text-success" label={t("statActivelyLookingLabel")} value={activelyLooking} sub={t("statCurrentlyLookingLabel")} />
        <KpiStat icon={UserPlus} tint="bg-violet-100 text-violet-700" label={t("statInterviewsLabel")} value={interviewsScheduled} sub={t("statScheduledLabel")} />
        <KpiStat icon={User} tint="bg-tint-warn text-warn" label={t("statEmployedLabel")} value={employed} sub={t("statPlacedLabel")} />
        <KpiStat icon={FileCheck2} tint="bg-cyan-100 text-cyan-700" label={t("statResumesCompletedLabel")} value={resumesCompleted} sub={t("statUpToDateLabel")} />
      </div>

      <AddJobClientCard forwardRef={addClientRef} collapsed={!opens.addJobClient} onToggle={() => setOpen("addJobClient", !opens.addJobClient)} />
      <div ref={appointmentsRef}>
        <AppointmentsSection
          open={opens.appointments}
          onToggle={(v) => setOpen("appointments", v)}
          meetingWith="job_developer"
          clientList={jobClients}
          staffList={activeJobDevelopers(data.profiles)}
          staffLabelKey="apptJobDeveloperLabel"
        />
      </div>

      <Card className="mt-5">
        <CardContent className="p-5">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t("jobClientSearchPlaceholder")}
            aria-label={t("jobClientSearchPlaceholder")}
            className="h-12 min-h-0 w-full rounded-xl border border-border bg-background px-4 text-base text-card-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />

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
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("workPermitLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("resumeLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("intakeDateLabel")}</th>
                    <th className="bg-card px-3 py-3 text-left text-sm font-semibold text-muted shadow-[0_1px_0_var(--border)]">{t("actionsLabel")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paged.items.map((c) => (
                    <JobClientCard
                      key={c.id} client={c} onRemove={() => removeClient(c.id)}
                      selected={selected.has(c.id)} onToggleSelect={() => toggleSelect(c.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-4"><EmptyState icon="jobdeveloper" message={t("noJobClientsYet")} /></div>
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
