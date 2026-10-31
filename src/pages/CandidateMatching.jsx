// CandidateMatching.jsx -- split layout: pick a job opening on the left, see
// ranked matching candidates on the right. Reachable directly from the nav,
// or via JobOpenings.jsx's "Refer Candidate" row action, which passes the
// opening id through router state so it's pre-selected on arrival.
//
// The page's chrome is the same vocabulary as JobOpenings.jsx --
// components/SearchFilterPanel.jsx, components/ResultsToolbar.jsx and
// components/ResultsEmptyState.jsx are literally the same components -- with
// the ranked candidate list in place of the openings list. This file owns
// the state (which opening, the opening-rail search, the candidate search
// and its seven filters, sort, list/grid view) and the refer action.
//
// Every candidate filter reads a field job_clients already carries: the
// computed match bucket, existing referral rows, has_resume, work_authorization,
// employment_status, city, barriers and the transportation note. No scoring
// input and no candidate attribute is invented for the sake of a tile --
// same scope rule candidateMatching.js already documents.
//
// `alreadyReferred` below is a client-side check against in-memory
// data.referrals -- fast, but racy (two staff, or two tabs, could both pass
// it before either referral lands). The real backstop is the DB's
// referrals_job_client_opening_unique index on (job_client_id,
// job_opening_id); a second createReferral() for the same pair fails there
// with a 23505 (unique_violation), which refer()'s catch below turns into
// the same "already referred" toast instead of an unhandled error.
// `referringId` covers the same-tab double-click case even faster.
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { RotateCcw, Search, UserSearch } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { computeMatchScore, isCandidateEligible } from "../lib/candidateMatching.js";
import { createReferral } from "../lib/clientsData.js";
import { BARRIERS_TO_EMPLOYMENT, EMPLOYMENT_STATUSES, WORK_AUTH_STATUSES, employmentStatusLabel } from "../lib/jobProfile.js";
import { todayStr } from "../lib/utils.js";
import { matchesCandidate } from "../lib/workforceFilters.js";
import { sortCandidates } from "../lib/workforceSorters.js";
import { paginateList } from "../lib/pagination.js";
import CandidateMatchCard from "../components/CandidateMatchCard.jsx";
import CandidateMatchListItem from "../components/CandidateMatchListItem.jsx";
import JobOpeningPickerCard from "../components/JobOpeningPickerCard.jsx";
import Pagination from "../components/Pagination.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SearchInput } from "../components/ui/search-input.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import WorkforceNav from "../components/WorkforceNav.jsx";

function optionsFrom(list, allLabel) {
  return [{ value: "", label: allLabel }].concat(list.map(function (i) { return { value: i.key, label: i.en }; }));
}


