// Assessments.jsx -- the Assessments section of Adult Education (AdultEdNav), listing every enrolled student's pretest/posttest
// NRS level (CASAS Reading STEPS, see assessments.js), gain/no-gain/flag
// status, and Outcome. Pretest/posttest scores are still entered via each
// student's edit form on the Students board (per the client's "Both" answer
// -- edit inline, review here); the Outcome dropdown (Working/Schedule
// Retest) is editable directly from this table since it's not tied to the
// score-entry form -- "Completed" is automatic once a gain is achieved and
// isn't editable either place. No new fields (e.g. test dates) were
// invented since none exist on the student record -- see assessments.js.
//
// On the NB4HS Operate design system (plans/ui-design-system.md):
// PageHeader, KpiCard row, FilterBar + FilterChips, DataTable (stacked rows
// below lg) with Pagination, and a Dialog for the assessment details.
// Every data computation still comes from lib/assessments.js/lib/
// students.js and updateStudent(); only the presentation changed.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, Clock, Download, Eye, GraduationCap, IdCard, Pencil, Users } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { studentAssessmentStatus } from "../lib/assessments.js";
import { avatarColorFor } from "../lib/avatarTone.js";
import { cn } from "../lib/cn.js";
import { paginateList } from "../lib/pagination.js";
import { classByKey, sortStudentsList, studentMatchesSearch } from "../lib/students.js";
import { downloadBlob, formatPhone, initialsOf } from "../lib/utils.js";
import { updateStudent } from "../lib/checkinData.js";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import Pagination from "../components/Pagination.jsx";
import { Alert } from "../components/ui/alert.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { BUTTON_RESET, Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { Dialog } from "../components/ui/dialog.jsx";
import { DetailRow } from "../components/ui/drawer.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { Select } from "../components/ui/field.jsx";
import { FilterBar, FilterField } from "../components/ui/filter-bar.jsx";
import { FilterChips } from "../components/ui/filter-chips.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SearchInput } from "../components/ui/search-input.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";
import AdultEdNav from "../components/AdultEdNav.jsx";

const QUICK_FILTERS = ["all", "noPretest", "flagged", "completed", "gain", "noGain"];

// Classroom dots: the same per-classroom accents as the Students board's
// columns (students.js columnAccentColor -> COLUMN_ACCENTS), as tone
// classes. Categorical, not a status; the classroom name carries the meaning.
const CLASS_DOT = ["bg-tone-info-solid", "bg-tone-success-solid", "bg-tone-warning-solid", "bg-tone-violet-solid"];
function classDotClass(classKey, activeClasses) {
  if (!classKey) return "bg-tone-warning-solid"; // waiting list (gold on the board)
  const i = activeClasses.findIndex((c) => c.key === classKey);
  return CLASS_DOT[Math.max(0, i) % CLASS_DOT.length];
}

function ClassroomLabel({ student, activeClasses, classes, t }) {
  const cls = classByKey(classes, student.classKey);
  return (
    <span className="inline-flex items-center gap-1.5 text-ui text-card-foreground">
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-chip", classDotClass(student.classKey, activeClasses))} />
      {cls ? cls.name : t("waitingList")}
    </span>
  );
}

function AssessmentStatus({ assessment, t }) {
  if (assessment.status === "noPretest") return <span className="text-muted">—</span>;
  if (assessment.status === "posttestMissing") return <StatusBadge domain="assessment" status="posttestMissing">{t("posttestNotCompletedFlag")}</StatusBadge>;
  return assessment.gain
    ? <StatusBadge domain="assessment" status="gain">{t("gainLabel")}</StatusBadge>
    : <StatusBadge domain="assessment" status="noGain">{t("noGainLabel")}</StatusBadge>;
}

function OutcomeCell({ assessment, t, onSetOutcome, id }) {
  if (!assessment.outcome) return <span className="text-muted">—</span>;
  if (!assessment.outcomeEditable) return <StatusBadge domain="assessment" status="completed">{t("outcomeCompleted")}</StatusBadge>;
  return (
    <Select
      id={id}
      aria-label={t("outcomeLabel")}
      value={assessment.outcome}
      onChange={(e) => onSetOutcome(e.target.value)}
      className="h-9 w-auto min-w-[10rem]"
    >
      <option value="working">{t("outcomeWorking")}</option>
      <option value="scheduleRetest">{t("outcomeScheduleRetest")}</option>
    </Select>
  );
}

