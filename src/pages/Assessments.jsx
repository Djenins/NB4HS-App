// Assessments.jsx -- page listing every enrolled student's pretest/posttest
// NRS level (CASAS Reading STEPS, see assessments.js), gain/no-gain/flag
// status, and Outcome. Pretest/posttest scores are still entered via each
// student's edit form on the Students board (per the client's "Both" answer
// -- edit inline, review here); the Outcome dropdown (Working/Schedule
// Retest) is editable directly from this table since it's not tied to the
// score-entry form -- "Completed" is automatic once a gain is achieved and
// isn't editable either place. Tailwind/shadcn redesign pass, same idiom as
// Students.jsx -- every data computation below still comes from the existing
// lib/assessments.js/lib/students.js helpers and AppContext's setData; only
// the presentation layer changed. No new fields (e.g. test dates) were
// invented since none exist on the student record -- see assessments.js.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2, Circle, ClipboardList, Clock, Download, Eye, FileBarChart2, GraduationCap, IdCard, Info, Pencil, Phone,
  Search, Target, TrendingUp, Users, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { studentAssessmentStatus } from "../lib/assessments.js";
import { cn } from "../lib/cn.js";
import { paginateList } from "../lib/pagination.js";
import { classByKey, columnAccentColor, sortStudentsList, studentMatchesSearch } from "../lib/students.js";
import { downloadBlob, formatPhone, initialsOf } from "../lib/utils.js";
import { updateStudent } from "../lib/checkinData.js";
import { avatarColorFor } from "../components/StudentCard.jsx";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent } from "../components/ui/card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";

const QUICK_FILTERS = ["all", "noPretest", "flagged", "completed", "gain", "noGain"];

function KpiStat({ icon: Icon, tint, label, value, sublabel, index }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.05 }}>
      <Card className="transition-shadow hover:shadow-card-hover">
        <CardContent className="flex items-center gap-3 p-5">
          <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + tint}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-muted">{label}</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-card-foreground">{value}</div>
            {sublabel ? <div className="mt-0.5 truncate text-xs text-muted">{sublabel}</div> : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatusPill({ assessment, t }) {
  if (assessment.status === "noPretest") return <span className="text-sm text-muted">—</span>;
  if (assessment.status === "posttestMissing") return <Badge variant="warn">{t("posttestNotCompletedFlag")}</Badge>;
  return <Badge variant={assessment.gain ? "success" : "neutral"}>{assessment.gain ? t("gainLabel") : t("noGainLabel")}</Badge>;
}

function OutcomeCell({ assessment, t, onSetOutcome }) {
  if (!assessment.outcome) return <span className="text-sm text-muted">—</span>;
  if (!assessment.outcomeEditable) return <Badge variant="success">{t("outcomeCompleted")}</Badge>;
  return (
    <select
      aria-label={t("outcomeLabel")}
      value={assessment.outcome}
      onChange={(e) => onSetOutcome(e.target.value)}
      className="h-9 min-h-0 w-full min-w-[140px] rounded-lg border border-border bg-background py-0 pl-3 pr-8 text-sm font-medium text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
    >
      <option value="working">{t("outcomeWorking")}</option>
      <option value="scheduleRetest">{t("outcomeScheduleRetest")}</option>
    </select>
  );
}

// One full-width info row in the detail modal -- icon + label on the left,
// value/badge on the right, per the reference "Assessment Details" mockup.
function DetailRow({ icon: Icon, iconClassName, label, children }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-border bg-card px-3.5 py-2">
      <span className="flex items-center gap-2 text-sm font-medium text-muted">
        <Icon className={cn("h-4 w-4 shrink-0", iconClassName)} />
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-card-foreground">{children}</span>
    </div>
  );
}

// Escape-to-close + a basic Tab focus trap for the modal, since this project
// has no Radix Dialog installed yet (only Avatar/DropdownMenu/Tooltip) --
// hand-rolled rather than pulling in a new dependency.
function useModalA11y(active, containerRef, onClose) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement;
    const focusable = () => Array.from(container.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter((el) => !el.disabled && el.offsetParent !== null);
    const first = focusable()[0];
    if (first) first.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [active, containerRef, onClose]);
}

