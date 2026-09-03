// JobOpenings.jsx -- standalone Job Openings list, Phase 2 of the Employer &
// Job Opportunity Management module. This file owns the page's state (search
// term, the eight filters, sort, list/grid view, pagination) and the
// create/edit/archive/delete actions; the presentation is split across
// components/JobOpeningFilters.jsx (search + filter panel),
// components/JobOpeningResultsToolbar.jsx, components/JobOpeningListItem.jsx,
// components/JobOpeningGridCard.jsx and components/JobOpeningsEmptyState.jsx.
// Add Job -- from the header or from the empty state -- opens the one
// existing JobOpeningWizard.jsx modal, and View still opens
// JobOpeningDetailModal.jsx. Nothing here touches the module's navigation
// (pages/Workforce.jsx / components/ModuleNav.jsx) or the app shell.
//
// The filters read the fields the job_openings rows already carry --
// employers.city (Location), the employer's industry, employment_type,
// education, experience, english_level_required, transportation_required
// and status -- so no new columns or lookup tables are involved.
import { useState } from "react";
import { Briefcase, Building2, Car, Flag, GraduationCap, Languages, MapPin, Plus, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { createJobOpening, deleteJobOpening, updateJobOpening } from "../lib/clientsData.js";
import {
  EDUCATION_LEVELS, EMPLOYMENT_TYPES, ENGLISH_LEVEL_REQUIREMENTS, EXPERIENCE_LEVELS, JOB_OPENING_STATUSES, jobOpeningSortKey
} from "../lib/jobOpenings.js";
import { activeIndustryList } from "../lib/utils.js";
import { paginateList } from "../lib/pagination.js";
import JobOpeningDetailModal from "../components/JobOpeningDetailModal.jsx";
import JobOpeningFilters from "../components/JobOpeningFilters.jsx";
import JobOpeningGridCard from "../components/JobOpeningGridCard.jsx";
import JobOpeningListItem from "../components/JobOpeningListItem.jsx";
import JobOpeningResultsToolbar from "../components/JobOpeningResultsToolbar.jsx";
import JobOpeningWizard from "../components/JobOpeningWizard.jsx";
import JobOpeningsEmptyState from "../components/JobOpeningsEmptyState.jsx";
import Pagination from "../components/Pagination.jsx";
import { Button } from "../components/ui/button.jsx";

// Turns a { key, en } constant list into the option shape the filter tiles
// take, with the "all" entry first.
function optionsFrom(list, allLabel) {
  return [{ value: "", label: allLabel }].concat(list.map(function (i) { return { value: i.key, label: i.en }; }));
}

// Secondary comparators. The primary one is always jobOpeningSortKey (direct
// employer opportunities ahead of imported feed jobs -- a product rule from
// the module spec, not a display preference), so each of these only breaks
// ties within a group.
const SORTERS = {
  recent: function (a, b) { return (b.postedDate || "").localeCompare(a.postedDate || ""); },
  oldest: function (a, b) { return (a.postedDate || "").localeCompare(b.postedDate || ""); },
  title: function (a, b) { return (a.title || "").localeCompare(b.title || ""); },
  employer: function (a, b) { return (a.employerName || "").localeCompare(b.employerName || ""); }
};

export default function JobOpenings() {
  const { data, lang, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const [educationFilter, setEducationFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [englishFilter, setEnglishFilter] = useState("");
  const [transportationFilter, setTransportationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const employers = data.employers || [];
  const openings = data.jobOpenings || [];
  const referrals = data.referrals || [];
  const employerIndustryById = {};
  employers.forEach(function (e) { employerIndustryById[e.id] = e.industry; });
  const cities = Array.from(new Set(openings.map(function (o) { return o.employerCity; }).filter(Boolean))).sort();

  // Every filter resets to page 1 the moment it changes, so a selection can
  // never leave the user stranded on a page that no longer exists.
  function setFilter(setter) {
    return function (value) { setter(value); setPage(1); };
  }

  const filters = [
    {
      key: "city", icon: MapPin, label: t("locationLabel"), value: cityFilter, onChange: setFilter(setCityFilter),
      options: [{ value: "", label: t("allCitiesLabel") }].concat(cities.map(function (c) { return { value: c, label: c }; }))
    },
    {
      key: "industry", icon: Building2, label: t("industryLabel"), value: industryFilter, onChange: setFilter(setIndustryFilter),
      options: [{ value: "", label: t("allIndustriesLabel") }].concat(
        activeIndustryList(data.customIndustries, data.disabledIndustries).map(function (i) { return { value: i.key, label: i.en }; })
      )
    },
    {
      key: "employmentType", icon: Briefcase, label: t("employmentTypeLabel"), value: employmentTypeFilter,
      onChange: setFilter(setEmploymentTypeFilter), options: optionsFrom(EMPLOYMENT_TYPES, t("allEmploymentTypesLabel"))
    },
    {
      key: "education", icon: GraduationCap, label: t("educationLevelFilterLabel"), value: educationFilter,
      onChange: setFilter(setEducationFilter), options: optionsFrom(EDUCATION_LEVELS, t("allEducationLevelsLabel"))
    },
    {
      key: "experience", icon: TrendingUp, label: t("experienceLevelFilterLabel"), value: experienceFilter,
      onChange: setFilter(setExperienceFilter), options: optionsFrom(EXPERIENCE_LEVELS, t("allExperienceLevelsLabel"))
    },
    {
      key: "english", icon: Languages, label: t("englishLevelFilterLabel"), value: englishFilter,
      onChange: setFilter(setEnglishFilter), options: optionsFrom(ENGLISH_LEVEL_REQUIREMENTS, t("allEnglishLevelsLabel"))
    },
    {
      key: "transportation", icon: Car, label: t("transportationLabel"), value: transportationFilter,
      onChange: setFilter(setTransportationFilter),
      options: [{ value: "", label: t("anyLabel") }, { value: "yes", label: t("yesOption") }, { value: "no", label: t("noOption") }]
    },
    {
      key: "status", icon: Flag, label: t("statusLabel"), value: statusFilter, onChange: setFilter(setStatusFilter),
      options: optionsFrom(JOB_OPENING_STATUSES, t("allStatusesLabel"))
    }
  ];
  const activeFilterCount = filters.filter(function (f) { return Boolean(f.value); }).length;

  function clearAll() {
    setSearch("");
    setCityFilter(""); setIndustryFilter(""); setEmploymentTypeFilter(""); setEducationFilter("");
    setExperienceFilter(""); setEnglishFilter(""); setTransportationFilter(""); setStatusFilter("");
    setPage(1);
  }

  const term = search.trim().toLowerCase();
  const matched = openings.filter(function (o) {
    if (cityFilter && o.employerCity !== cityFilter) return false;
    if (industryFilter && employerIndustryById[o.employerId] !== industryFilter) return false;
    if (employmentTypeFilter && o.employmentType !== employmentTypeFilter) return false;
    if (educationFilter && o.education !== educationFilter) return false;
    if (experienceFilter && o.experience !== experienceFilter) return false;
    if (englishFilter && o.englishLevelRequired !== englishFilter) return false;
    if (transportationFilter === "yes" && !o.transportationRequired) return false;
    if (transportationFilter === "no" && o.transportationRequired) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (!term) return true;
    // Title + employer + the free-text fields a "keyword" would sensibly
    // reach (department, description, requirements, skills).
    const hay = [
      o.title, o.employerName, o.department, o.description, o.responsibilities, o.requirements,
      (o.skills || []).join(" ")
    ].join(" ").toLowerCase();
    return hay.indexOf(term) !== -1;
  });
  const sorted = matched.slice().sort(function (a, b) {
    return jobOpeningSortKey(a) - jobOpeningSortKey(b) || SORTERS[sort](a, b);
  });
  const paged = paginateList(sorted, page, pageSize);

  const sortOptions = [
    { value: "recent", label: t("sortMostRecentLabel") },
    { value: "oldest", label: t("sortOldestLabel") },
    { value: "title", label: t("sortJobTitleAzLabel") },
    { value: "employer", label: t("sortEmployerAzLabel") }
  ];

  async function createFromWizard(fields, status) {
    await createJobOpening(Object.assign({}, fields, { status }));
    setAdding(false);
    showToast(t("jobOpeningAdded"));
  }
  async function updateFromWizard(fields, status) {
    await updateJobOpening(editing.id, Object.assign({}, fields, { status }));
    setEditing(null);
    showToast(t("jobOpeningUpdated"));
  }
  async function archiveOpening(o) {
    const ok = await requestConfirm(t("archiveJobOpeningConfirm"));
    if (!ok) return;
    await updateJobOpening(o.id, { status: "archived" });
  }
  async function removeOpening(o) {
    const ok = await requestConfirm(t("removeJobOpeningConfirm"), { danger: true });
    if (!ok) return;
    await deleteJobOpening(o.id);
  }
  function referCandidate(o) {
    navigate("/candidatematching", { state: { openingId: o.id } });
  }
  function referralCountFor(o) {
    return referrals.filter(function (r) { return r.jobOpeningId === o.id; }).length;
  }

  const rowProps = {
    lang, onView: setViewing, onEdit: setEditing, onRefer: referCandidate,
    onArchive: archiveOpening, onDelete: removeOpening
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{t("jobOpeningsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("jobOpeningsDesc")}</p>
        </div>
        <Button onClick={function () { setAdding(true); }} className="h-12 gap-2 rounded-[12px] px-6 text-[15px]">
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> {t("addJobBtn")}
        </Button>
      </div>

      <JobOpeningFilters
        search={search}
        onSearchChange={function (value) { setSearch(value); setPage(1); }}
        filters={filters}
        activeCount={activeFilterCount}
        onClearAll={clearAll}
      />

      <div className="mt-5">
        {paged.items.length ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {paged.items.map(function (o) {
                return <JobOpeningGridCard key={o.id} opening={o} referralCount={referralCountFor(o)} {...rowProps} />;
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paged.items.map(function (o) {
                return <JobOpeningListItem key={o.id} opening={o} referralCount={referralCountFor(o)} {...rowProps} />;
              })}
            </div>
          )
        ) : (
          <JobOpeningsEmptyState
            filtered={openings.length > 0}
            onAdd={function () { setAdding(true); }}
            onClearAll={clearAll}
          />
        )}
      </div>

      <div className="mt-5">
        <JobOpeningResultsToolbar
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

      {adding && <JobOpeningWizard employers={employers} onSave={createFromWizard} onCancel={function () { setAdding(false); }} />}
      {editing && <JobOpeningWizard jobOpening={editing} employers={employers} onSave={updateFromWizard} onCancel={function () { setEditing(null); }} />}
      {viewing && <JobOpeningDetailModal jobOpening={viewing} onClose={function () { setViewing(null); }} />}
    </>
  );
}
