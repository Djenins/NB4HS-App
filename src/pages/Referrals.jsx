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
// Layout follows the design system's list template: PageHeader, then the
// filter panel, then the toolbar ABOVE the results, then the results. The
// board's columns are surface-sunken wells like Students.jsx's classroom
// board, each with a tone dot from statusTone("referral", stage) and a count
// badge. Only the list view paginates; a kanban board shows every card.
//
// Unlike every other mutation on this page, handleDrop() awaits its update
// and surfaces a toast on failure -- a dropped card that silently failed to
// save would otherwise look successful (it visually snaps back next
// re-render, but with no explanation) until the user noticed the count was
// wrong.
import { useState } from "react";
import { KanbanSquare, List, Plus, RotateCcw, Send } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeJobDevelopers } from "../lib/appointments.js";
import { isCandidateEligible } from "../lib/candidateMatching.js";
import { createReferral, deleteReferral, updateReferral } from "../lib/clientsData.js";
import { paginateList } from "../lib/pagination.js";
import { REFERRAL_STAGES } from "../lib/referrals.js";
import { statusTone } from "../lib/statusTone.js";
import { todayStr } from "../lib/utils.js";
import { matchesReferral } from "../lib/workforceFilters.js";
import { sortReferrals } from "../lib/workforceSorters.js";
import { cn } from "../lib/cn.js";
import Pagination from "../components/Pagination.jsx";
import ReferralCard from "../components/ReferralCard.jsx";
import ReferralFormModal from "../components/ReferralFormModal.jsx";
import ReferralListItem from "../components/ReferralListItem.jsx";
import ResultsEmptyState from "../components/ResultsEmptyState.jsx";
import ResultsToolbar from "../components/ResultsToolbar.jsx";
import SearchFilterPanel from "../components/SearchFilterPanel.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";

// Board first: this page's default answer to "where is everyone in the
// pipeline" is the column shape, not a sorted list.
const VIEWS = [
  { value: "board", icon: KanbanSquare, labelKey: "boardViewLabel" },
  { value: "list", icon: List, labelKey: "listViewLabel" }
];