// Assessment details for one student. A Dialog (protected focus) because
// the Outcome can be changed from here. Same row/assessment shape, the same
// editable Outcome and the same "Edit Student" link to /students with
// presetSearch as before.
function AssessmentDetailDialog({ row, onClose, onSetOutcome }) {
  const { data, lang } = useApp();
  const t = useT();
  const student = row ? row.student : null;
  const assessment = row ? row.assessment : null;
  const name = student ? student.firstName + " " + student.lastName : "";
  const currentClass = student ? classByKey(data.classes, student.classKey) : null;
  const hint = t("editInStudentsHint");
  const hintSplit = lang === "en" ? hint.replace(" Students page.", "|Students page.") : hint;
  const [hintPrefix, hintLink] = hintSplit.indexOf("|") !== -1 ? hintSplit.split("|") : [hint, null];

  return (
    <Dialog
      open={!!row}
      onClose={onClose}
      title={t("assessmentDetailsTitle")}
      size="sm"
      closeLabel={t("closeLabel")}
      className="no-print"
      footer={
        <>
          <Button asChild variant="secondary">
            <Link to="/students" state={{ presetSearch: name }} onClick={onClose} className="no-underline">
              <Pencil className="h-4 w-4" aria-hidden="true" />{t("editStudentTitle")}
            </Link>
          </Button>
          <Button onClick={onClose} data-autofocus>{t("closeLabel")}</Button>
        </>
      }
    >
      {row ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-12 w-12"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
              {!student.droppedOut ? <span aria-hidden="true" className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-chip border-2 border-solid border-card bg-tone-success-solid" /> : null}
            </div>
            <div className="min-w-0">
              <div className="truncate text-section font-semibold text-card-foreground">{name}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {student.studentId ? <Badge variant="neutral"><IdCard className="h-3 w-3" aria-hidden="true" /><span className="tabular-nums">{student.studentId}</span></Badge> : null}
                <Badge variant="neutral"><GraduationCap className="h-3 w-3" aria-hidden="true" />{currentClass ? currentClass.name : t("waitingList")}</Badge>
              </div>
            </div>
          </div>

          <dl className="m-0">
            <DetailRow label={t("phoneNumberLabel")}>{formatPhone(student.phone) || "—"}</DetailRow>
            <DetailRow label={t("pretestScoreLabel")}>{assessment.pretestLevel ? student.pretestReading : "—"}</DetailRow>
            <DetailRow label={t("posttestScoreLabel")}>
              {assessment.posttestLevel ? student.posttestReading
                : assessment.status === "posttestMissing" ? <StatusBadge domain="assessment" status="posttestMissing">{t("posttestNotCompletedFlag")}</StatusBadge>
                : "—"}
            </DetailRow>
            {assessment.status === "complete" ? (
              <DetailRow label={t("gainLabel")}><AssessmentStatus assessment={assessment} t={t} /></DetailRow>
            ) : null}
            <DetailRow label={t("outcomeLabel")}>
              <OutcomeCell assessment={assessment} t={t} onSetOutcome={onSetOutcome} />
            </DetailRow>
          </dl>

          <Alert tone="info" className="mt-4">
            {hintPrefix}
            {hintLink ? <span className="font-semibold"> {hintLink}</span> : null}
          </Alert>
        </>
      ) : null}
    </Dialog>
  );
}

