// Placements.jsx -- Placements list, Phase 4 of the Employer & Job
// Opportunity Management module, on the same chrome as JobOpenings.jsx,
// CandidateMatching.jsx and Referrals.jsx: components/SearchFilterPanel.jsx,
// components/ResultsToolbar.jsx and components/ResultsEmptyState.jsx around
// a list/grid of records. The 12-column table it replaces is now
// components/PlacementListItem.jsx (default) and PlacementGridCard.jsx, both
// of which still open PlacementDetail at /placements/:id on click.
//
// The check-in dots survive the move intact -- they were the one thing the
// table did that a plain list wouldn't, so they moved into
// components/PlacementCheckinDots.jsx and now render in both layouts (and
// gained per-dot labels; a bare coloured dot said nothing to a screen
// reader).
//
// This page still reads router `state` (set by ReferralFormModal.jsx's
// "Create Placement" hand-off, the same pattern JobOpenings.jsx uses to hand
// off to CandidateMatching.jsx) to auto-open the Add Placement form
// pre-filled from a hired referral.
//
// Every filter reads a field the placement rows already carry -- status, the
// denormalized employer name, position_title, hourly_wage, benefits,
// supervisor_name -- or is computed from start_date and the check-in rows
// the way the rest of the module already computes them (daysBetween for
// tenure, checkinState for the check-in filter). No new column.
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Briefcase, Building2, CircleCheck, Clock, DollarSign, Flag, HeartHandshake, Plus, RotateCcw, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { createPlacement } from "../lib/clientsData.js";
import { CHECKIN_TYPES, PLACEMENT_STATUSES, checkinState } from "../lib/placements.js";
import { TENURE_BUCKETS, WAGE_BANDS, matchesPlacement } from "../lib/workforceFilters.js";
import { sortPlacements } from "../lib/workforceSorters.js";
import { todayStr } from "../lib/utils.js";
import PlacementFormModal from "../components/PlacementFormModal.jsx";
import PlacementGridCard from "../components/PlacementGridCard.jsx";
import PlacementListItem from "../components/PlacementListItem.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";


function distinct(list, key) {
  return Array.from(new Set(list.map(function (p) { return (p[key] || "").trim(); }).filter(Boolean))).sort();
}

