// JobOpenings.jsx -- standalone Job Openings list, Phase 2 of the Employer &
// Job Opportunity Management module. This file owns the page's state (search
// term, the eight filters, sort, list/grid view, pagination) and the
// create/edit/archive/delete actions; the presentation is split across
// components/SearchFilterPanel.jsx (search + filter panel),
// components/ResultsToolbar.jsx, components/JobOpeningListItem.jsx,
// components/JobOpeningGridCard.jsx and components/ResultsEmptyState.jsx --
// the first two and the empty state are shared with Candidate Matching.
// Add Job -- from the header or from the empty state -- opens the one
// existing JobOpeningWizard.jsx dialog, and View opens
// JobOpeningDetailModal.jsx (a drawer). The filters and toolbar only show
// once at least one opening exists; before that the page is the header and
// the "add your first job" empty state. Nothing here touches the module's navigation
// (components/ModuleNav.jsx) or the app shell.
//
// The filters read the fields the job_openings rows already carry --
// employers.city (Location), the employer's industry, employment_type,
// education, experience, english_level_required, transportation_required
// and status -- so no new columns or lookup tables are involved.
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Briefcase, Plus, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { createJobOpening, deleteJobOpening, updateJobOpening } from "../lib/clientsData.js";
import {
  EDUCATION_LEVELS, EMPLOYMENT_TYPES, ENGLISH_LEVEL_REQUIREMENTS, EXPERIENCE_LEVELS, JOB_OPENING_STATUSES
} from "../lib/jobOpenings.js";
import { activeIndustryList } from "../lib/utils.js";
import { matchesJobOpening } from "../lib/workforceFilters.js";
import { sortJobOpenings } from "../lib/workforceSorters.js";
import { paginateList } from "../lib/pagination.js";
import JobOpeningDetailModal from "../components/JobOpeningDetailModal.jsx";
import JobOpeningGridCard from "../components/JobOpeningGridCard.jsx";
import JobOpeningListItem from "../components/JobOpeningListItem.jsx";
import JobOpeningWizard from "../components/JobOpeningWizard.jsx";
import Pagination from "../components/Pagination.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";

// Turns a { key, en } constant list into the option shape the filter tiles
// take, with the "all" entry first.
function optionsFrom(list, allLabel) {
  return [{ value: "", label: allLabel }].concat(list.map(function (i) { return { value: i.key, label: i.en }; }));
}


