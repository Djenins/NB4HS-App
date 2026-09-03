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
import { todayStr } from "../lib/utils.js";
import PlacementFormModal from "../components/PlacementFormModal.jsx";
import PlacementGridCard from "../components/PlacementGridCard.jsx";
import PlacementListItem from "../components/PlacementListItem.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";

// Tenure buckets, in days since start_date. Chosen to line up with the
// 30/60/90/180 check-in schedule rather than being invented separately, so
// "who is past their 90-day check-in" is one filter away.
const TENURE_BUCKETS = [
  { value: "under30", labelKey: "tenureUnder30Label", min: 0, max: 29 },
  { value: "30to89", labelKey: "tenure30to89Label", min: 30, max: 89 },
  { value: "90to179", labelKey: "tenure90to179Label", min: 90, max: 179 },
  { value: "180plus", labelKey: "tenure180PlusLabel", min: 180, max: Infinity }
];

const WAGE_BANDS = [
  { value: "under15", labelKey: "wageUnder15Label", min: 0, max: 14.999999 },
  { value: "15to20", labelKey: "wage15to20Label", min: 15, max: 19.999999 },
  { value: "20plus", labelKey: "wage20PlusLabel", min: 20, max: Infinity }
];

const SORTERS = {
  newest: function (a, b) { return (b.startDate || "").localeCompare(a.startDate || ""); },
  oldest: function (a, b) { return (a.startDate || "").localeCompare(b.startDate || ""); },
  participant: function (a, b) { return (a.participantName || "").localeCompare(b.participantName || ""); },
  employer: function (a, b) { return (a.employerName || "").localeCompare(b.employerName || ""); },
  wage: function (a, b) { return (Number(b.hourlyWage) || 0) - (Number(a.hourlyWage) || 0); }
};

function distinct(list, key) {
  return Array.from(new Set(list.map(function (p) { return (p[key] || "").trim(); }).filter(Boolean))).sort();
}

// Whole days from a YYYY-MM-DD start date to today. Placements with no start
// date recorded get null and fall out of every tenure bucket rather than
// silently landing in "under 30 days".
function daysSince(startDate) {
  if (!startDate) return null;
  const start = new Date(startDate + "T00:00:00");
  const today = new Date(todayStr() + "T00:00:00");
  return Math.floor((today - start) / 86400000);
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
  const matched = placements.filter(function (p) {
    if (statusFilter && p.currentStatus !== statusFilter) return false;
    if (employerFilter && (p.employerName || "").trim() !== employerFilter) return false;
    if (positionFilter && (p.positionTitle || "").trim() !== positionFilter) return false;
    if (supervisorFilter && (p.supervisorName || "").trim() !== supervisorFilter) return false;

    if (tenureFilter) {
      const bucket = TENURE_BUCKETS.filter(function (b) { return b.value === tenureFilter; })[0];
      const days = daysSince(p.startDate);
      if (days === null || days < bucket.min || days > bucket.max) return false;
    }
    if (wageFilter) {
      const band = WAGE_BANDS.filter(function (b) { return b.value === wageFilter; })[0];
      const wage = Number(p.hourlyWage);
      if (!p.hourlyWage || isNaN(wage) || wage < band.min || wage > band.max) return false;
    }
    if (benefitsFilter === "yes" && !(p.benefits || "").trim()) return false;
    if (benefitsFilter === "no" && (p.benefits || "").trim()) return false;

    if (checkinFilter) {
      const summary = checkinSummary(p.id);
      if (checkinFilter === "overdue" && !summary.anyOverdue) return false;
      if (checkinFilter === "all_complete" && !summary.allComplete) return false;
      if (checkinFilter === "none_complete" && !summary.noneComplete) return false;
    }

    if (!term) return true;
    const hay = [p.participantName, p.employerName, p.positionTitle, p.supervisorName]
      .join(" ").toLowerCase();
    return hay.indexOf(term) !== -1;
  });
  const sorted = matched.slice().sort(SORTERS[sort]);

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