// Solid dot per tone for a column header. Static class names so Tailwind
// can see them; the tone itself comes from statusTone() (same as
// Students.jsx's ToneDot). The column's name always sits beside it.
const TONE_DOT = {
  info: "bg-tone-info-solid",
  success: "bg-tone-success-solid",
  warning: "bg-tone-warning-solid",
  danger: "bg-tone-danger-solid",
  neutral: "bg-tone-neutral-solid",
  violet: "bg-tone-violet-solid"
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const referrals = data.referrals || [];
  const eligibleJobClients = (data.jobClients || []).filter(isCandidateEligible);
  const openJobOpenings = (data.jobOpenings || []).filter(function (o) { return o.status !== "archived"; });
  const jobDevelopers = activeJobDevelopers(data.profiles);

  // Any change to what's shown starts the list back on page 1.
  function setFilter(setter) {
    return function (value) { setter(value); setPage(1); };
  }

  const filters = [
    {
      key: "stage", label: t("stageLabel"), value: stageFilter, onChange: setFilter(setStageFilter),
      options: [{ value: "", label: t("allStagesLabel") }]
        .concat(REFERRAL_STAGES.map(function (s) { return { value: s.key, label: s.en }; }))
    },
    {
      key: "employer", label: t("employerLabel"), value: employerFilter, onChange: setFilter(setEmployerFilter),
      options: [{ value: "", label: t("allEmployersLabel") }]
        .concat(distinct(referrals, "employerName").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "position", label: t("positionLabel"), value: positionFilter, onChange: setFilter(setPositionFilter),
      options: [{ value: "", label: t("allPositionsLabel") }]
        .concat(distinct(referrals, "positionTitle").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "developer", label: t("assignedJobDeveloperLabel"), value: developerFilter, onChange: setFilter(setDeveloperFilter),
      options: [{ value: "", label: t("allJobDevelopersLabel") }]
        .concat(distinct(referrals, "assignedJobDeveloperEmail").map(function (n) { return { value: n, label: n }; }))
    },
    {
      key: "date", label: t("referralDateLabel"), value: dateFilter, onChange: setFilter(setDateFilter),
      options: [
        { value: "", label: t("anyTimeLabel") },
        { value: "7", label: t("last7DaysLabel") },
        { value: "30", label: t("last30DaysLabel") },
        { value: "90", label: t("last90DaysLabel") }
      ]
    },
    {
      key: "interview", label: t("interviewLabel"), value: interviewFilter, onChange: setFilter(setInterviewFilter),
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
    setPage(1);
  }

  const term = search.trim().toLowerCase();
  const filterValues = {
    stage: stageFilter, employer: employerFilter, position: positionFilter,
    developer: developerFilter, date: dateFilter, interview: interviewFilter
  };
  const matched = referrals.filter(function (r) {
    return matchesReferral(r, filterValues, { today: todayStr(), term });
  });
  const sorted = sortReferrals(matched, sort);
  // Only the list view pages; the board always shows every filtered card.
  const paged = paginateList(sorted, page, pageSize);

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
    navigate("/workforce/placements", {
      state: { prefill: { jobClientId: r.jobClientId, employerId: r.employerId, jobOpeningId: r.jobOpeningId, referralId: r.id, positionTitle: r.positionTitle } }
    });
  }

  function renderBoard() {
    return (
      <>
        <p className="m-0 mb-3 text-meta text-muted">{t("referralBoardDragHint")}</p>
        {/* The board scrolls sideways inside its own box (eight fixed-width
            columns never fit a phone), so the page itself never does. */}
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-3">
          {REFERRAL_STAGES.map(function (stage) {
            const stageReferrals = sorted.filter(function (r) { return r.status === stage.key; });
            const headingId = "referral-stage-" + stage.key;
            return (
              <section
                key={stage.key}
                aria-labelledby={headingId}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-surface border bg-surface-sunken transition-[border-color,box-shadow] duration-fast",
                  // A plain `ring-2`: main.css already points --tw-ring-color
                  // at the NB4HS focus halo.
                  dropHover === stage.key ? "border-primary ring-2" : "border-border"
                )}
                onDragOver={function (e) { e.preventDefault(); setDropHover(stage.key); }}
                onDragLeave={function () { setDropHover(function (cur) { return cur === stage.key ? null : cur; }); }}
                onDrop={function (e) { handleDrop(e, stage.key); }}
              >
                <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-chip", TONE_DOT[statusTone("referral", stage.key)] || TONE_DOT.neutral)} />
                    <h2 id={headingId} className="m-0 truncate text-ui font-semibold text-card-foreground">{stage.en}</h2>
                  </div>
                  <Badge variant="neutral" className="tabular-nums">{stageReferrals.length}</Badge>
                </div>
                <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 px-3 pb-3 pt-1">
                  {stageReferrals.length === 0 ? (
                    <p className="m-0 px-2 py-6 text-center text-meta text-muted">{t("noReferralsYetLabel")}</p>
                  ) : (
                    stageReferrals.map(function (r) {
                      return <ReferralCard key={r.id} referral={r} lang={lang} onClick={function () { setEditing(r); }} />;
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </>
    );
  }

  function renderResults() {
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
      <>
        <div className="flex flex-col gap-3">
          {paged.items.map(function (r) {
            return <ReferralListItem key={r.id} referral={r} lang={lang} onEdit={setEditing} />;
          })}
        </div>
        <Pagination
          bare
          page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
          onPageSizeChange={function (n) { setPageSize(n); setPage(1); }} itemLabel={t("resultsLabel")}
          onChange={function (delta) { setPage(paged.page + delta); }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("referralsTitle")}
        description={t("referralsDesc")}
        actions={
          <Button onClick={function () { setAdding(true); }}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("addReferralBtn")}
          </Button>
        }
      />

      {referrals.length === 0 ? (
        <ResultsEmptyState
          icon={Send} title={t("noReferralsTitle")} description={t("noReferralsDesc")}
          actionLabel={t("addReferralBtn")} actionIcon={Plus} onAction={function () { setAdding(true); }}
        />
      ) : (
        <>
          <SearchFilterPanel
            search={search}
            onSearchChange={function (value) { setSearch(value); setPage(1); }}
            searchPlaceholder={t("referralSearchPlaceholder")}
            filters={filters}
            activeCount={activeFilterCount}
            onClearAll={clearAll}
          />
          <div className="mt-6">
            <ResultsToolbar
              id="referrals"
              total={sorted.length}
              sort={sort}
              onSortChange={function (value) { setSort(value); setPage(1); }}
              sortOptions={sortOptions}
              view={view}
              onViewChange={function (value) { setView(value); setPage(1); }}
              views={VIEWS}
            />
            {renderResults()}
          </div>
        </>
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