export default function Assessments() {
  const { data, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [classroomFilter, setClassroomFilter] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailId, setDetailId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const term = search.trim().toLowerCase();
  const active = (data.students || []).filter((s) => s.active !== false);
  const withAssessment = active.map((s) => ({ student: s, assessment: studentAssessmentStatus(s) }));

  const total = withAssessment.length;
  const completedCount = withAssessment.filter((x) => x.assessment.status === "complete").length;
  const inProgressCount = withAssessment.filter((x) => x.assessment.status === "posttestMissing").length;
  const notStartedCount = withAssessment.filter((x) => x.assessment.status === "noPretest").length;
  const completionRate = total ? Math.round((completedCount / total) * 100) : 0;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0) + "%";

  function matchesQuickFilter(x, mode) {
    if (mode === "gain") return x.assessment.status === "complete" && x.assessment.gain;
    if (mode === "noGain") return x.assessment.status === "complete" && !x.assessment.gain;
    if (mode === "completed") return x.assessment.status === "complete";
    if (mode === "flagged") return x.assessment.status === "posttestMissing";
    if (mode === "noPretest") return x.assessment.status === "noPretest";
    return true;
  }

  const filtered = withAssessment.filter((x) => {
    if (!studentMatchesSearch(x.student, term)) return false;
    if (classroomFilter === "waiting" && x.student.classKey) return false;
    if (classroomFilter !== "all" && classroomFilter !== "waiting" && x.student.classKey !== classroomFilter) return false;
    return matchesQuickFilter(x, filterMode);
  });
  const sorted = sortStudentsList(filtered.map((x) => ({ firstName: x.student.firstName, lastName: x.student.lastName, __ref: x }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page, pageSize);
  const detailRow = detailId ? withAssessment.find((x) => x.student.id === detailId) || null : null;
  const allOnPageSelected = paged.items.length > 0 && paged.items.every(({ student }) => selected.has(student.id));

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.items.forEach(({ student }) => next.delete(student.id));
      else paged.items.forEach(({ student }) => next.add(student.id));
      return next;
    });
  }

  async function setOutcome(id, outcome) {
    await updateStudent(id, { outcome });
  }

  function updateFilterMode(mode) { setFilterMode(mode); setPage(1); }
  function resetFilters() { setSearch(""); setClassroomFilter("all"); setFilterMode("all"); setPage(1); }

  function exportCsv(rowsToExport, filenameSuffix) {
    const header = [t("nameLabel"), t("nbIdLabel"), t("classroomLabel"), t("pretestLabel"), t("posttestLabel"), t("statusLabel"), t("outcomeLabel")];
    const rows = rowsToExport.map(({ student, assessment }) => {
      const cls = classByKey(data.classes, student.classKey);
      const status = assessment.status === "noPretest" ? "—" : assessment.status === "posttestMissing" ? t("posttestNotCompletedFlag") : (assessment.gain ? t("gainLabel") : t("noGainLabel"));
      const outcome = !assessment.outcome ? "—" : (assessment.outcomeEditable ? (assessment.outcome === "working" ? t("outcomeWorking") : t("outcomeScheduleRetest")) : t("outcomeCompleted"));
      return [
        student.firstName + " " + student.lastName, student.studentId || "",
        cls ? cls.name : t("waitingList"),
        assessment.pretestLevel ? student.pretestReading : "—",
        assessment.posttestLevel ? student.posttestReading : "—",
        status, outcome
      ];
    });
    const csv = [header].concat(rows).map((r) => r.map((v) => "\"" + String(v).replace(/"/g, "\"\"") + "\"").join(",")).join("\r\n");
    downloadBlob(csv, "NB4HS-Student-Assessments" + (filenameSuffix || "") + ".csv", "text/csv;charset=utf-8;");
    showToast(t("exportLabel") + " ✓");
  }

  function exportSelected() {
    exportCsv(withAssessment.filter((x) => selected.has(x.student.id)), "-Selected");
  }

  const quickFilterLabel = { all: t("assessmentFilterAll"), noPretest: t("assessmentFilterNoPretest"), flagged: t("assessmentFilterFlagged"), completed: t("assessmentFilterCompleted"), gain: t("assessmentFilterGain"), noGain: t("assessmentFilterNoGain") };
  const activeFilterCount = (classroomFilter !== "all" ? 1 : 0) + (filterMode !== "all" ? 1 : 0);

  function nameCell(student, large) {
    const name = student.firstName + " " + student.lastName;
    return (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className={large ? "h-10 w-10" : "h-9 w-9"}><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setDetailId(student.id)}
            className={cn(BUTTON_RESET, "block max-w-full truncate rounded-badge text-left text-ui font-semibold text-card-foreground transition-colors duration-fast hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2")}
          >
            {name}
          </button>
          <div className="truncate text-meta tabular-nums text-muted">{formatPhone(student.phone) || "—"}</div>
        </div>
      </div>
    );
  }

  function rowActions(student) {
    const name = student.firstName + " " + student.lastName;
    return (
      <div className="flex items-center justify-end gap-0.5">
        <IconButton size="sm" label={t("viewLabel")} onClick={() => setDetailId(student.id)}><Eye aria-hidden="true" /></IconButton>
        <IconButton size="sm" label={t("editStudentTitle")} onClick={() => navigate("/students", { state: { presetSearch: name } })}>
          <Pencil aria-hidden="true" />
        </IconButton>
      </div>
    );
  }

  const columns = [
    { key: "name", header: t("nameLabel"), cell: ({ student }) => nameCell(student) },
    { key: "nbId", header: t("nbIdLabel"), cell: ({ student }) => student.studentId ? <Badge variant="neutral" className="tabular-nums">{student.studentId}</Badge> : <span className="text-muted">—</span> },
    { key: "classroom", header: t("classroomLabel"), cell: ({ student }) => <ClassroomLabel student={student} activeClasses={activeClasses} classes={data.classes} t={t} /> },
    { key: "pretest", header: t("pretestLabel"), cell: ({ student, assessment }) => assessment.pretestLevel ? student.pretestReading : "—" },
    { key: "posttest", header: t("posttestLabel"), cell: ({ student, assessment }) => assessment.posttestLevel ? student.posttestReading : "—" },
    { key: "status", header: t("statusLabel"), cell: ({ assessment }) => <AssessmentStatus assessment={assessment} t={t} /> },
    { key: "outcome", header: t("outcomeLabel"), cell: ({ student, assessment }) => <OutcomeCell assessment={assessment} t={t} onSetOutcome={(v) => setOutcome(student.id, v)} /> },
    { key: "actions", header: <span className="sr-only">{t("actionsLabel")}</span>, className: "w-px", cell: ({ student }) => rowActions(student) }
  ];

  function renderAssessmentCard({ student, assessment }) {
    return (
      <div>
        <div className="flex items-start justify-between gap-2">
          {nameCell(student, true)}
          {rowActions(student)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta tabular-nums text-muted">
          <ClassroomLabel student={student} activeClasses={activeClasses} classes={data.classes} t={t} />
          {student.studentId ? <span>{t("nbIdLabel")}: {student.studentId}</span> : null}
          <span>{t("pretestLabel")}: {assessment.pretestLevel ? student.pretestReading : "—"}</span>
          <span>{t("posttestLabel")}: {assessment.posttestLevel ? student.posttestReading : "—"}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <AssessmentStatus assessment={assessment} t={t} />
          {assessment.outcome ? (
            <OutcomeCell assessment={assessment} t={t} onSetOutcome={(v) => setOutcome(student.id, v)} />
          ) : null}
        </div>
      </div>
    );
  }

  const emptyState = total ? (
    <EmptyState
      variant="no-results"
      title={t("assessmentsNoResultsTitle")}
      description={t("assessmentsNoResultsHint")}
      action={<Button variant="secondary" onClick={resetFilters}>{t("clearFilters")}</Button>}
    />
  ) : (
    <EmptyState
      icon={Users}
      title={t("assessmentsEmptyTitle")}
      description={t("assessmentsEmptyHint")}
      action={<Button asChild><Link to="/students/students" className="no-underline">{t("assessmentsGoToStudents")}</Link></Button>}
    />
  );

  return (
    <>
      <AdultEdNav value="assessments" />
      <PageHeader
        title={t("assessmentsTitle")}
        description={t("assessmentsDesc")}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportCsv(sorted)}><Download className="h-4 w-4" aria-hidden="true" />{t("exportLabel")}</Button>
            <Button asChild><Link to="/students/classrooms" className="no-underline"><Pencil className="h-4 w-4" aria-hidden="true" />{t("addAssessmentLabel")}</Link></Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("assessStatTotalLabel")} value={total} icon={Users} tone="info" hint={t("assessStatEnrolledSublabel")} />
        <KpiCard label={t("assessStatCompletedLabel")} value={completedCount} icon={CheckCircle2} tone="success" hint={pct(completedCount)} />
        <KpiCard label={t("assessStatInProgressLabel")} value={inProgressCount} icon={Clock} tone="warning" hint={pct(inProgressCount)} />
        <KpiCard label={t("assessStatNotStartedLabel")} value={notStartedCount} icon={Circle} tone="neutral" hint={pct(notStartedCount)} />
      </div>

      <Card className="mb-6 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span id="assess-progress-label" className="text-ui font-semibold text-card-foreground">{t("assessProgressTitle")}</span>
          <span className="text-ui font-semibold tabular-nums text-primary">{completionRate}%</span>
        </div>
        <div
          role="progressbar"
          aria-labelledby="assess-progress-label"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={completionRate}
          className="mt-2 h-2.5 w-full overflow-hidden rounded-chip bg-tone-neutral-bg"
        >
          {/* Width is the computed completion rate -- a genuinely dynamic value. */}
          <div className="h-full rounded-chip bg-primary transition-[width] duration-base" style={{ width: completionRate + "%" }} />
        </div>
        <p className="m-0 mt-2 text-meta tabular-nums text-muted">{t("assessProgressSublabel").replace("{n}", String(completedCount)).replace("{total}", String(total))}</p>
      </Card>

      <FilterBar
        search={
          <SearchInput
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onClear={() => { setSearch(""); setPage(1); }}
            clearLabel={t("clearLabel")}
            placeholder={t("studentSearchPlaceholder")}
            aria-label={t("studentSearchPlaceholder")}
          />
        }
        activeCount={activeFilterCount}
        canClear={activeFilterCount > 0 || !!search}
        onClear={resetFilters}
        clearLabel={t("clearFilters")}
        filtersLabel={t("filtersLabel")}
        gridClassName="sm:grid-cols-2 lg:grid-cols-3"
      >
        <FilterField label={t("classroomLabel")} htmlFor="assess-filter-classroom">
          <Select id="assess-filter-classroom" value={classroomFilter} onChange={(e) => { setClassroomFilter(e.target.value); setPage(1); }}>
            <option value="all">{t("allClassroomsLabel")}</option>
            <option value="waiting">{t("waitingList")}</option>
            {activeClasses.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      <Card className="p-4 sm:p-5">
        <FilterChips
          label={t("statusLabel")}
          value={filterMode}
          onChange={updateFilterMode}
          options={QUICK_FILTERS.map((mode) => ({ value: mode, label: quickFilterLabel[mode] }))}
        />
        <p className="m-0 mb-3 mt-4 text-ui tabular-nums text-muted" aria-live="polite">
          {t("showingResultsLabel").replace("{shown}", String(paged.items.length)).replace("{total}", String(paged.total))}
        </p>

        <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button variant="secondary" size="sm" onClick={exportSelected}><Download className="h-4 w-4" aria-hidden="true" />{t("exportSelectedLabel")}</Button>
        </BulkActionsBar>

        <DataTable
          caption={t("assessmentsTitle")}
          columns={columns}
          rows={paged.items}
          getRowId={(x) => x.student.id}
          selection={{
            selected,
            onToggle: toggleSelect,
            onToggleAll: toggleSelectAll,
            allLabel: t("selectAllLabel"),
            rowLabel: (x) => x.student.firstName + " " + x.student.lastName
          }}
          renderCard={renderAssessmentCard}
          empty={emptyState}
        />

        {paged.total ? (
          <Pagination
            bare
            page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelStudents")}
            onChange={(delta) => setPage(paged.page + delta)}
          />
        ) : null}
      </Card>

      <AssessmentDetailDialog
        row={detailRow}
        onClose={() => setDetailId(null)}
        onSetOutcome={(v) => setOutcome(detailId, v)}
      />
    </>
  );
}
