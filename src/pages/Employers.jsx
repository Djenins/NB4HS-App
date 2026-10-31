// Employers.jsx -- Employer Directory, Phase 1 of the Employer & Job
// Opportunity Management module, on the NB4HS Operate design system and the
// module's shared list chrome: PageHeader, components/SearchFilterPanel.jsx,
// components/ResultsToolbar.jsx (above the results), EmployerCard or
// EmployerListItem, Pagination inside the results area, and
// components/ResultsEmptyState.jsx when there's nothing to show.
//
// Grid stays the DEFAULT view here, unlike the other pages in the module --
// "cards, not a table" is the Employer Directory spec, so list is offered as
// the alternative rather than promoted over it.
//
// The collapsible Add Employer form below (a SectionCard of Field controls)
// is the page's own inline add workflow -- no modal, unlike Job Openings/
// Referrals/Placements. It starts collapsed: this is a directory, so it
// should open on the employers rather than on an empty form. The header's
// Add Employer button expands it and scrolls to it.
//
// Every filter reads a field the employer rows already carry -- industry,
// city, partnership_stage, assigned_job_developer_email,
// preferred_hiring_method, next_follow_up_date, last_meeting_date -- or
// counts the job_openings / placements rows that already point at the
// employer. No new column.
import { useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Building2, ChevronDown, Plus, RotateCcw } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { createEmployer, deleteEmployer } from "../lib/clientsData.js";
import { EMPLOYER_PARTNERSHIP_STAGES, PREFERRED_HIRING_METHODS } from "../lib/employerProfile.js";
import { paginateList } from "../lib/pagination.js";
import { activeIndustryList, todayStr } from "../lib/utils.js";
import { matchesEmployer } from "../lib/workforceFilters.js";
import { sortEmployers } from "../lib/workforceSorters.js";
import { cn } from "../lib/cn.js";
import EmployerCard from "../components/EmployerCard.jsx";
import EmployerListItem from "../components/EmployerListItem.jsx";
import Pagination from "../components/Pagination.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";
import { Field, Input, Select, Textarea } from "../components/ui/field.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import AddressInput from "../components/AddressInput.jsx";
import WorkforceNav from "../components/WorkforceNav.jsx";

const EMPTY_NEW_EMPLOYER = {
  businessName: "", industry: "", website: "", street: "", city: "", zip: "",
  contactName: "", contactPhone: "", contactEmail: "", hrContactName: "", hrContactPhone: "", hrContactEmail: "",
  preferredCommunication: "", preferredHiringMethod: "", partnershipStage: "prospect", assignedJobDeveloperEmail: "", notes: ""
};

// A SectionCard whose body can be collapsed (the same pattern as
// CaseManagement.jsx and JobDeveloper.jsx): the toggle is a real button
// with aria-expanded in the card's action slot.
function CollapsibleSection({ title, collapsed, onToggle, cardRef, children }) {
  const t = useT();
  const bodyId = useId();
  return (
    <div ref={cardRef} className="mb-5 scroll-mt-4">
      <SectionCard
        title={title}
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
        {collapsed ? null : <div id={bodyId}>{children}</div>}
      </SectionCard>
    </div>
  );
}

// One titled group of the add form: the title beside the fields from lg up
// (stacked below, where the sidebar leaves ~500px).
function FormSection({ title, desc, children }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-line-subtle pb-6 last:border-b-0 last:pb-0 lg:grid-cols-3 lg:gap-6">
      <div>
        <h3 className="m-0 text-ui font-semibold text-card-foreground">{title}</h3>
        {desc && <p className="m-0 mt-1 text-meta text-muted">{desc}</p>}
      </div>
      <div className="space-y-4 lg:col-span-2">{children}</div>
    </div>
  );
}