export default function CandidateMatching() {
  const { data, session, showToast } = useApp();
  const t = useT();
  const location = useLocation();
  const [openingSearch, setOpeningSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [selectedId, setSelectedId] = useState(location.state && location.state.openingId ? location.state.openingId : null);
  const [referringId, setReferringId] = useState(null);

  const [search, setSearch] = useState("");
  const [matchFilter, setMatchFilter] = useState("");
  const [referralFilter, setReferralFilter] = useState("");
  const [resumeFilter, setResumeFilter] = useState("");
  const [workAuthFilter, setWorkAuthFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [barrierFilter, setBarrierFilter] = useState("");
  const [transportationFilter, setTransportationFilter] = useState("");
  const [sort, setSort] = useState("match");
  const [view, setView] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const employers = data.employers || [];
  const employerById = {};
  employers.forEach(function (e) { employerById[e.id] = e; });
  const referrals = data.referrals || [];

  // ---- left rail: choose the opening ----
  const openingTerm = openingSearch.trim().toLowerCase();
  const openings = (data.jobOpenings || []).filter(function (o) {
    if (activeOnly && o.status !== "active") return false;
    if (!openingTerm) return true;
    return ((o.title || "") + " " + (o.employerName || "")).toLowerCase().indexOf(openingTerm) !== -1;
  });

  const selectedOpening = openings.find(function (o) { return o.id === selectedId; })
    || (data.jobOpenings || []).find(function (o) { return o.id === selectedId; });
  const employer = selectedOpening ? employerById[selectedOpening.employerId] : null;

  // ---- right pane: rank, then filter, then sort ----
  const eligible = (data.jobClients || []).filter(isCandidateEligible);
  const ranked = selectedOpening
    ? eligible.map(function (c) { return { jobClient: c, score: computeMatchScore(c, selectedOpening) }; })
    : [];

  const cities = Array.from(new Set(eligible.map(function (c) { return (c.city || "").trim(); }).filter(Boolean))).sort();

  // Like JobOpenings.jsx: any change to what's listed goes back to page 1,
  // so a narrower result set can't strand the user on an empty page.
  function setFilter(setter) {
    return function (value) { setter(value); setPage(1); };
  }
  function selectOpening(id) { setSelectedId(id); setPage(1); }

  const filters = [
    {
      key: "match", label: t("matchQualityLabel"), value: matchFilter, onChange: setFilter(setMatchFilter),
      options: [
        { value: "", label: t("allMatchQualitiesLabel") },
        { value: "strong", label: t("matchStrongLabel") },
        { value: "good", label: t("matchGoodLabel") },
        { value: "possible", label: t("matchPossibleLabel") }
      ]
    },
    {
      key: "referral", label: t("referralStatusLabel"), value: referralFilter, onChange: setFilter(setReferralFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "not_referred", label: t("notYetReferredLabel") },
        { value: "referred", label: t("alreadyReferredLabel") }
      ]
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
      key: "status", label: t("employmentStatusLabel"), value: statusFilter,
      onChange: setFilter(setStatusFilter), options: optionsFrom(EMPLOYMENT_STATUSES, t("allEmploymentStatusesLabel"))
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
      key: "transportation", label: t("transportationLabel"), value: transportationFilter,
      onChange: setFilter(setTransportationFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("hasTransportationLabel") },
        { value: "no", label: t("noTransportationLabel") }
      ]
    }
  ];
  const activeFilterCount = filters.filter(function (f) { return Boolean(f.value); }).length;

  function clearAll() {
    setSearch("");
    setMatchFilter(""); setReferralFilter(""); setResumeFilter(""); setWorkAuthFilter("");
    setStatusFilter(""); setCityFilter(""); setBarrierFilter(""); setTransportationFilter("");
    setPage(1);
  }

  function isReferred(jobClientId) {
    return referrals.some(function (r) {
      return r.jobClientId === jobClientId && selectedOpening && r.jobOpeningId === selectedOpening.id;
    });
  }

  const term = search.trim().toLowerCase();
  const filterValues = {
    match: matchFilter, referral: referralFilter, resume: resumeFilter, workAuth: workAuthFilter,
    status: statusFilter, city: cityFilter, barrier: barrierFilter, transportation: transportationFilter
  };
  const matched = ranked.filter(function (entry) {
    return matchesCandidate(entry, filterValues, { term, isReferred });
  });
  const sorted = sortCandidates(matched, sort);
  const paged = paginateList(sorted, page, pageSize);

  const sortOptions = [
    { value: "match", label: t("sortBestMatchLabel") },
    { value: "name", label: t("sortCandidateNameAzLabel") },
    { value: "newest", label: t("sortNewestIntakeLabel") },
    { value: "oldest", label: t("sortOldestIntakeLabel") }
  ];

  async function refer(jobClientId) {
    if (referringId) return;
    setReferringId(jobClientId);
    try {
      await createReferral({
        jobClientId, jobOpeningId: selectedOpening.id, employerId: selectedOpening.employerId,
        status: "referred", referralDate: todayStr(), assignedJobDeveloperEmail: session ? session.currentUserEmail : ""
      });
      showToast(t("candidateReferred"));
    } catch (err) {
      if (err && err.code === "23505") {
        showToast(t("alreadyReferredLabel"));
      } else {
        throw err;
      }
    } finally {
      setReferringId(null);
    }
  }

  function renderResults() {
    if (!selectedOpening) {
      return (
        <ResultsEmptyState
          icon={UserSearch} title={t("selectJobOpeningLabel")} description={t("selectJobOpeningDesc")}
        />
      );
    }
    if (ranked.length === 0) {
      return (
        <ResultsEmptyState
          icon={UserSearch} title={t("noEligibleCandidatesTitle")} description={t("noEligibleCandidatesDesc")}
        />
      );
    }
    if (sorted.length === 0) {
      return (
        <ResultsEmptyState
          icon={Search} title={t("noMatchingCandidatesTitle")} description={t("noMatchingCandidatesDesc")}
          actionLabel={t("clearAllLabel")} actionIcon={RotateCcw} actionVariant="secondary" onAction={clearAll}
        />
      );
    }

    const rows = paged.items.map(function (entry) {
      const Row = view === "grid" ? CandidateMatchCard : CandidateMatchListItem;
      return (
        <Row
          key={entry.jobClient.id} jobClient={entry.jobClient} jobOpening={selectedOpening} employer={employer}
          score={entry.score} alreadyReferred={isReferred(entry.jobClient.id)} referring={!!referringId}
          onRefer={function () { refer(entry.jobClient.id); }}
        />
      );
    });

    return (
      <>
        {view === "grid"
          ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{rows}</div>
          : <div className="flex flex-col gap-3">{rows}</div>}
        <Pagination
          bare
          page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
          onPageSizeChange={function (n) { setPageSize(n); setPage(1); }} itemLabel={t("resultsLabel")}
          onChange={function (delta) { setPage(paged.page + delta); }}
        />
      </>
    );
  }

  function renderPicker() {
    if (openings.length > 0) {
      return (
        <div className="flex max-h-[calc(100vh-320px)] min-h-0 flex-col gap-2 overflow-y-auto">
          {openings.map(function (o) {
            return <JobOpeningPickerCard key={o.id} opening={o} selected={o.id === selectedId} onSelect={selectOpening} />;
          })}
        </div>
      );
    }
    // Nothing posted at all, versus the search / Active Only toggle hiding
    // what exists -- the next step differs.
    if ((data.jobOpenings || []).length === 0) {
      return <EmptyState compact title={t("noJobOpeningsTitle")} description={t("noJobOpeningsDesc")} />;
    }
    return (
      <EmptyState
        compact variant="no-results" title={t("noActiveJobOpeningsMessage")} description={t("jobOpeningPickerEmptyDesc")}
        action={
          <Button variant="secondary" onClick={function () { setOpeningSearch(""); setActiveOnly(false); }}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />{t("showAllJobOpeningsLabel")}
          </Button>
        }
      />
    );
  }

  const showChrome = !!selectedOpening && ranked.length > 0;

  return (
    <>
      <WorkforceNav value="candidatematching" />
      <PageHeader title={t("candidateMatchingTitle")} description={t("candidateMatchingDesc")} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_1fr]">
        <SectionCard title={t("jobOpeningLabel")} className="lg:sticky lg:top-4">
          <div className="flex flex-col gap-3">
            <SearchInput
              value={openingSearch}
              onChange={function (e) { setOpeningSearch(e.target.value); }}
              onClear={function () { setOpeningSearch(""); }}
              clearLabel={t("clearAllLabel")}
              placeholder={t("jobOpeningSearchPlaceholder")}
              aria-label={t("jobOpeningSearchPlaceholder")}
            />
            <label className="m-0 flex min-h-10 cursor-pointer items-center gap-3 text-ui font-medium text-card-foreground">
              <input
                type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                checked={activeOnly} onChange={function (e) { setActiveOnly(e.target.checked); }}
              />
              {t("activeOnlyLabel")}
            </label>
            {renderPicker()}
          </div>
        </SectionCard>

        <section aria-label={t("candidateMatchingTitle")} className="min-w-0">
          {showChrome && (
            <>
              <SearchFilterPanel
                search={search}
                onSearchChange={function (value) { setSearch(value); setPage(1); }}
                searchPlaceholder={t("candidateSearchPlaceholder")}
                filters={filters}
                activeCount={activeFilterCount}
                onClearAll={clearAll}
              />
              <ResultsToolbar
                id="candidate-matches"
                total={sorted.length}
                sort={sort}
                onSortChange={function (value) { setSort(value); setPage(1); }}
                sortOptions={sortOptions}
                view={view}
                onViewChange={setView}
              />
            </>
          )}

          {renderResults()}
        </section>
      </div>
    </>
  );
}
