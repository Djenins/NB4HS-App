// JobDeveloper.jsx -- the job-seeker caseload, on the NB4HS Operate design
// system (plans/ui-design-system.md) and the module's shared list chrome:
// PageHeader, a KpiCard row, collapsible SectionCards for the add form and
// AppointmentsSection, then components/SearchFilterPanel.jsx,
// components/ResultsToolbar.jsx (above the results), JobClientListItem
// (default) or JobClientGridCard, and Pagination inside the results area.
// Bulk selection works identically in either layout.
//
// The Follow-Ups Due KPI stays clickable, but it no longer owns a filter of
// its own: it drives the Follow-Up filter tile, and the tile drives it back.
// One piece of state, so the card's pressed look, the tile's value, the
// active-filter count and Clear all can never disagree about whether the
// list is filtered.
//
// The add form starts collapsed -- this is a caseload, so it should open on
// the clients rather than on an empty form -- and the header's Add Client
// button expands and scrolls to it.
//
// Every filter reads a field job_clients already carries -- employment_status,
// pipeline_stage, has_resume, work_authorization, city, barriers,
// intake_date -- or the follow-up map computeFollowUps() already builds from
// the applications rows. No new column.
import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Briefcase, CalendarClock, ChevronDown, FileCheck2, Plus, RotateCcw, Search as SearchIcon, Trash2, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { buildClient } from "../lib/clients.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { countApplicationsWithInterview, createJobClient, deleteJobClient, fetchAllApplications, updateJobClient } from "../lib/clientsData.js";
import { BARRIERS_TO_EMPLOYMENT, EMPLOYMENT_STATUSES, JOB_PIPELINE_STAGES, WORK_AUTH_STATUSES, computeFollowUps } from "../lib/jobProfile.js";
import { paginateList } from "../lib/pagination.js";
import { cn } from "../lib/cn.js";
import { formatPhone, todayStr } from "../lib/utils.js";
import { matchesJobClient } from "../lib/workforceFilters.js";
import { sortJobClients } from "../lib/workforceSorters.js";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";
import { Field, Input, Select } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import AddressInput from "../components/AddressInput.jsx";

const EMPTY_NEW_CLIENT = { firstName: "", lastName: "", phone: "", email: "", intakeDate: "", street: "", city: "", zip: "", workPermit: "no", workPermitExpiration: "", hasResume: "no" };
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;

// A SectionCard whose body can be collapsed (the same pattern as
// CaseManagement.jsx). The toggle is a real button with aria-expanded in
// the card's action slot; collapsed, only the header (and any `extra`, e.g.
// the duplicate-client warning) renders.
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

