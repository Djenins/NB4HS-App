// Employers.jsx -- Employer Directory, Phase 1 of the Employer & Job
// Opportunity Management module, on the same chrome as the rest of the
// module: components/SearchFilterPanel.jsx, components/ResultsToolbar.jsx and
// components/ResultsEmptyState.jsx around EmployerCard/EmployerListItem.
//
// Grid stays the DEFAULT view here, unlike the other pages in the module --
// "cards, not a table" is the Employer Directory spec, so list is offered as
// the alternative rather than promoted over it.
//
// The collapsible Add Employer form below is the page's own add workflow (no
// modal, unlike Job Openings/Referrals/Placements) and is left as it was,
// except that it now starts collapsed: this is a directory, so it should
// open on the employers rather than on an empty form. The header's Add
// Employer button still expands it and scrolls to it, exactly as before.
//
// Every filter reads a field the employer rows already carry -- industry,
// city, partnership_stage, assigned_job_developer_email,
// preferred_hiring_method, next_follow_up_date, last_meeting_date -- or
// counts the job_openings / placements rows that already point at the
// employer. No new column.
import { useRef, useState } from "react";
import { Briefcase, Building2, CalendarClock, CalendarDays, ChevronDown, ChevronUp, Flag, Handshake, MapPin, Plus, RotateCcw, UserPlus, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { createEmployer, deleteEmployer } from "../lib/clientsData.js";
import { EMPLOYER_PARTNERSHIP_STAGES, PREFERRED_HIRING_METHODS } from "../lib/employerProfile.js";
import { paginateList } from "../lib/pagination.js";
import { activeIndustryList, addDays, todayStr } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import EmployerCard from "../components/EmployerCard.jsx";
import EmployerListItem from "../components/EmployerListItem.jsx";
import Pagination from "../components/Pagination.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";

const EMPTY_NEW_EMPLOYER = {
  businessName: "", industry: "", website: "", street: "", city: "", zip: "",
  contactName: "", contactPhone: "", contactEmail: "", hrContactName: "", hrContactPhone: "", hrContactEmail: "",
  preferredCommunication: "", preferredHiringMethod: "", partnershipStage: "prospect", assignedJobDeveloperEmail: "", notes: ""
};

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
        {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function TextField({ id, label, required, invalid, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      <input
        id={id} type="text" value={value} onChange={onChange} placeholder={placeholder}
        className={cn(
          "h-11 min-h-0 w-full rounded-lg border bg-background px-3 text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/15",
          invalid ? "border-accent bg-tint-danger" : "border-border focus:border-primary"
        )}
      />
    </div>
  );
}

function SelectField({ id, label, value, onChange, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">{label}</label>
      <select
        id={id} value={value} onChange={onChange}
        className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        {children}
      </select>
    </div>
  );
}

function AddEmployerCard({ collapsed, onToggle, forwardRef }) {
  const { data, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(EMPTY_NEW_EMPLOYER);
  const [errors, setErrors] = useState([]);
  const industries = activeIndustryList(data.customIndustries, data.disabledIndustries);
  const jobDevelopers = activeJobDevelopers(data.profiles);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function submit() {
    if (!fields.businessName.trim()) {
      setErrors(["businessName"]);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    await createEmployer(fields);
    setFields(EMPTY_NEW_EMPLOYER);
    showToast(t("employerAdded"));
  }

  return (
    <Card ref={forwardRef} className="mb-5">
      <CardHeader className="space-y-0">
        <SectionCardHeader icon={UserPlus} title={t("addEmployerTitle")} collapsed={collapsed} onToggle={onToggle} />
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6 pt-0">
          <FormSection title={t("companyInformationLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField id="new-employer-business-name" label={t("businessNameLabel")} required invalid={errors.indexOf("businessName") !== -1} value={fields.businessName} onChange={(e) => setField("businessName", e.target.value)} />
              <SelectField id="new-employer-industry" label={t("industryLabel")} value={fields.industry} onChange={(e) => setField("industry", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {industries.map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
              </SelectField>
              <TextField id="new-employer-website" label={t("websiteLabel")} value={fields.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://" />
            </div>
          </FormSection>

          <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-employer-street" label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
              <TextField id="new-employer-city" label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
              <TextField id="new-employer-zip" label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
            </div>
            <p className="text-xs text-muted">{t("stateAlwaysRI")}</p>
          </FormSection>

          <FormSection title={t("primaryContactSectionLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-employer-contact-name" label={t("contactNameLabel")} value={fields.contactName} onChange={(e) => setField("contactName", e.target.value)} />
              <TextField id="new-employer-contact-phone" label={t("contactPhoneLabel")} value={fields.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} />
              <TextField id="new-employer-contact-email" label={t("contactEmailLabel")} value={fields.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} />
            </div>
          </FormSection>

          <FormSection title={t("hrContactSectionLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField id="new-employer-hr-name" label={t("hrContactNameLabel")} value={fields.hrContactName} onChange={(e) => setField("hrContactName", e.target.value)} />
              <TextField id="new-employer-hr-phone" label={t("hrContactPhoneLabel")} value={fields.hrContactPhone} onChange={(e) => setField("hrContactPhone", e.target.value)} />
              <TextField id="new-employer-hr-email" label={t("hrContactEmailLabel")} value={fields.hrContactEmail} onChange={(e) => setField("hrContactEmail", e.target.value)} />
            </div>
          </FormSection>

          <FormSection title={t("partnershipInformationLabel")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SelectField id="new-employer-stage" label={t("partnershipStageLabel")} value={fields.partnershipStage} onChange={(e) => setField("partnershipStage", e.target.value)}>
                {EMPLOYER_PARTNERSHIP_STAGES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
              </SelectField>
              <SelectField id="new-employer-job-developer" label={t("assignedJobDeveloperLabel")} value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
              </SelectField>
            </div>
            <div>
              <label htmlFor="new-employer-notes" className="mb-1 block text-xs font-semibold text-card-foreground">{t("companyNotesLabel")}</label>
              <textarea
                id="new-employer-notes" rows={2} value={fields.notes} onChange={(e) => setField("notes", e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </FormSection>

          <Button onClick={submit}>{t("addEmployerBtn")}</Button>
        </CardContent>
      )}
    </Card>
  );
}

// Distinct non-empty values of one field across the employers, for the
// filter tiles driven by the data rather than a constant list.
function distinct(list, key) {
  return Array.from(new Set(list.map(function (e) { return (e[key] || "").trim(); }).filter(Boolean))).sort();
}

const SORTERS = {
  name_az: function (a, b) { return (a.businessName || "").localeCompare(b.businessName || ""); },
  name_za: function (a, b) { return (b.businessName || "").localeCompare(a.businessName || ""); },
  newest_partner: function (a, b) { return (b.partnerSince || "").localeCompare(a.partnerSince || ""); },
  last_contact: function (a, b) { return (b.lastMeetingDate || "").localeCompare(a.lastMeetingDate || ""); }
};

export default function Employers() {
  const { data, lang, requestConfirm } = useApp();
  const t = useT();
  // The directory, not the form, is what this page is for -- so the add card
  // starts collapsed and the header button opens it on demand.
  const [opens, setOpens] = useState({ addEmployer: false });
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [developerFilter, setDeveloperFilter] = useState("");
  const [openingsFilter, setOpeningsFilter] = useState("");
  const [hiringMethodFilter, setHiringMethodFilter] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [sort, setSort] = useState("name_az");
  const [view, setView] = useState("grid");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const addEmployerRef = useRef(null);

  const employers = data.employers || [];
  const industries = activeIndustryList(data.customIndustries, data.disabledIndustries);
  const industryLabelByKey = {};
  industries.forEach(function (i) { industryLabelByKey[i.key] = i.en; });
  const cities = distinct(employers, "city");

  // Counts the cards and rows show. Both are real: job_openings and
  // placements each carry employer_id. "Open" means an active opening, the
  // same definition JobOpenings.jsx's status filter uses.
  const openPositionsByEmployer = {};
  (data.jobOpenings || []).forEach(function (o) {
    if (o.status !== "active") return;
    openPositionsByEmployer[o.employerId] = (openPositionsByEmployer[o.employerId] || 0) + 1;
  });
  const placementsByEmployer = {};
  (data.placements || []).forEach(function (p) {
    placementsByEmployer[p.employerId] = (placementsByEmployer[p.employerId] || 0) + 1;
  });

  const today = todayStr();
  const in7Days = addDays(today, 7);
  const days30Ago = addDays(today, -30);
  const days90Ago = addDays(today, -90);

  function setFilter(setter) {
    return function (value) { setter(value); setPage(1); };
  }

  const filters = [
    {
      key: "industry", icon: Building2, label: t("industryLabel"), value: industryFilter, onChange: setFilter(setIndustryFilter),
      options: [{ value: "", label: t("allIndustriesLabel") }]
        .concat(industries.map(function (i) { return { value: i.key, label: i.en }; }))
    },
    {
      key: "city", icon: MapPin, label: t("locationLabel"), value: cityFilter, onChange: setFilter(setCityFilter),
      options: [{ value: "", label: t("allCitiesLabel") }].concat(cities.map(function (c) { return { value: c, label: c }; }))
    },
    {
      key: "stage", icon: Flag, label: t("partnershipStageLabel"), value: stageFilter, onChange: setFilter(setStageFilter),
      options: [{ value: "", label: t("allStagesLabel") }]
        .concat(EMPLOYER_PARTNERSHIP_STAGES.map(function (s2) { return { value: s2.key, label: s2.en }; }))
    },
    {
      key: "developer", icon: UserRound, label: t("assignedJobDeveloperLabel"), value: developerFilter,
      onChange: setFilter(setDeveloperFilter),
      options: [{ value: "", label: t("allJobDevelopersLabel") }]
        .concat(distinct(employers, "assignedJobDeveloperEmail").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "openings", icon: Briefcase, label: t("openPositionsLabel"), value: openingsFilter,
      onChange: setFilter(setOpeningsFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("hasOpenPositionsLabel") },
        { value: "no", label: t("noOpenPositionsLabel") }
      ]
    },
    {
      key: "hiringMethod", icon: Handshake, label: t("preferredHiringMethodLabel"), value: hiringMethodFilter,
      onChange: setFilter(setHiringMethodFilter),
      options: [{ value: "", label: t("allHiringMethodsLabel") }]
        .concat(PREFERRED_HIRING_METHODS.map(function (m) { return { value: m.key, label: m.en }; }))
    },
    {
      key: "followUp", icon: CalendarClock, label: t("nextFollowUpDateLabel"), value: followUpFilter,
      onChange: setFilter(setFollowUpFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "overdue", label: t("followUpOverdueFilterLabel") },
        { value: "soon", label: t("followUpSoonLabel") },
        { value: "none", label: t("followUpNoneLabel") }
      ]
    },
    {
      key: "contact", icon: CalendarDays, label: t("lastContactLabel"), value: contactFilter,
      onChange: setFilter(setContactFilter),
      options: [
        { value: "", label: t("anyTimeLabel") },
        { value: "30", label: t("last30DaysLabel") },
        { value: "90", label: t("last90DaysLabel") },
        { value: "stale", label: t("contactOver90Label") },
        { value: "never", label: t("contactNeverLabel") }
      ]
    }
  ];
  const activeFilterCount = filters.filter(function (f) { return Boolean(f.value); }).length;

  function clearAll() {
    setSearch("");
    setIndustryFilter(""); setCityFilter(""); setStageFilter(""); setDeveloperFilter("");
    setOpeningsFilter(""); setHiringMethodFilter(""); setFollowUpFilter(""); setContactFilter("");
    setPage(1);
  }

  const term = search.trim().toLowerCase();
  const matched = employers.filter(function (e) {
    if (industryFilter && e.industry !== industryFilter) return false;
    if (cityFilter && (e.city || "").trim() !== cityFilter) return false;
    if (stageFilter && e.partnershipStage !== stageFilter) return false;
    if (developerFilter && (e.assignedJobDeveloperEmail || "").trim() !== developerFilter) return false;
    if (hiringMethodFilter && e.preferredHiringMethod !== hiringMethodFilter) return false;

    const openCount = openPositionsByEmployer[e.id] || 0;
    if (openingsFilter === "yes" && openCount === 0) return false;
    if (openingsFilter === "no" && openCount > 0) return false;

    if (followUpFilter) {
      const due = e.nextFollowUpDate;
      if (followUpFilter === "none" && due) return false;
      if (followUpFilter === "overdue" && (!due || due >= today)) return false;
      // "Due soon" is today through a week out -- an overdue follow-up is its
      // own bucket, so it deliberately doesn't also show up here.
      if (followUpFilter === "soon" && (!due || due < today || due > in7Days)) return false;
    }

    if (contactFilter) {
      const last = e.lastMeetingDate;
      if (contactFilter === "never" && last) return false;
      if (contactFilter === "30" && (!last || last < days30Ago)) return false;
      if (contactFilter === "90" && (!last || last < days90Ago)) return false;
      if (contactFilter === "stale" && (!last || last >= days90Ago)) return false;
    }

    if (!term) return true;
    const hay = [e.businessName, e.contactName, e.city, e.contactEmail, e.hrContactName, industryLabelByKey[e.industry]]
      .join(" ").toLowerCase();
    return hay.indexOf(term) !== -1;
  });

  // Most-open-positions isn't a column, so it sorts off the count map rather
  // than a record field; the rest are plain field comparisons.
  const sorted = matched.slice().sort(sort === "open_positions"
    ? function (a, b) { return (openPositionsByEmployer[b.id] || 0) - (openPositionsByEmployer[a.id] || 0); }
    : SORTERS[sort]);
  const paged = paginateList(sorted, page, pageSize);

  const sortOptions = [
    { value: "name_az", label: t("sortBusinessNameAzLabel") },
    { value: "name_za", label: t("sortBusinessNameZaLabel") },
    { value: "open_positions", label: t("sortMostOpenPositionsLabel") },
    { value: "newest_partner", label: t("sortNewestPartnerLabel") },
    { value: "last_contact", label: t("sortRecentContactLabel") }
  ];

  function setOpen(key, val) { setOpens(function (prev) { return Object.assign({}, prev, { [key]: val }); }); }

  function scrollToAddEmployer() {
    setOpen("addEmployer", true);
    addEmployerRef.current && addEmployerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeEmployer(id) {
    const ok = await requestConfirm(t("removeEmployerConfirm"), { danger: true });
    if (!ok) return;
    await deleteEmployer(id);
  }

  function renderResults() {
    if (employers.length === 0) {
      return (
        <ResultsEmptyState
          icon={Building2} title={t("noEmployersTitle")} description={t("noEmployersDesc")}
          actionLabel={t("addEmployerBtn")} actionIcon={Plus} onAction={scrollToAddEmployer}
        />
      );
    }
    if (paged.items.length === 0) {
      return (
        <ResultsEmptyState
          icon={Building2} title={t("noMatchingEmployersTitle")} description={t("noMatchingEmployersDesc")}
          actionLabel={t("clearAllLabel")} actionIcon={RotateCcw} actionVariant="secondary" onAction={clearAll}
        />
      );
    }

    const rows = paged.items.map(function (e) {
      const Row = view === "list" ? EmployerListItem : EmployerCard;
      return (
        <Row
          key={e.id} employer={e} industryLabel={industryLabelByKey[e.industry] || e.industry}
          openPositions={openPositionsByEmployer[e.id] || 0} placementsCount={placementsByEmployer[e.id] || 0}
          lang={lang} onRemove={function () { removeEmployer(e.id); }}
        />
      );
    });

    return view === "list"
      ? <div className="flex flex-col gap-3">{rows}</div>
      : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows}</div>;
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{t("employersTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("employersDesc")}</p>
        </div>
        <Button onClick={scrollToAddEmployer} className="h-12 gap-2 rounded-[12px] px-6 text-[15px]">
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> {t("addEmployerBtn")}
        </Button>
      </div>

      <AddEmployerCard
        forwardRef={addEmployerRef}
        collapsed={!opens.addEmployer}
        onToggle={function () { setOpen("addEmployer", !opens.addEmployer); }}
      />

      {employers.length > 0 && (
        <SearchFilterPanel
          search={search}
          onSearchChange={function (value) { setSearch(value); setPage(1); }}
          searchPlaceholder={t("employerSearchPlaceholder")}
          filters={filters}
          activeCount={activeFilterCount}
          onClearAll={clearAll}
        />
      )}

      <div className="mt-5">{renderResults()}</div>

      {employers.length > 0 && (
        <div className="mt-5">
          <ResultsToolbar
            id="employers"
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