// Reuses the app's .modal-overlay backdrop (same pattern as Search.jsx's
// visit-detail modal) but a bespoke wide/rounded box instead of the shared
// .modal-box (max-width 420) -- redesigned per a reference "Assessment
// Details" mockup the client shared. All data/handlers unchanged: still the
// same row/assessment shape, the same editable Outcome dropdown, and the
// same "Edit Student" link to /students with presetSearch.
function AssessmentDetailModal({ row, onClose, onSetOutcome }) {
  const { data, lang } = useApp();
  const t = useT();
  const containerRef = useRef(null);
  useModalA11y(!!row, containerRef, onClose);
  if (!row) return null;
  const { student, assessment } = row;
  const name = student.firstName + " " + student.lastName;
  const currentClass = classByKey(data.classes, student.classKey);
  const hint = t("editInStudentsHint");
  const hintSplit = lang === "en" ? hint.replace(" Students page.", "|Students page.") : hint;
  const [hintPrefix, hintLink] = hintSplit.indexOf("|") !== -1 ? hintSplit.split("|") : [hint, null];

  return (
    <div className="modal-overlay no-print" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assessment-details-title"
        className="relative w-full max-h-[90vh] overflow-y-auto rounded-[22px] border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95"
        style={{ maxWidth: 460 }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-tint text-primary">
              <FileBarChart2 className="h-4.5 w-4.5" />
            </div>
            <h2 id="assessment-details-title" className="m-0 text-lg font-extrabold leading-tight tracking-tight text-card-foreground">
              {t("assessmentDetailsTitle")}
            </h2>
          </div>
          <Button variant="ghost" size="icon" aria-label={t("closeLabel")} onClick={onClose} className="h-8 w-8 shrink-0 rounded-lg text-muted hover:bg-background">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-14 w-14"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
            {!student.droppedOut ? <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-success" /> : null}
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight text-card-foreground">{name}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {student.studentId && <Badge className="gap-1"><IdCard className="h-3 w-3" />{student.studentId}</Badge>}
              <Badge variant="neutral" className="gap-1"><GraduationCap className="h-3 w-3" />{currentClass ? currentClass.name : t("waitingList")}</Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <DetailRow icon={Phone} iconClassName="text-violet-600" label={t("phoneNumberLabel")}>
            {formatPhone(student.phone) || "—"}
          </DetailRow>

          <DetailRow icon={ClipboardList} iconClassName="text-primary" label={t("pretestScoreLabel")}>
            {assessment.pretestLevel ? <Badge className="px-2.5 py-1">{student.pretestReading}</Badge> : "—"}
          </DetailRow>

          <DetailRow icon={ClipboardList} iconClassName="text-success" label={t("posttestScoreLabel")}>
            {assessment.posttestLevel ? (
              <Badge variant="success" className="px-2.5 py-1">{student.posttestReading}</Badge>
            ) : assessment.status === "posttestMissing" ? (
              <Badge variant="warn">{t("posttestNotCompletedFlag")}</Badge>
            ) : "—"}
          </DetailRow>

          {assessment.status === "complete" ? (
            <DetailRow icon={TrendingUp} iconClassName="text-success" label={t("gainLabel")}>
              <Badge variant={assessment.gain ? "success" : "neutral"} className="gap-1">
                <TrendingUp className="h-3 w-3" />{assessment.gain ? t("gainLabel") : t("noGainLabel")}
              </Badge>
            </DetailRow>
          ) : null}

          <DetailRow icon={Target} iconClassName="text-violet-600" label={t("outcomeLabel")}>
            {!assessment.outcome ? "—" : assessment.outcomeEditable ? (
              <OutcomeCell assessment={assessment} t={t} onSetOutcome={onSetOutcome} />
            ) : (
              <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" />{t("outcomeCompleted")}</Badge>
            )}
          </DetailRow>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/25 bg-card px-3.5 py-3 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <p className="m-0">
            {hintPrefix}
            {hintLink ? <span className="font-semibold text-primary"> {hintLink}</span> : null}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Link to="/students" state={{ presetSearch: name }}>
            <Button variant="secondary" onClick={onClose} className="gap-2"><Pencil className="h-4 w-4" />{t("editStudentTitle")}</Button>
          </Link>
          <Button onClick={onClose}>{t("closeLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

export default function Assessments() {
  const { data, showToast } = useApp();
  const t = useT();
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

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("assessmentsTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("assessmentsDesc")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="gap-2" onClick={() => exportCsv(sorted)}><Download className="h-4 w-4" />{t("exportLabel")}</Button>
          <Link to="/students"><Button size="lg" className="gap-2"><Pencil className="h-4 w-4" />{t("addAssessmentLabel")}</Button></Link>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStat icon={Users} tint="bg-primary-tint text-primary" label={t("assessStatTotalLabel")} value={total} sublabel={t("assessStatEnrolledSublabel")} index={0} />
        <KpiStat icon={CheckCircle2} tint="bg-tint-success text-success" label={t("assessStatCompletedLabel")} value={completedCount} sublabel={total ? Math.round((completedCount / total) * 100) + "%" : "0%"} index={1} />
        <KpiStat icon={Clock} tint="bg-tint-warn text-warn" label={t("assessStatInProgressLabel")} value={inProgressCount} sublabel={total ? Math.round((inProgressCount / total) * 100) + "%" : "0%"} index={2} />
        <KpiStat icon={Circle} tint="bg-tint-neutral text-muted" label={t("assessStatNotStartedLabel")} value={notStartedCount} sublabel={total ? Math.round((notStartedCount / total) * 100) + "%" : "0%"} index={3} />
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-card-foreground">{t("assessProgressTitle")}</span>
            <span className="text-sm font-bold text-primary">{completionRate}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-tint-neutral">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: completionRate + "%" }} />
          </div>
          <p className="mt-2 text-xs text-muted">{t("assessProgressSublabel").replace("{n}", String(completedCount)).replace("{total}", String(total))}</p>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("studentSearchPlaceholder")}
                aria-label={t("studentSearchPlaceholder")}
                className="h-11 min-h-0 w-full rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              />
              {search ? (
                <button type="button" aria-label={t("clearLabel") || "Clear"} onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent text-muted hover:bg-tint-neutral">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <select
              value={classroomFilter}
              onChange={(e) => { setClassroomFilter(e.target.value); setPage(1); }}
              aria-label={t("classroomLabel")}
              className="h-11 min-h-0 w-full shrink-0 rounded-lg border border-border bg-background px-3 text-sm font-medium text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 lg:w-48"
            >
              <option value="all">{t("allClassroomsLabel")}</option>
              <option value="waiting">{t("waitingList")}</option>
              {activeClasses.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
            <select
              value={filterMode}
              onChange={(e) => updateFilterMode(e.target.value)}
              aria-label={t("statusLabel")}
              className="h-11 min-h-0 w-full shrink-0 rounded-lg border border-border bg-background px-3 text-sm font-medium text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 lg:w-48"
            >
              {QUICK_FILTERS.map((mode) => <option key={mode} value={mode}>{mode === "all" ? t("allStatusesLabel") : quickFilterLabel[mode]}</option>)}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_FILTERS.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => updateFilterMode(mode)}
                className={cn(
                  "flex h-9 min-h-0 items-center justify-center whitespace-nowrap rounded-full border px-4 text-sm font-semibold leading-none transition-colors",
                  filterMode === mode ? "border-primary bg-primary-tint text-primary" : "border-border bg-background text-muted hover:border-[#b7c0d1]"
                )}
              >
                {quickFilterLabel[mode]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <BulkActionsBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={exportSelected}><Download className="h-3.5 w-3.5" />{t("exportSelectedLabel")}</Button>
      </BulkActionsBar>

      <Card>
        <CardContent className="p-0">
          {paged.items.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="w-10"><input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} aria-label={t("selectAllLabel")} /></th>
                    <th>{t("nameLabel")}</th>
                    <th>{t("nbIdLabel")}</th>
                    <th>{t("classroomLabel")}</th>
                    <th>{t("pretestLabel")}</th>
                    <th>{t("posttestLabel")}</th>
                    <th>{t("statusLabel")}</th>
                    <th>{t("outcomeLabel")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map(({ student, assessment }) => {
                    const name = student.firstName + " " + student.lastName;
                    const cls = classByKey(data.classes, student.classKey);
                    const dotColor = student.classKey ? columnAccentColor(student.classKey, activeClasses.findIndex((c) => c.key === student.classKey)) : columnAccentColor("waiting", 0);
                    return (
                      <tr key={student.id} className="cursor-pointer hover:bg-background" onClick={() => setDetailId(student.id)}>
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(student.id)} onChange={() => toggleSelect(student.id)} aria-label={name} />
                        </td>
                        <td>
                          <span className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold text-card-foreground">{name}</span>
                              <span className="block text-xs text-muted">{formatPhone(student.phone) || "—"}</span>
                            </span>
                          </span>
                        </td>
                        <td><Badge>{student.studentId || "—"}</Badge></td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-card-foreground">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
                            {cls ? cls.name : t("waitingList")}
                          </span>
                        </td>
                        <td className="text-sm">{assessment.pretestLevel ? student.pretestReading : "—"}</td>
                        <td className="text-sm">{assessment.posttestLevel ? student.posttestReading : "—"}</td>
                        <td><StatusPill assessment={assessment} t={t} /></td>
                        <td onClick={(e) => e.stopPropagation()}><OutcomeCell assessment={assessment} t={t} onSetOutcome={(v) => setOutcome(student.id, v)} /></td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title={t("viewLabel")} aria-label={t("viewLabel")} onClick={() => setDetailId(student.id)} className="h-8 w-8 text-muted hover:bg-tint-neutral hover:text-card-foreground">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link to="/students" state={{ presetSearch: name }}>
                              <Button variant="ghost" size="icon" title={t("editStudentTitle")} aria-label={t("editStudentTitle")} className="h-8 w-8 text-muted hover:bg-tint-neutral hover:text-card-foreground">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-5"><EmptyState icon="students" message={t("noAssessmentDataYet")} /></div>
          )}
          <div className="px-5 pb-5">
            <Pagination
              page={paged.page} totalPages={paged.totalPages} total={paged.total} pageSize={paged.pageSize}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} itemLabel={t("itemLabelStudents")}
              onChange={(delta) => setPage(paged.page + delta)}
            />
          </div>
        </CardContent>
      </Card>

      <AssessmentDetailModal
        row={detailRow}
        onClose={() => setDetailId(null)}
        onSetOutcome={(v) => setOutcome(detailId, v)}
      />
    </>
  );
}