// One titled group of the add form: the title/description beside the
// fields from lg up (stacked below, where the sidebar leaves ~500px).
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
  function invalid(name) { return errors.indexOf(name) !== -1 ? true : undefined; }

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
    <CollapsibleSection
      cardRef={forwardRef}
      title={t("addJobClientTitle")}
      collapsed={collapsed}
      onToggle={onToggle}
      extra={dupMatches ? (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingClient(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingClient.payload, matchedClient, pendingClient.file)}
          onCreateAnyway={() => finalizeCreate(pendingClient.payload, null, pendingClient.file)}
          onCancel={() => { setDupMatches(null); setPendingClient(null); }}
        />
      ) : null}
    >
      <div className="space-y-6">
        <FormSection title={t("sectionPersonalDetails")} desc={t("sectionPersonalDetailsDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("firstName")} htmlFor="new-job-client-first-name" required>
              <Input id="new-job-client-first-name" aria-invalid={invalid("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
            </Field>
            <Field label={t("lastName")} htmlFor="new-job-client-last-name" required>
              <Input id="new-job-client-last-name" aria-invalid={invalid("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
            </Field>
            <Field label={t("phone")} htmlFor="new-job-client-phone">
              <Input id="new-job-client-phone" type="tel" aria-invalid={invalid("phone")} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder={t("phPhone")} />
            </Field>
            <Field label={t("email")} htmlFor="new-job-client-email">
              <Input id="new-job-client-email" type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder={t("phEmail")} />
            </Field>
            <Field label={t("intakeDateLabel")} htmlFor="new-job-client-intake-date">
              <div className="ds-control"><DatePicker id="new-job-client-intake-date" value={fields.intakeDate} onChange={(v) => setField("intakeDate", v)} /></div>
            </Field>
          </div>
        </FormSection>

        <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={t("address")} htmlFor="new-job-client-street" className="sm:col-span-2 xl:col-span-1">
              <AddressInput as={Input} id="new-job-client-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} onAddressSelect={(a) => setFields((prev) => Object.assign({}, prev, { street: a.street, city: a.city || prev.city, zip: a.zip || prev.zip }))} />
            </Field>
            <Field label={t("city")} htmlFor="new-job-client-city">
              <Input id="new-job-client-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} />
            </Field>
            <Field label={t("zip")} htmlFor="new-job-client-zip">
              <Input id="new-job-client-zip" inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </Field>
          </div>
          <p className="m-0 text-meta text-muted">{t("stateAlwaysRI")}</p>
        </FormSection>

        <FormSection title={t("sectionJobDetails")} desc={t("sectionJobDetailsDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("workPermitLabel")} htmlFor="new-job-client-work-permit">
              <Select id="new-job-client-work-permit" value={fields.workPermit} onChange={(e) => setField("workPermit", e.target.value)}>
                <option value="no">{t("noOption")}</option>
                <option value="yes">{t("yesOption")}</option>
              </Select>
            </Field>
            {fields.workPermit === "yes" && (
              <Field label={t("workPermitExpirationLabel")} htmlFor="new-job-client-work-permit-expiration">
                <div className="ds-control"><DatePicker id="new-job-client-work-permit-expiration" value={fields.workPermitExpiration} onChange={(v) => setField("workPermitExpiration", v)} /></div>
              </Field>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("resumeQuestionLabel")} htmlFor="new-job-client-has-resume">
              <Select id="new-job-client-has-resume" value={fields.hasResume} onChange={(e) => setField("hasResume", e.target.value)}>
                <option value="no">{t("noOption")}</option>
                <option value="yes">{t("yesOption")}</option>
              </Select>
            </Field>
            {fields.hasResume === "yes" && (
              <Field label={t("uploadResumeLabel")} htmlFor="new-job-client-resume-file">
                <input
                  ref={fileRef} type="file" id="new-job-client-resume-file" accept=".pdf,.doc,.docx"
                  className="block min-h-0 w-full rounded-control border border-dashed border-border bg-card p-1.5 text-ui text-card-foreground file:mr-3 file:rounded-control file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-ui file:font-semibold file:text-card-foreground focus:border-primary focus:outline-none focus:ring-2"
                />
              </Field>
            )}
          </div>
        </FormSection>

        <Button onClick={submit}><Plus className="h-4 w-4" aria-hidden="true" />{t("addJobClientBtn")}</Button>
      </div>
    </CollapsibleSection>
  );
}


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
      key: "followUp", label: t("followUpColumnLabel"), value: followUpFilter,
      onChange: setFilter(setFollowUpFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "due", label: t("followUpDueLabel") },
        { value: "none", label: t("followUpNoneDueLabel") }
      ]
    },
    {
      key: "status", label: t("employmentStatusLabel"), value: statusFilter,
      onChange: setFilter(setStatusFilter), options: optionsFrom(EMPLOYMENT_STATUSES, t("allEmploymentStatusesLabel"))
    },
    {
      key: "stage", label: t("pipelineStageLabel"), value: stageFilter,
      onChange: setFilter(setStageFilter), options: optionsFrom(JOB_PIPELINE_STAGES, t("allStagesLabel"))
    },
    {
      key: "resume", label: t("resumeLabel"), value: resumeFilter, onChange: setFilter(setResumeFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("resumeOnFileLabel") },
        { value: "no", label: t("noResumeOnFileLabel") }
      ]
    },
    {
      key: "workAuth", label: t("workAuthorizationLabel"), value: workAuthFilter,
      onChange: setFilter(setWorkAuthFilter), options: optionsFrom(WORK_AUTH_STATUSES, t("allWorkAuthorizationsLabel"))
    },
    {
      key: "city", label: t("locationLabel"), value: cityFilter, onChange: setFilter(setCityFilter),
      options: [{ value: "", label: t("allCitiesLabel") }].concat(cities.map(function (c) { return { value: c, label: c }; }))
    },
    {
      key: "barrier", label: t("barriersLabel"), value: barrierFilter, onChange: setFilter(setBarrierFilter),
      options: [{ value: "", label: t("anyLabel") }, { value: "__none", label: t("noBarriersReportedLabel") }]
        .concat(BARRIERS_TO_EMPLOYMENT.map(function (b) { return { value: b.key, label: b.en }; }))
    },
    {
      key: "intake", label: t("intakeDateLabel"), value: intakeFilter, onChange: setFilter(setIntakeFilter),
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

  const sorted = sortJobClients(matched, sort);
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
      <PageHeader
        title={t("jobDeveloperTitle")}
        description={t("jobDeveloperDesc")}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  {t("actionsLabel")} <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={scrollToAppointments}>
                  <CalendarClock className="h-4 w-4 text-muted" aria-hidden="true" /> {t("appointmentsTitle")}
                </DropdownMenuItem>
                {selected.size > 0 && (
                  <DropdownMenuItem onSelect={removeSelected} className="text-tone-danger-ink focus:bg-tone-danger-bg data-[highlighted]:bg-tone-danger-bg">
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("deleteSelectedLabel")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={scrollToAddClient}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("addClientShortcutBtn")}
            </Button>
          </>
        }
      />

      {/* Six headline numbers: two per row on phones and tablets, three per
          row from lg, so each label keeps room for Kreyol/French. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          icon={AlertCircle} tone="warning" label={t("statFollowUpsDueLabel")} value={followUpsDueCount}
          hint={followUpFilter === "due" ? t("kpiFilterActiveHint") : t("statActionNeededLabel")}
          onClick={function () { setFollowUpFilter(followUpFilter === "due" ? "" : "due"); setPage(1); }}
          pressed={followUpFilter === "due"}
        />
        <KpiCard icon={Users} tone="info" label={t("totalJobClientsLabel")} value={totalClients} hint={t("statAllTimeLabel")} />
        <KpiCard icon={SearchIcon} tone="info" label={t("statActivelyLookingLabel")} value={activelyLooking} hint={t("statCurrentlyLookingLabel")} />
        <KpiCard icon={CalendarClock} tone="violet" label={t("statInterviewsLabel")} value={interviewsScheduled} hint={t("statScheduledLabel")} />
        <KpiCard icon={Briefcase} tone="success" label={t("statEmployedLabel")} value={employed} hint={t("statPlacedLabel")} />
        <KpiCard icon={FileCheck2} tone="neutral" label={t("statResumesCompletedLabel")} value={resumesCompleted} hint={t("statUpToDateLabel")} />
      </div>

      <AddJobClientCard forwardRef={addClientRef} collapsed={!opens.addJobClient} onToggle={() => setOpen("addJobClient", !opens.addJobClient)} />
      <div ref={appointmentsRef} className="scroll-mt-4">
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

      {jobClients.length > 0 ? (
        <>
          <SearchFilterPanel
            className="mb-5"
            search={search}
            onSearchChange={function (value) { setSearch(value); setPage(1); }}
            searchPlaceholder={t("jobClientSearchPlaceholder")}
            filters={filters}
            activeCount={activeFilterCount}
            onClearAll={clearAll}
          />

          <ResultsToolbar
            id="job-clients"
            total={sorted.length}
            sort={sort}
            onSortChange={function (value) { setSort(value); setPage(1); }}
            sortOptions={sortOptions}
            view={view}
            onViewChange={setView}
          />

          {paged.items.length > 0 && (
            <>
              <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-ui font-medium text-card-foreground">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} className="h-4 w-4 shrink-0 cursor-pointer accent-primary" />
                {t("selectAllLabel")}
              </label>
              <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
                <Button variant="danger" size="sm" onClick={removeSelected}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteSelectedLabel")}
                </Button>
              </BulkActionsBar>
            </>
          )}

          {renderResults()}

          {paged.total ? (
            <Pagination
              bare
              page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
              onPageSizeChange={function (n) { setPageSize(n); setPage(1); }} itemLabel={t("resultsLabel")}
              onChange={function (delta) { setPage(paged.page + delta); }}
            />
          ) : null}
        </>
      ) : renderResults()}
    </>
  );
}
