// Referrals.jsx -- the referral pipeline, in two layouts over one filtered
// set: the 8-column kanban board (default) and a flat list.
//
// The board is the point of the page -- dragging a card between columns is
// how a referral's stage actually changes -- so it stays exactly as it was,
// native HTML5 drag-and-drop copied near-verbatim from Students.jsx's kanban
// board (see src/pages/Students.jsx:404,424-429,456-466): the same
// dropHover-keyed-by-column-key + onDragOver/onDragLeave/onDrop wiring and
// the same drop-target highlight. The list is the second view rather than a
// replacement, and it is deliberately not draggable: stage changes stay a
// board gesture (clicking a row still opens the edit modal, which can change
// the stage), because a row that looked draggable but wasn't would be a lie.
//
// Around both sits the same chrome as JobOpenings.jsx and
// CandidateMatching.jsx -- components/SearchFilterPanel.jsx,
// components/ResultsToolbar.jsx, components/ResultsEmptyState.jsx -- with the
// toolbar's view toggle carrying Board/List here instead of the default
// List/Grid. The filters narrow both layouts at once: in board view the
// columns thin out and their counts follow, so the pipeline shape you see is
// always the shape of what you filtered for.
//
// Every filter reads a field the referral rows already carry -- stage,
// the denormalized employer and position names, assigned_job_developer_email,
// referral_date and interview_date. No new column, and nothing derived that
// the data can't honestly support.
//
// Unlike every other mutation on this page, handleDrop() awaits its update
// and surfaces a toast on failure -- a dropped card that silently failed to
// save would otherwise look successful (it visually snaps back next
// re-render, but with no explanation) until the user noticed the count was
// wrong.
import { useState } from "react";
import { Briefcase, Building2, CalendarCheck, CalendarDays, Flag, KanbanSquare, List, Plus, RotateCcw, Send, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { isCandidateEligible } from "../lib/candidateMatching.js";
import { createReferral, deleteReferral, updateReferral } from "../lib/clientsData.js";
import { REFERRAL_STAGES, stageIndex } from "../lib/referrals.js";
import { addDays, todayStr } from "../lib/utils.js";
import { cn } from "../lib/cn.js";
import ReferralCard from "../components/ReferralCard.jsx";
import ReferralFormModal from "../components/ReferralFormModal.jsx";
import ReferralListItem from "../components/ReferralListItem.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Button } from "../components/ui/button.jsx";

// Board first: this page's default answer to "where is everyone in the
// pipeline" is the column shape, not a sorted list.
const VIEWS = [
  { value: "board", icon: KanbanSquare, labelKey: "boardViewLabel" },
  { value: "list", icon: List, labelKey: "listViewLabel" }
];

const SORTERS = {
  newest: function (a, b) { return (b.referralDate || "").localeCompare(a.referralDate || ""); },
  oldest: function (a, b) { return (a.referralDate || "").localeCompare(b.referralDate || ""); },
  stage: function (a, b) { return stageIndex(a.status) - stageIndex(b.status); },
  participant: function (a, b) { return (a.participantName || "").localeCompare(b.participantName || ""); },
  employer: function (a, b) { return (a.employerName || "").localeCompare(b.employerName || ""); }
};

// Distinct non-empty values of one field across the referrals, for the
// filter tiles that are driven by the data rather than a constant list.
function distinct(list, key) {
  return Array.from(new Set(list.map(function (r) { return (r[key] || "").trim(); }).filter(Boolean))).sort();
}

export default function Referrals() {
  const { data, lang, requestConfirm, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  // See JobOpenings.jsx -- the dashboard's KPI cards hand the matching filter
  // through router state so the card's number and this list agree.
  const location = useLocation();
  const initialFilters = (location.state && location.state.filters) || {};
  const [dropHover, setDropHover] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(initialFilters.stage || "");
  const [employerFilter, setEmployerFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [developerFilter, setDeveloperFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [interviewFilter, setInterviewFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState(initialFilters.stage ? "list" : "board");

  const referrals = data.referrals || [];
  const eligibleJobClients = (data.jobClients || []).filter(isCandidateEligible);
  const openJobOpenings = (data.jobOpenings || []).filter(function (o) { return o.status !== "archived"; });
  const jobDevelopers = activeJobDevelopers(data.profiles);

  const filters = [
    {
      key: "stage", icon: Flag, label: t("stageLabel"), value: stageFilter, onChange: setStageFilter,
      options: [{ value: "", label: t("allStagesLabel") }]
        .concat(REFERRAL_STAGES.map(function (s) { return { value: s.key, label: s.en }; }))
    },
    {
      key: "employer", icon: Building2, label: t("employerLabel"), value: employerFilter, onChange: setEmployerFilter,
      options: [{ value: "", label: t("allEmployersLabel") }]
        .concat(distinct(referrals, "employerName").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "position", icon: Briefcase, label: t("positionLabel"), value: positionFilter, onChange: setPositionFilter,
      options: [{ value: "", label: t("allPositionsLabel") }]
        .concat(distinct(referrals, "positionTitle").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "developer", icon: UserRound, label: t("assignedJobDeveloperLabel"), value: developerFilter, onChange: setDeveloperFilter,
      options: [{ value: "", label: t("allJobDevelopersLabel") }]
        .concat(distinct(referrals, "assignedJobDeveloperEmail").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "date", icon: CalendarDays, label: t("referralDateLabel"), value: dateFilter, onChange: setDateFilter,
      options: [
        { value: "", label: t("anyTimeLabel") },
        { value: "7", label: t("last7DaysLabel") },
        { value: "30", label: t("last30DaysLabel") },
        { value: "90", label: t("last90DaysLabel") }
      ]
    },
    {
      key: "interview", icon: CalendarCheck, label: t("interviewLabel"), value: interviewFilter, onChange: setInterviewFilter,
      options: [
        { value: "", label: t("anyLabel") },
        { value: "yes", label: t("interviewScheduledLabel") },
        { value: "no", label: t("noInterviewScheduledLabel") }
      ]
    }
  ];
  const activeFilterCount = filters.filter(function (f) { return Boolean(f.value); }).length;

  function clearAll() {
    setSearch("");
    setStageFilter(""); setEmployerFilter(""); setPositionFilter("");
    setDeveloperFilter(""); setDateFilter(""); setInterviewFilter("");
  }

  // "Last N days" is inclusive of today, so the cutoff is N-1 days back.
  const cutoff = dateFilter ? addDays(todayStr(), -(Number(dateFilter) - 1)) : "";
  const term = search.trim().toLowerCase();
  const matched = referrals.filter(function (r) {
    if (stageFilter && r.status !== stageFilter) return false;
    if (employerFilter && (r.employerName || "").trim() !== employerFilter) return false;
    if (positionFilter && (r.positionTitle || "").trim() !== positionFilter) return false;
    if (developerFilter && (r.assignedJobDeveloperEmail || "").trim() !== developerFilter) return false;
    if (cutoff && (!r.referralDate || r.referralDate < cutoff)) return false;
    if (interviewFilter === "yes" && !r.interviewDate) return false;
    if (interviewFilter === "no" && r.interviewDate) return false;
    if (!term) return true;
    const hay = [r.participantName, r.positionTitle, r.employerName, r.assignedJobDeveloperEmail, r.notes]
      .join(" ").toLowerCase();
    return hay.indexOf(term) !== -1;
  });
  const sorted = matched.slice().sort(SORTERS[sort]);

  const sortOptions = [
    { value: "newest", label: t("sortNewestReferralLabel") },
    { value: "oldest", label: t("sortOldestReferralLabel") },
    { value: "stage", label: t("sortPipelineStageLabel") },
    { value: "participant", label: t("sortParticipantAzLabel") },
    { value: "employer", label: t("sortEmployerAzLabel") }
  ];

  async function handleDrop(e, stageKey) {
    e.preventDefault();
    setDropHover(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    try {
      await updateReferral(id, { status: stageKey });
    } catch (err) {
      console.warn("updateReferral failed", err);
      showToast(t("userActionError"));
    }
  }

  async function createFromModal(fields) {
    await createReferral(fields);
    setAdding(false);
    showToast(t("referralAdded"));
  }
  async function updateFromModal(fields) {
    await updateReferral(editing.id, fields);
    setEditing(null);
    showToast(t("referralUpdated"));
  }
  async function removeReferral() {
    const ok = await requestConfirm(t("removeReferralConfirm"), { danger: true });
    if (!ok) return;
    await deleteReferral(editing.id);
    setEditing(null);
  }
  function handOffToPlacement() {
    const r = editing;
    setEditing(null);
    navigate("/placements", {
      state: { prefill: { jobClientId: r.jobClientId, employerId: r.employerId, jobOpeningId: r.jobOpeningId, referralId: r.id, positionTitle: r.positionTitle } }
    });
  }

  function renderBoard() {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {REFERRAL_STAGES.map(function (stage) {
          const stageReferrals = sorted.filter(function (r) { return r.status === stage.key; });
          return (
            <div
              key={stage.key}
              className={cn(
                "flex w-[280px] shrink-0 flex-col overflow-hidden rounded-[16px] border bg-card shadow-card transition-shadow",
                // A plain `ring-2` on purpose: an opacity modifier on this
                // palette (ring-primary/30) compiles to an invalid
                // rgb(var(--primary) / .3) and is dropped, and main.css
                // already points --tw-ring-color at the NB4HS focus halo.
                dropHover === stage.key ? "border-primary ring-2" : "border-border"
              )}
              onDragOver={function (e) { e.preventDefault(); setDropHover(stage.key); }}
              onDragLeave={function () { setDropHover(function (cur) { return cur === stage.key ? null : cur; }); }}
              onDrop={function (e) { handleDrop(e, stage.key); }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3.5 py-3">
                <span className="truncate text-sm font-bold text-card-foreground">{stage.en}</span>
                <span className="rounded-full bg-tint-neutral px-2 py-0.5 text-xs font-semibold text-muted">{stageReferrals.length}</span>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2 p-2.5">
                {stageReferrals.length === 0 ? (
                  <p className="m-0 py-4 text-center text-xs text-muted">{t("noReferralsYetLabel")}</p>
                ) : (
                  stageReferrals.map(function (r) {
                    return <ReferralCard key={r.id} referral={r} lang={lang} onClick={function () { setEditing(r); }} />;
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderResults() {
    if (referrals.length === 0) {
      return (
        <ResultsEmptyState
          icon={Send} title={t("noReferralsTitle")} description={t("noReferralsDesc")}
          actionLabel={t("addReferralBtn")} actionIcon={Plus} onAction={function () { setAdding(true); }}
        />
      );
    }
    if (sorted.length === 0) {
      return (
        <ResultsEmptyState
          icon={Send} title={t("noMatchingReferralsTitle")} description={t("noMatchingReferralsDesc")}
          actionLabel={t("clearAllLabel")} actionIcon={RotateCcw} actionVariant="secondary" onAction={clearAll}
        />
      );
    }
    if (view === "board") return renderBoard();
    return (
      <div className="flex flex-col gap-3">
        {sorted.map(function (r) {
          return <ReferralListItem key={r.id} referral={r} lang={lang} onEdit={setEditing} />;
        })}
      </div>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1">{t("referralsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("referralsDesc")}</p>
        </div>
        <Button onClick={function () { setAdding(true); }} className="h-12 gap-2 rounded-[12px] px-6 text-[15px]">
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" /> {t("addReferralBtn")}
        </Button>
      </div>

      {referrals.length > 0 && (
        <SearchFilterPanel
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("referralSearchPlaceholder")}
          filters={filters}
          activeCount={activeFilterCount}
          onClearAll={clearAll}
        />
      )}

      <div className="mt-5">{renderResults()}</div>

      {referrals.length > 0 && (
        <div className="mt-5">
          <ResultsToolbar
            id="referrals"
            total={sorted.length}
            sort={sort}
            onSortChange={setSort}
            sortOptions={sortOptions}
            view={view}
            onViewChange={setView}
            views={VIEWS}
          />
        </div>
      )}

      {adding && (
        <ReferralFormModal
          jobClients={eligibleJobClients} jobOpenings={openJobOpenings} jobDevelopers={jobDevelopers}
          onSave={createFromModal} onCancel={function () { setAdding(false); }}
        />
      )}
      {editing && (
        <ReferralFormModal
          referral={editing} jobClients={eligibleJobClients} jobOpenings={openJobOpenings} jobDevelopers={jobDevelopers}
          placements={data.placements || []} onCreatePlacement={handOffToPlacement}
          onSave={updateFromModal} onCancel={function () { setEditing(null); }} onDelete={removeReferral}
        />
      )}
    </>
  );
}
