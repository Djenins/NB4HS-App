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
import { AlertTriangle, Briefcase, Car, FileText, MapPin, RotateCcw, Search, Send, ShieldCheck, Target, UserSearch } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { computeMatchScore, isCandidateEligible } from "../lib/candidateMatching.js";
import { createReferral } from "../lib/clientsData.js";
import { BARRIERS_TO_EMPLOYMENT, EMPLOYMENT_STATUSES, WORK_AUTH_STATUSES, employmentStatusLabel } from "../lib/jobProfile.js";
import { todayStr } from "../lib/utils.js";
import { matchesCandidate } from "../lib/workforceFilters.js";
import { sortCandidates } from "../lib/workforceSorters.js";
import CandidateMatchCard from "../components/CandidateMatchCard.jsx";
import CandidateMatchListItem from "../components/CandidateMatchListItem.jsx";
import JobOpeningPickerCard from "../components/JobOpeningPickerCard.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Card } from "../components/ui/card.jsx";

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

  function setFilter(setter) {
    return function (value) { setter(value); };
  }

  const filters = [
    {
      key: "match", icon: Target, label: t("matchQualityLabel"), value: matchFilter, onChange: setFilter(setMatchFilter),
      options: [
        { value: "", label: t("allMatchQualitiesLabel") },
        { value: "strong", label: t("matchStrongLabel") },
        { value: "good", label: t("matchGoodLabel") },
        { value: "possible", label: t("matchPossibleLabel") }
      ]
    },
    {
      key: "referral", icon: Send, label: t("referralStatusLabel"), value: referralFilter, onChange: setFilter(setReferralFilter),
      options: [
        { value: "", label: t("anyLabel") },
        { value: "not_referred", label: t("notYetReferredLabel") },
        { value: "referred", label: t("alreadyReferredLabel") }
      ]
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
      key: "status", icon: Briefcase, label: t("employmentStatusLabel"), value: statusFilter,
      onChange: setFilter(setStatusFilter), options: optionsFrom(EMPLOYMENT_STATUSES, t("allEmploymentStatusesLabel"))
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
      key: "transportation", icon: Car, label: t("transportationLabel"), value: transportationFilter,
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

    const rows = sorted.map(function (entry) {
      const Row = view === "grid" ? CandidateMatchCard : CandidateMatchListItem;
      return (
        <Row
          key={entry.jobClient.id} jobClient={entry.jobClient} jobOpening={selectedOpening} employer={employer}
          score={entry.score} alreadyReferred={isReferred(entry.jobClient.id)} referring={!!referringId}
          onRefer={function () { refer(entry.jobClient.id); }}
        />
      );
    });

    return view === "grid"
      ? <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{rows}</div>
      : <div className="flex flex-col gap-3">{rows}</div>;
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="mb-1">{t("candidateMatchingTitle")}</h1>
        <p className="m-0 text-sm text-muted">{t("candidateMatchingDesc")}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[340px_1fr]">
        <Card className="p-5 shadow-card hover:shadow-card lg:sticky lg:top-4">
          <h2 className="m-0 text-[15px] font-bold text-card-foreground">{t("jobOpeningLabel")}</h2>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="text" value={openingSearch} onChange={function (e) { setOpeningSearch(e.target.value); }}
              placeholder={t("jobOpeningSearchPlaceholder")} aria-label={t("jobOpeningSearchPlaceholder")}
              className="h-[52px] min-h-0 w-full rounded-[12px] border border-border bg-card py-0 pl-12 pr-4 text-base text-card-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2"
            />
          </div>

          <label className="m-0 mt-3 flex items-center gap-2 text-sm font-medium text-card-foreground">
            <input type="checkbox" checked={activeOnly} onChange={function (e) { setActiveOnly(e.target.checked); }} />
            {t("activeOnlyLabel")}
          </label>

          {openings.length === 0 ? (
            <p className="m-0 py-8 text-center text-sm text-muted">{t("noActiveJobOpeningsMessage")}</p>
          ) : (
            <div className="mt-3 flex max-h-[calc(100vh-320px)] flex-col gap-2 overflow-y-auto">
              {openings.map(function (o) {
                return <JobOpeningPickerCard key={o.id} opening={o} selected={o.id === selectedId} onSelect={setSelectedId} />;
              })}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          {selectedOpening && (
            <SearchFilterPanel
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={t("candidateSearchPlaceholder")}
              filters={filters}
              activeCount={activeFilterCount}
              onClearAll={clearAll}
            />
          )}

          {renderResults()}

          {selectedOpening && ranked.length > 0 && (
            <ResultsToolbar
              id="candidate-matches"
              total={sorted.length}
              sort={sort}
              onSortChange={setSort}
              sortOptions={sortOptions}
              view={view}
              onViewChange={setView}
            />
          )}
        </div>
      </div>
    </>
  );
}