export default function JobOpenings() {
  const { data, lang, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  // WorkforceDashboard.jsx's KPI cards link here with the filter that
  // reproduces the number they showed, so the list a staffer lands on is
  // exactly the set the card counted.
  const location = useLocation();
  const initialFilters = (location.state && location.state.filters) || {};
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState("");
  const [educationFilter, setEducationFilter] = useState("");
  const [experienceFilter, setExperienceFilter] = useState("");
  const [englishFilter, setEnglishFilter] = useState("");
  const [transportationFilter, setTransportationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialFilters.status || "");
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
      key: "city", label: t("locationLabel"), value: cityFilter, onChange: setFilter(setCityFilter),
      options: [{ value: "", label: t("allCitiesLabel") }].concat(cities.map(function (c) { return { value: c, label: c }; }))
    },
    {
      key: "industry", label: t("industryLabel"), value: industryFilter, onChange: setFilter(setIndustryFilter),
      options: [{ value: "", label: t("allIndustriesLabel") }].concat(
        activeIndustryList(data.customIndustries, data.disabledIndustries).map(function (i) { return { value: i.key, label: i.en }; })
      )
    },
    {
      key: "employmentType", label: t("employmentTypeLabel"), value: employmentTypeFilter,
      onChange: setFilter(setEmploymentTypeFilter), options: optionsFrom(EMPLOYMENT_TYPES, t("allEmploymentTypesLabel"))
    },
    {
      key: "education", label: t("educationLevelFilterLabel"), value: educationFilter,
      onChange: setFilter(setEducationFilter), options: optionsFrom(EDUCATION_LEVELS, t("allEducationLevelsLabel"))
    },
    {
      key: "experience", label: t("experienceLevelFilterLabel"), value: experienceFilter,
      onChange: setFilter(setExperienceFilter), options: optionsFrom(EXPERIENCE_LEVELS, t("allExperienceLevelsLabel"))
    },
    {
      key: "english", label: t("englishLevelFilterLabel"), value: englishFilter,
      onChange: setFilter(setEnglishFilter), options: optionsFrom(ENGLISH_LEVEL_REQUIREMENTS, t("allEnglishLevelsLabel"))
    },
    {
      key: "transportation", label: t("transportationLabel"), value: transportationFilter,
      onChange: setFilter(setTransportationFilter),
      options: [{ value: "", label: t("anyLabel") }, { value: "yes", label: t("yesOption") }, { value: "no", label: t("noOption") }]
    },
    {
      key: "status", label: t("statusLabel"), value: statusFilter, onChange: setFilter(setStatusFilter),
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
  const filterValues = {
    city: cityFilter, industry: industryFilter, employmentType: employmentTypeFilter, education: educationFilter,
    experience: experienceFilter, english: englishFilter, transportation: transportationFilter, status: statusFilter
  };
  const matched = openings.filter(function (o) {
    return matchesJobOpening(o, filterValues, { employerIndustryById, term });
  });
  const sorted = sortJobOpenings(matched, sort);
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
    navigate("/workforce/matching", { state: { openingId: o.id } });
  }
  function referralCountFor(o) {
    return referrals.filter(function (r) { return r.jobOpeningId === o.id; }).length;
  }

  const rowProps = {
    lang, onView: setViewing, onEdit: setEditing, onRefer: referCandidate,
    onArchive: archiveOpening, onDelete: removeOpening
  };

  const addButton = (
    <Button onClick={function () { setAdding(true); }}>
      <Plus className="h-4 w-4" aria-hidden="true" />{t("addJobBtn")}
    </Button>
  );

  return (
    <>
      <PageHeader title={t("jobOpeningsTitle")} description={t("jobOpeningsDesc")} actions={addButton} />

      {openings.length === 0 ? (
        // Nothing posted yet: no filters or sort to offer, just the first step.
        <ResultsEmptyState
          icon={Briefcase} title={t("noJobOpeningsTitle")} description={t("noJobOpeningsDesc")}
          actionLabel={t("addJobBtn")} actionIcon={Plus} onAction={function () { setAdding(true); }}
        />
      ) : (
        <>
          <SearchFilterPanel
            search={search}
            onSearchChange={function (value) { setSearch(value); setPage(1); }}
            searchPlaceholder={t("jobOpeningSearchPlaceholder")}
            filters={filters}
            activeCount={activeFilterCount}
            onClearAll={clearAll}
          />

          <ResultsToolbar
            id="job-openings"
            total={sorted.length}
            sort={sort}
            onSortChange={function (value) { setSort(value); setPage(1); }}
            sortOptions={sortOptions}
            view={view}
            onViewChange={setView}
          />

          <section aria-label={t("jobOpeningsTitle")}>
            {paged.items.length ? (
              <>
                {view === "grid" ? (
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
                )}
                <Pagination
                  bare
                  page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
                  onPageSizeChange={function (n) { setPageSize(n); setPage(1); }} itemLabel={t("resultsLabel")}
                  onChange={function (delta) { setPage(paged.page + delta); }}
                />
              </>
            ) : (
              <ResultsEmptyState
                icon={Briefcase} title={t("noMatchingJobOpeningsTitle")} description={t("noMatchingJobOpeningsDesc")}
                actionLabel={t("clearAllLabel")} actionIcon={RotateCcw} actionVariant="secondary" onAction={clearAll}
              />
            )}
          </section>
        </>
      )}

      {adding && <JobOpeningWizard employers={employers} onSave={createFromWizard} onCancel={function () { setAdding(false); }} />}
      {editing && <JobOpeningWizard jobOpening={editing} employers={employers} onSave={updateFromWizard} onCancel={function () { setEditing(null); }} />}
      {viewing && <JobOpeningDetailModal jobOpening={viewing} onClose={function () { setViewing(null); }} />}
    </>
  );
}