export default function Placements() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(!!(location.state && location.state.prefill));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employerFilter, setEmployerFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [tenureFilter, setTenureFilter] = useState("");
  const [checkinFilter, setCheckinFilter] = useState("");
  const [wageFilter, setWageFilter] = useState("");
  const [benefitsFilter, setBenefitsFilter] = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("list");

  const jobClients = (data.jobClients || []).filter(function (c) { return c.active !== false; });
  const employers = data.employers || [];
  const jobOpenings = data.jobOpenings || [];
  const placements = data.placements || [];

  const checkinsByPlacement = {};
  (data.placementCheckins || []).forEach(function (c) {
    if (!checkinsByPlacement[c.placementId]) checkinsByPlacement[c.placementId] = {};
    checkinsByPlacement[c.placementId][c.checkinType] = c;
  });

  // A placement's check-in standing, from the rows that exist for it. A
  // check-in with no row yet is "upcoming" -- the same assumption the dots
  // and the detail timeline make.
  function checkinSummary(placementId) {
    const rows = checkinsByPlacement[placementId] || {};
    const states = CHECKIN_TYPES.map(function (c) { return rows[c.key] ? checkinState(rows[c.key]) : "upcoming"; });
    return {
      anyOverdue: states.indexOf("due") !== -1,
      allComplete: states.every(function (s) { return s === "completed"; }),
      noneComplete: states.every(function (s) { return s !== "completed"; })
    };
  }

  const filters = [
    {
      key: "status", icon: Flag, label: t("currentStatusLabel"), value: statusFilter, onChange: setStatusFilter,
      options: [{ value: "", label: t("allStatusesLabel") }]
        .concat(PLACEMENT_STATUSES.map(function (s) { return { value: s.key, label: s.en }; }))
    },
    {
      key: "employer", icon: Building2, label: t("employerLabel"), value: employerFilter, onChange: setEmployerFilter,
      options: [{ value: "", label: t("allEmployersLabel") }]
        .concat(distinct(placements, "employerName").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "position", icon: Briefcase, label: t("positionLabel"), value: positionFilter, onChange: setPositionFilter,
      options: [{ value: "", label: t("allPositionsLabel") }]
        .concat(distinct(placements, "positionTitle").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "tenure", icon: Clock, label: t("timeOnJobLabel"), value: tenureFilter, onChange: setTenureFilter,
      options: [{ value: "", label: t("anyLabel") }]
        .concat(TENURE_BUCKETS.map(function (b) { return { value: b.value, label: t(b.labelKey) }; }))
    },
    {
      key: "checkins", icon: CircleCheck, label: t("checkinsLabel"), value: checkinFilter, onChange: setCheckinFilter,
      options: [
        { value: "", label: t("anyLabel") },
        { value: "overdue", label: t("checkinOverdueLabel") },
        { value: "all_complete", label: t("checkinAllCompleteLabel") },
        { value: "none_complete", label: t("checkinNoneCompleteLabel") }
      ]
    },
    {
      key: "wage", icon: DollarSign, label: t("hourlyWageLabel"), value: wageFilter, onChange: setWageFilter,
      options: [{ value: "", label: t("anyLabel") }]
        .concat(WAGE_BANDS.map(function (b) { return { value: b.value, label: t(b.labelKey) }; }))
    },
    {
      key: "benefits", icon: HeartHandshake, label: t("benefitsLabel"), value: benefitsFilter, onChange: setBenefitsFilter,
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("offersBenefitsLabel") },
        { value: "no", label: t("noBenefitsLabel") }
      ]
    },
    {
      key: "supervisor", icon: UserRound, label: t("supervisorNameLabel"), value: supervisorFilter, onChange: setSupervisorFilter,
      options: [{ value: "", label: t("allSupervisorsLabel") }]
        .concat(distinct(placements, "supervisorName").map(function (n) { return { value: n, label: n }; }))
    }
  ];
  const activeFilterCount = filters.filter(function (f) { return Boolean(f.value); }).length;

  function clearAll() {
    setSearch("");
    setStatusFilter(""); setEmployerFilter(""); setPositionFilter(""); setTenureFilter("");
    setCheckinFilter(""); setWageFilter(""); setBenefitsFilter(""); setSupervisorFilter("");
  }

  const term = search.trim().toLowerCase();
  const filterValues = {
    status: statusFilter, employer: employerFilter, position: positionFilter, supervisor: supervisorFilter,
    tenure: tenureFilter, wage: wageFilter, benefits: benefitsFilter, checkins: checkinFilter
  };
  const matched = placements.filter(function (p2) {
    return matchesPlacement(p2, filterValues, { today: todayStr(), term, checkinSummaryFor: checkinSummary });
  });
  const sorted = sortPlacements(matched, sort);

  const sortOptions = [
    { value: "newest", label: t("sortNewestStartLabel") },
    { value: "oldest", label: t("sortOldestStartLabel") },
    { value: "participant", label: t("sortParticipantAzLabel") },
    { value: "employer", label: t("sortEmployerAzLabel") },
    { value: "wage", label: t("sortHighestWageLabel") }
  ];

  async function createFromModal(fields) {
    await createPlacement(fields);
    setAdding(false);
    showToast(t("placementAdded"));
  }
  function openPlacement(p) {
    navigate("/placements/" + p.id);
  }

  function renderResults() {
    if (placements.length === 0) {
      return (
        <ResultsEmptyState
          icon={Briefcase} title={t("noPlacementsTitle")} description={t("noPlacementsDesc")}
          actionLabel={t("addPlacementBtn")} actionIcon={Plus} onAction={function () { setAdding(true); }}
        />
      );
    }
    if (sorted.length === 0) {
      return (
        <ResultsEmptyState
          icon={Briefcase} title={t("noMatchingPlacementsTitle")} description={t("noMatchingPlacementsDesc")}
          actionLabel={t("clearAllLabel")} actionIcon={RotateCcw} actionVariant="secondary" onAction={clearAll}
        />
      );
    }

    const rows = sorted.map(function (p) {
      const Row = view === "grid" ? PlacementGridCard : PlacementListItem;
      return <Row key={p.id} placement={p} checkins={checkinsByPlacement[p.id]} lang={lang} onOpen={openPlacement} />;
    });

    return view === "grid"
      ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows}</div>
      : <div className="flex flex-col gap-3">{rows}</div>;
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{t("placementsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("placementsDesc")}</p>
        </div>
        <Button onClick={function () { setAdding(true); }} className="h-12 gap-2 rounded-[12px] px-6 text-[15px]">
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> {t("addPlacementBtn")}
        </Button>
      </div>

      {placements.length > 0 && (
        <SearchFilterPanel
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("placementSearchPlaceholder")}
          filters={filters}
          activeCount={activeFilterCount}
          onClearAll={clearAll}
        />
      )}

      <div className="mt-5">{renderResults()}</div>

      {placements.length > 0 && (
        <div className="mt-5">
          <ResultsToolbar
            id="placements"
            total={sorted.length}
            sort={sort}
            onSortChange={setSort}
            sortOptions={sortOptions}
            view={view}
            onViewChange={setView}
          />
        </div>
      )}

      {adding && (
        <PlacementFormModal
          prefill={location.state && location.state.prefill}
          jobClients={jobClients} employers={employers} jobOpenings={jobOpenings}
          onSave={createFromModal} onCancel={function () { setAdding(false); }}
        />
      )}
    </>
  );
}
