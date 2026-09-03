// JobDeveloper.jsx -- the job-seeker caseload, on the same chrome as the
// rest of the module: components/SearchFilterPanel.jsx,
// components/ResultsToolbar.jsx and components/ResultsEmptyState.jsx around
// JobClientListItem (default) and JobClientGridCard. The 10-column table
// those two replace kept its whole vocabulary in the move -- the bulk-select
// checkbox, the profile link, work-permit and resume state, the follow-up
// chip -- and bulk selection works identically in either layout.
//
// The Follow-Ups Due KPI stays clickable, but it no longer owns a filter of
// its own: it drives the Follow-Up filter tile, and the tile drives it back.
// One piece of state, so the card's pressed look, the tile's value, the
// active-filter count and Clear all can never disagree about whether the
// list is filtered.
//
// The Add a Client form and AppointmentsSection are this page's own
// workflows and are left as they were, except that the add form now starts
// collapsed -- this is a caseload, so it should open on the clients rather
// than on an empty form, and the header's Add Client button still expands
// and scrolls to it.
//
// Every filter reads a field job_clients already carries -- employment_status,
// pipeline_stage, has_resume, work_authorization, city, barriers,
// intake_date -- or the follow-up map computeFollowUps() already builds from
// the applications rows. No new column.
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, AlertTriangle, Briefcase, Calendar, CalendarClock, CalendarDays, ChevronDown, ChevronUp, FileCheck2, FileText, MapPin, Plus, RotateCcw, ShieldCheck, Trash2, TrendingUp, User, UserPlus, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { buildClient } from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { countApplicationsWithInterview, createJobClient, deleteJobClient, fetchAllApplications, updateJobClient } from "../lib/clientsData.js";
import { BARRIERS_TO_EMPLOYMENT, EMPLOYMENT_STATUSES, JOB_PIPELINE_STAGES, WORK_AUTH_STATUSES, computeFollowUps, pipelineStageIndex } from "../lib/jobProfile.js";
import { paginateList } from "../lib/pagination.js";
import { sortStudentsList } from "../lib/students.js";
import { cn } from "../lib/cn.js";
import { formatPhone, todayStr } from "../lib/utils.js";
import { matchesJobClient } from "../lib/workforceFilters.js";
import AppointmentsSection from "../components/AppointmentsSection.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import { uploadClientFile } from "../lib/clientsData.js";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import JobClientGridCard from "../components/JobClientGridCard.jsx";
import JobClientListItem from "../components/JobClientListItem.jsx";
import Pagination from "../components/Pagination.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", intakeDate: "", street: "", city: "", zip: "", workPermit: "no", workPermitExpiration: "", hasResume: "no" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