function AddEmployerCard({ collapsed, onToggle, forwardRef }) {
  const { data, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState(EMPTY_NEW_EMPLOYER);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const industries = activeIndustryList(data.customIndustries, data.disabledIndustries);
  const jobDevelopers = activeJobDevelopers(data.profiles);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }
  function text(id, name, label, extra) {
    // The street field suggests addresses and fills city/zip from the pick.
    const addr = name === "street" ? { as: Input, onAddressSelect: (a) => setFields((prev) => Object.assign({}, prev, { street: a.street, city: a.city || prev.city, zip: a.zip || prev.zip })) } : null;
    const Control = addr ? AddressInput : Input;
    return (
      <Field label={label} htmlFor={id} required={extra && extra.required}>
        <Control {...addr}
          id={id} type={(extra && extra.type) || "text"} value={fields[name]} onChange={(e) => setField(name, e.target.value)}
          placeholder={extra && extra.placeholder} aria-invalid={errors.indexOf(name) !== -1 ? true : undefined}
        />
      </Field>
    );
  }

  async function submit() {
    if (!fields.businessName.trim()) {
      setErrors(["businessName"]);
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      await createEmployer(fields);
      setFields(EMPTY_NEW_EMPLOYER);
      showToast(t("employerAdded"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleSection cardRef={forwardRef} title={t("addEmployerTitle")} collapsed={collapsed} onToggle={onToggle}>
      <div className="space-y-6">
        <FormSection title={t("companyInformationLabel")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {text("new-employer-business-name", "businessName", t("businessNameLabel"), { required: true })}
            <Field label={t("industryLabel")} htmlFor="new-employer-industry">
              <Select id="new-employer-industry" value={fields.industry} onChange={(e) => setField("industry", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {industries.map((i) => <option key={i.key} value={i.key}>{i.en}</option>)}
              </Select>
            </Field>
            {text("new-employer-website", "website", t("websiteLabel"), { type: "url", placeholder: t("phWebsite") })}
          </div>
        </FormSection>

        <FormSection title={t("sectionAddress")} desc={t("sectionAddressDesc")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="sm:col-span-2 xl:col-span-1">{text("new-employer-street", "street", t("address"))}</div>
            {text("new-employer-city", "city", t("city"))}
            {text("new-employer-zip", "zip", t("zip"))}
          </div>
          <p className="m-0 text-meta text-muted">{t("stateAlwaysRI")}</p>
        </FormSection>

        <FormSection title={t("primaryContactSectionLabel")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {text("new-employer-contact-name", "contactName", t("contactNameLabel"))}
            {text("new-employer-contact-phone", "contactPhone", t("contactPhoneLabel"), { type: "tel" })}
            {text("new-employer-contact-email", "contactEmail", t("contactEmailLabel"), { type: "email" })}
          </div>
        </FormSection>

        <FormSection title={t("hrContactSectionLabel")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {text("new-employer-hr-name", "hrContactName", t("hrContactNameLabel"))}
            {text("new-employer-hr-phone", "hrContactPhone", t("hrContactPhoneLabel"), { type: "tel" })}
            {text("new-employer-hr-email", "hrContactEmail", t("hrContactEmailLabel"), { type: "email" })}
          </div>
        </FormSection>

        <FormSection title={t("partnershipInformationLabel")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("partnershipStageLabel")} htmlFor="new-employer-stage">
              <Select id="new-employer-stage" value={fields.partnershipStage} onChange={(e) => setField("partnershipStage", e.target.value)}>
                {EMPLOYER_PARTNERSHIP_STAGES.map((s) => <option key={s.key} value={s.key}>{s.en}</option>)}
              </Select>
            </Field>
            <Field label={t("assignedJobDeveloperLabel")} htmlFor="new-employer-job-developer">
              <Select id="new-employer-job-developer" value={fields.assignedJobDeveloperEmail} onChange={(e) => setField("assignedJobDeveloperEmail", e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {jobDevelopers.map((u) => <option key={u.id} value={u.email}>{u.name || u.email}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={t("companyNotesLabel")} htmlFor="new-employer-notes">
            <Textarea id="new-employer-notes" rows={2} placeholder={t("phCompanyNotes")} value={fields.notes} onChange={(e) => setField("notes", e.target.value)} />
          </Field>
        </FormSection>

        <Button onClick={submit} loading={saving}><Plus className="h-4 w-4" aria-hidden="true" />{t("addEmployerBtn")}</Button>
      </div>
    </CollapsibleSection>
  );
}

// Distinct non-empty values of one field across the employers, for the
// filter tiles driven by the data rather than a constant list.
function distinct(list, key) {
  return Array.from(new Set(list.map(function (e) { return (e[key] || "").trim(); }).filter(Boolean))).sort();
}


export default function Employers() {
  const { data, lang, requestConfirm } = useApp();
  const t = useT();
  // See JobOpenings.jsx -- the dashboard's KPI cards and pipeline tiles hand
  // the matching filter through router state.
  const location = useLocation();
  const initialFilters = (location.state && location.state.filters) || {};
  // The directory, not the form, is what this page is for -- so the add card
  // starts collapsed and the header button opens it on demand.
  const [opens, setOpens] = useState({ addEmployer: false });
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [stageFilter, setStageFilter] = useState(initialFilters.stage || "");
  const [developerFilter, setDeveloperFilter] = useState("");
  const [openingsFilter, setOpeningsFilter] = useState("");
  const [hiringMethodFilter, setHiringMethodFilter] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState(initialFilters.followUp || "");
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

  function setFilter(setter) {
    return function (value) { setter(value); setPage(1); };
  }

  const filters = [
    {
      key: "industry", label: t("industryLabel"), value: industryFilter, onChange: setFilter(setIndustryFilter),
      options: [{ value: "", label: t("allIndustriesLabel") }]
        .concat(industries.map(function (i) { return { value: i.key, label: i.en }; }))
    },
    {
      key: "city", label: t("locationLabel"), value: cityFilter, onChange: setFilter(setCityFilter),
      options: [{ value: "", label: t("allCitiesLabel") }].concat(cities.map(function (c) { return { value: c, label: c }; }))
    },
    {
      key: "stage", label: t("partnershipStageLabel"), value: stageFilter, onChange: setFilter(setStageFilter),
      options: [{ value: "", label: t("allStagesLabel") }]
        .concat(EMPLOYER_PARTNERSHIP_STAGES.map(function (s2) { return { value: s2.key, label: s2.en }; }))
    },
    {
      key: "developer", label: t("assignedJobDeveloperLabel"), value: developerFilter,
      onChange: setFilter(setDeveloperFilter),
      options: [{ value: "", label: t("allJobDevelopersLabel") }]
        .concat(distinct(employers, "assignedJobDeveloperEmail").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "openings", label: t("openPositionsLabel"), value: openingsFilter,
      onChange: setFilter(setOpeningsFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("hasOpenPositionsLabel") },
        { value: "no", label: t("noOpenPositionsLabel") }
      ]
    },
    {
      key: "hiringMethod", label: t("preferredHiringMethodLabel"), value: hiringMethodFilter,
      onChange: setFilter(setHiringMethodFilter),
      options: [{ value: "", label: t("allHiringMethodsLabel") }]
        .concat(PREFERRED_HIRING_METHODS.map(function (m) { return { value: m.key, label: m.en }; }))
    },
    {
      key: "followUp", label: t("nextFollowUpDateLabel"), value: followUpFilter,
      onChange: setFilter(setFollowUpFilter),
      options: [
        { value: "", label: t("anyLabel") },
        // "due" is due-today-or-earlier -- the exact definition the dashboard's
        // Employer Follow-Ups Due card counts, so that card's number and this
        // filtered list are always the same set. "overdue" stays strictly
        // past-due for the narrower question.
        { value: "due", label: t("followUpDueTodayOrOverdueLabel") },
        { value: "overdue", label: t("followUpOverdueFilterLabel") },
        { value: "soon", label: t("followUpSoonLabel") },
        { value: "none", label: t("followUpNoneLabel") }
      ]
    },
    {
      key: "contact", label: t("lastContactLabel"), value: contactFilter,
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
  const filterValues = {
    industry: industryFilter, city: cityFilter, stage: stageFilter, developer: developerFilter,
    openings: openingsFilter, hiringMethod: hiringMethodFilter, followUp: followUpFilter, contact: contactFilter
  };
  const matched = employers.filter(function (e) {
    return matchesEmployer(e, filterValues, { today, term, openPositionsByEmployer, industryLabelByKey });
  });

  const sorted = sortEmployers(matched, sort, openPositionsByEmployer);
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
      <WorkforceNav value="employers" />
      <PageHeader
        title={t("employersTitle")}
        description={t("employersDesc")}
        actions={
          <Button onClick={scrollToAddEmployer}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("addEmployerBtn")}
          </Button>
        }
      />

      <AddEmployerCard
        forwardRef={addEmployerRef}
        collapsed={!opens.addEmployer}
        onToggle={function () { setOpen("addEmployer", !opens.addEmployer); }}
      />

      {employers.length > 0 ? (
        <>
          <SearchFilterPanel
            className="mb-5"
            search={search}
            onSearchChange={function (value) { setSearch(value); setPage(1); }}
            searchPlaceholder={t("employerSearchPlaceholder")}
            filters={filters}
            activeCount={activeFilterCount}
            onClearAll={clearAll}
          />

          <ResultsToolbar
            id="employers"
            total={sorted.length}
            sort={sort}
            onSortChange={function (value) { setSort(value); setPage(1); }}
            sortOptions={sortOptions}
            view={view}
            onViewChange={setView}
          />

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