function KpiStat({ icon: Icon, tint, label, value, sub, onClick, active }) {
  const interactive = onClick ? {
    role: "button", tabIndex: 0, onClick,
    onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
    className: "cursor-pointer p-6"
  } : { className: "p-6" };
  return (
    <Card className={active ? "ring-2 ring-primary" : ""}>
      <CardContent {...interactive}>
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

// Barriers, intake-date windows and the follow-up map are the three filters
// that aren't a plain field comparison; everything else compares a
// job_clients column directly.
const SORTERS = {
  name_az: null,   // handled by sortStudentsList, which the page already used
  name_za: null,
  newest_intake: function (a, b) { return (b.intakeDate || "").localeCompare(a.intakeDate || ""); },
  oldest_intake: function (a, b) { return (a.intakeDate || "").localeCompare(b.intakeDate || ""); },
  stage: function (a, b) { return pipelineStageIndex(a.pipelineStage) - pipelineStageIndex(b.pipelineStage); }
};

function optionsFrom(list, allLabel) {
  return [{ value: "", label: allLabel }].concat(list.map(function (i) { return { value: i.key, label: i.en }; }));
}

export default function JobDeveloper() {
  const { data, lang, requestConfirm } = useApp();
  const t = useT();
  const [interviewsScheduled, setInterviewsScheduled] = useState(0);
  useEffect(() => {
    let cancelled = false;
    countApplicationsWithInterview().then((n) => { if (!cancelled) setInterviewsScheduled(n); });
    return () => { cancelled = true; };
  }, [data.jobClients]);
  // Follow-ups due -- fetched once per caseload change (same freshness
  // trade-off as interviewsScheduled above) and reduced client-side into a
  // per-client map so the list page can surface "who needs a call today"
  // without a per-row query.
  const [applications, setApplications] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchAllApplications().then((rows) => { if (!cancelled) setApplications(rows); });
    return () => { cancelled = true; };
  }, [data.jobClients]);
  const followUps = computeFollowUps(applications, todayStr());
  const followUpsDueCount = Object.keys(followUps).length;

  const [opens, setOpens] = useState({ addJobClient: false, appointments: false });
  const [search, setSearch] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [resumeFilter, setResumeFilter] = useState("");
  const [workAuthFilter, setWorkAuthFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [barrierFilter, setBarrierFilter] = useState("");
  const [intakeFilter, setIntakeFilter] = useState("");
  const [sort, setSort] = useState("name_az");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(() => new Set());
  const addClientRef = useRef(null);
  const appointmentsRef = useRef(null);
  const location = useLocation();
  // ClientHeader's "Schedule Appointment" (ClientProfile.jsx) navigates here
  // with this state to land directly on a pre-filled, expanded appointments
  // form instead of a generic client list -- see AppointmentsSection.jsx's
  // initialClientId prop for the pre-fill half.
  const scheduleClientId = location.state && location.state.openAppointments ? location.state.appointmentClientId : undefined;

  const jobClients = data.jobClients || [];
  const cities = Array.from(new Set(jobClients.map(function (c) { return (c.city || "").trim(); }).filter(Boolean))).sort();

  function setFilter(setter) {
    return function (value) { setter(value); setPage(1); };
  }

  const filters = [
    {
      key: "followUp", icon: AlertCircle, label: t("followUpColumnLabel"), value: followUpFilter,
      onChange: setFilter(setFollowUpFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "due", label: t("followUpDueLabel") },
        { value: "none", label: t("followUpNoneDueLabel") }
      ]
    },
    {
      key: "status", icon: Briefcase, label: t("employmentStatusLabel"), value: statusFilter,
      onChange: setFilter(setStatusFilter), options: optionsFrom(EMPLOYMENT_STATUSES, t("allEmploymentStatusesLabel"))
    },
    {
      key: "stage", icon: TrendingUp, label: t("pipelineStageLabel"), value: stageFilter,
      onChange: setFilter(setStageFilter), options: optionsFrom(JOB_PIPELINE_STAGES, t("allStagesLabel"))
    },
    {
      key: "resume", icon: FileText, label: t("resumeLabel"), value: resumeFilter, onChange: setFilter(setResumeFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("resumeOnFileLabel") },
        { value: "no", label: t("noResumeOnFileLabel") }
      ]
    },
    {
      key: "workAuth", icon: ShieldCheck, label: t("workAuthorizationLabel"), value: workAuthFilter,
      onChange: setFilter(setWorkAuthFilter), options: optionsFrom(WORK_AUTH_STATUSES, t("allWorkAuthorizationsLabel"))
    },
    {
      key: "city", icon: MapPin, label: t("locationLabel"), value: cityFilter, onChange: setFilter(setCityFilter),
      options: [{ value: "", label: t("allCitiesLabel") }].concat(cities.map(function (c) { return { value: c, label: c }; }))
    },
    {
      key: "barrier", icon: AlertTriangle, label: t("barriersLabel"), value: barrierFilter, onChange: setFilter(setBarrierFilter),
      options: [{ value: "", label: t("anyLabel") }, { value: "__none", label: t("noBarriersReportedLabel") }]
        .concat(BARRIERS_TO_EMPLOYMENT.map(function (b) { return { value: b.key, label: b.en }; }))
    },
    {
      key: "intake", icon: CalendarDays, label: t("intakeDateLabel"), value: intakeFilter, onChange: setFilter(setIntakeFilter),
      options: [
        { value: "", label: t("anyTimeLabel") },
        { value: "30", label: t("last30DaysLabel") },
        { value: "90", label: t("last90DaysLabel") },
        { value: "180", label: t("last180DaysLabel") }
      ]
    }
  ];
  const activeFilterCount = filters.filter(function (f) { return Boolean(f.value); }).length;

  function clearAll() {
    setSearch("");
    setFollowUpFilter(""); setStatusFilter(""); setStageFilter(""); setResumeFilter("");
    setWorkAuthFilter(""); setCityFilter(""); setBarrierFilter(""); setIntakeFilter("");
    setPage(1);
  }

  const term = search.trim().toLowerCase();
  const filterValues = {
    followUp: followUpFilter, status: statusFilter, stage: stageFilter, resume: resumeFilter,
    workAuth: workAuthFilter, city: cityFilter, barrier: barrierFilter, intake: intakeFilter
  };
  const matched = jobClients.filter(function (c) {
    return matchesJobClient(c, filterValues, { today: todayStr(), term, followUps });
  });

  // Name sorting keeps going through sortStudentsList, which is what this
  // page always used and what the rest of the app sorts people by; Z-A is
  // just that list reversed rather than a second, subtly different collation.
  let sorted;
  if (sort === "name_az" || sort === "name_za") {
    sorted = sortStudentsList(matched.map(function (c) { return { firstName: c.firstName, lastName: c.lastName, __ref: c }; }))
      .map(function (w) { return w.__ref; });
    if (sort === "name_za") sorted = sorted.reverse();
  } else {
    sorted = matched.slice().sort(SORTERS[sort]);
  }
  const paged = paginateList(sorted, page, pageSize);
  const allOnPageSelected = paged.items.length > 0 && paged.items.every(function (c) { return selected.has(c.id); });

  const sortOptions = [
    { value: "name_az", label: t("sortClientNameAzLabel") },
    { value: "name_za", label: t("sortClientNameZaLabel") },
    { value: "newest_intake", label: t("sortNewestIntakeLabel") },
    { value: "oldest_intake", label: t("sortOldestIntakeLabel") },
    { value: "stage", label: t("sortPipelineStageLabel") }
  ];

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

  useEffect(() => {
    if (location.state && location.state.openAppointments) scrollToAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const totalClients = jobClients.length;
  const activelyLooking = jobClients.filter((c) => c.employmentStatus === "actively_looking").length;
  const employed = jobClients.filter((c) => c.employmentStatus === "employed").length;
  const resumesCompleted = jobClients.filter((c) => c.hasResume).length;

  function renderResults() {
    if (jobClients.length === 0) {
      return (
        <ResultsEmptyState
          icon={Users} title={t("noJobClientsTitle")} description={t("noJobClientsDesc")}
          actionLabel={t("addClientShortcutBtn")} actionIcon={Plus} onAction={scrollToAddClient}
        />
      );
    }
    if (paged.items.length === 0) {
      return (
        <ResultsEmptyState
          icon={Users} title={t("noMatchingJobClientsTitle")} description={t("noMatchingJobClientsDesc")}
          actionLabel={t("clearAllLabel")} actionIcon={RotateCcw} actionVariant="secondary" onAction={clearAll}
        />
      );
    }

    const rows = paged.items.map(function (c) {
      const Row = view === "grid" ? JobClientGridCard : JobClientListItem;
      return (
        <Row
          key={c.id} client={c} lang={lang} onRemove={function () { removeClient(c.id); }}
          selected={selected.has(c.id)} onToggleSelect={function () { toggleSelect(c.id); }}
          followUp={followUps[c.id]}
        />
      );
    });

    return view === "grid"
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows}</div>
      : <div className="flex flex-col gap-3">{rows}</div>;
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{t("jobDeveloperTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("jobDeveloperDesc")}</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="h-12 gap-2 rounded-[12px] px-5 text-[15px]">
                {t("actionsLabel")} <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
          <Button onClick={scrollToAddClient} className="h-12 gap-2 rounded-[12px] px-6 text-[15px]">
            <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> {t("addClientShortcutBtn")}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-6">
        <KpiStat
          icon={AlertCircle} tint="bg-tint-danger text-accent" label={t("statFollowUpsDueLabel")} value={followUpsDueCount} sub={t("statActionNeededLabel")}
          onClick={function () { setFollowUpFilter(followUpFilter === "due" ? "" : "due"); setPage(1); }}
          active={followUpFilter === "due"}
        />
        <KpiStat icon={Users} tint="bg-primary-tint text-primary" label={t("totalJobClientsLabel")} value={totalClients} sub={t("statAllTimeLabel")} />
        <KpiStat icon={Calendar} tint="bg-tint-success text-success" label={t("statActivelyLookingLabel")} value={activelyLooking} sub={t("statCurrentlyLookingLabel")} />
        <KpiStat icon={UserPlus} tint="bg-violet-100 text-violet-700" label={t("statInterviewsLabel")} value={interviewsScheduled} sub={t("statScheduledLabel")} />
        <KpiStat icon={User} tint="bg-tint-warn text-gold-ink" label={t("statEmployedLabel")} value={employed} sub={t("statPlacedLabel")} />
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
          initialClientId={scheduleClientId}
        />
      </div>

      {jobClients.length > 0 && (
        <SearchFilterPanel
          className="mt-5"
          search={search}
          onSearchChange={function (value) { setSearch(value); setPage(1); }}
          searchPlaceholder={t("jobClientSearchPlaceholder")}
          filters={filters}
          activeCount={activeFilterCount}
          onClearAll={clearAll}
        />
      )}

      {paged.items.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="m-0 flex items-center gap-2 text-sm font-medium text-card-foreground">
            <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} aria-label={t("selectAllLabel")} />
            {t("selectAllLabel")}
          </label>
          <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={removeSelected}>
              <Trash2 className="h-3.5 w-3.5" />{t("deleteSelectedLabel")}
            </Button>
          </BulkActionsBar>
        </div>
      )}

      <div className="mt-4">{renderResults()}</div>

      {jobClients.length > 0 && (
        <div className="mt-5">
          <ResultsToolbar
            id="job-clients"
            total={sorted.length}
            sort={sort}
            onSortChange={function (value) { setSort(value); setPage(1); }}
            sortOptions={sortOptions}
            view={view}
            onViewChange={setView}
          />
          <Pagination
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={function (n) { setPageSize(n); setPage(1); }} itemLabel={t("resultsLabel")}
            onChange={function (delta) { setPage(paged.page + delta); }}
          />
        </div>
      )}
    </>
  );
}
