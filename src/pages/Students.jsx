// Students.jsx -- the Administrator/Case Manager/Job Developer Students
// page: search + drag-and-drop Kanban roster board (waiting list + each
// active classroom), student enrollment, CSV/Excel roster upload, and
// session history (including past-session roster import). Every data
// computation still comes from lib/students.js / lib/assessments.js and
// AppContext's setData; only the presentation layer changes.
//
// Design-system pass (plans/ui-design-system.md §2), following Search.jsx:
// PageHeader, KpiCard row, FilterBar + FilterField + Select, a Drawer for a
// student's details, SectionCards for enrollment/upload/history, DataTable
// (with renderCard) for past rosters, StatusBadge for enrollment and
// assessment states. The board stays a board: sunken column wells holding
// Card items, with a tone dot for each column's capacity state instead of the
// old per-column accent colours. Drag-and-drop handlers, data attributes and
// event wiring are unchanged.
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarPlus, CalendarRange, Check, CheckCircle2, ChevronDown, ChevronUp, Clock3, Download, FileUp, GraduationCap,
  LogOut, Pencil, Phone, Trash2, TrendingUp, UserRound, Users, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { CLASS_CAPACITY } from "../lib/constants.js";
import { studentAssessmentStatus } from "../lib/assessments.js";
import { cn } from "../lib/cn.js";
import { findPossibleDuplicates } from "../lib/masterClients.js";
import { statusTone } from "../lib/statusTone.js";
import { addMonths, fmtDateLong, formatAddress, formatPhone, initialsOf, todayStr } from "../lib/utils.js";
import { createStudentWithClient, deleteStudent, updateStudent } from "../lib/checkinData.js";
import {
  createPastSession, createPastSessionStudents, deleteSession as deleteSessionRow, startNewSession as startNewSessionRpc
} from "../lib/sessionsData.js";
import {
  buildImportedPastRoster, buildImportedStudents, buildUpdatedStudent,
  downloadPastSessionTemplate, downloadStudentTemplate, enrollStudent, readRowsFromFile,
  sortStudentsList, studentMatchesSearch, studentMissingContact, studentsForClass, totalEnrolledCount,
  waitingListStudents, waitlistForClass
} from "../lib/students.js";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import StudentCard, { avatarColorFor } from "../components/StudentCard.jsx";
import { Alert } from "../components/ui/alert.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { BUTTON_RESET, Button } from "../components/ui/button.jsx";
import { Card } from "../components/ui/card.jsx";
import { DataTable } from "../components/ui/data-table.jsx";
import { DetailRow, Drawer } from "../components/ui/drawer.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";
import { EmptyState } from "../components/ui/empty-state.jsx";
import { CONTROL, Field, Input, Select } from "../components/ui/field.jsx";
import { FilterBar, FilterField } from "../components/ui/filter-bar.jsx";
import { IconButton } from "../components/ui/icon-button.jsx";
import { KpiCard } from "../components/ui/kpi-card.jsx";
import { PageHeader } from "../components/ui/page-header.jsx";
import { SearchInput } from "../components/ui/search-input.jsx";
import { SectionCard } from "../components/ui/section-card.jsx";
import { StatusBadge } from "../components/ui/status-badge.jsx";

const WAITING_LIST_PREVIEW = 5; // rows shown before the "Show all" toggle

// Solid dot per tone, for a column's capacity state. Static class names so
// Tailwind can see them; the tone itself comes from statusTone().
const TONE_DOT = {
  info: "bg-tone-info-solid",
  success: "bg-tone-success-solid",
  warning: "bg-tone-warning-solid",
  danger: "bg-tone-danger-solid",
  neutral: "bg-tone-neutral-solid",
  violet: "bg-tone-violet-solid"
};
function ToneDot({ domain, status }) {
  return <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-chip", TONE_DOT[statusTone(domain, status)] || TONE_DOT.neutral)} />;
}

// Shared by the Kanban board (StudentsBoard) and the Waiting List panel,
// which now live as two separate sections instead of one board with a
// "waiting" column -- both still mutate the same data.students array via
// AppContext's setData, so the move/remove/dropout/outcome/edit logic stays
// in one place rather than forking into two copies.
function useStudentRosterActions() {
  const { data, requestConfirm, showToast, refetchStudents } = useApp();
  const t = useT();

  // Waiting List (the backlog) has no cap -- only real classrooms do. Moving
  // a student who's already in the target class is always a no-op allowed
  // (e.g. re-dropping on the same column), so it doesn't get blocked by its
  // own presence in the count. Placing a student into any real class also
  // clears a prior dropout flag -- coming back into a class is how staff
  // "un-drops" someone, no separate control needed for that.
  async function moveStudent(studentId, classKeyOrNull) {
    const student = (data.students || []).find((s) => s.id === studentId);
    if (classKeyOrNull && student && student.classKey !== classKeyOrNull) {
      const currentCount = studentsForClass(data.students, classKeyOrNull).length;
      if (currentCount >= CLASS_CAPACITY) {
        // Waitlisting only makes sense coming from the Waiting List itself
        // (no current class) -- a student already placed in another class
        // who tries to switch into a full one isn't a "waiting list" case,
        // just a blocked move.
        if (!student.classKey) {
          const className = (data.classes || []).find((c) => c.key === classKeyOrNull);
          const ok = await requestConfirm(
            t("classFullJoinWaitlistConfirm").replace("{class}", className ? className.name : classKeyOrNull)
          );
          if (ok) await joinClassWaitlist(studentId, classKeyOrNull);
        } else {
          showToast(t("classFullMessage"));
        }
        return;
      }
    }
    await updateStudent(studentId, {
      classKey: classKeyOrNull,
      waitlistedForClassKey: null, waitlistedAt: null,
      droppedOut: classKeyOrNull ? false : (student && student.droppedOut),
      dropoutDate: classKeyOrNull ? null : (student && student.dropoutDate)
    });
    refetchStudents();
  }

  // Records that a Waiting List student specifically wants a seat in
  // `classKey`, without moving them out of the generic backlog (class_key
  // stays null) -- so the column header can surface "N waiting" and the
  // waiting-list row can offer a one-click Promote once a seat opens up.
  async function joinClassWaitlist(studentId, classKey) {
    await updateStudent(studentId, { waitlistedForClassKey: classKey, waitlistedAt: new Date().toISOString() });
    refetchStudents();
    showToast(t("addedToClassWaitlist"));
  }
  async function leaveClassWaitlist(studentId) {
    await updateStudent(studentId, { waitlistedForClassKey: null, waitlistedAt: null });
    refetchStudents();
  }
  async function promoteFromWaitlist(studentId, classKey) {
    const currentCount = studentsForClass(data.students, classKey).length;
    if (currentCount >= CLASS_CAPACITY) {
      showToast(t("classFullMessage"));
      return;
    }
    await updateStudent(studentId, { classKey, waitlistedForClassKey: null, waitlistedAt: null, droppedOut: false, dropoutDate: null });
    refetchStudents();
    showToast(t("promotedFromWaitlist"));
  }

  async function removeStudent(id) {
    const ok = await requestConfirm(t("removeStudentConfirm"), { danger: true });
    if (!ok) return;
    await deleteStudent(id);
    refetchStudents();
  }

  async function removeSelected(ids) {
    const ok = await requestConfirm(t("bulkDeleteConfirm").replace("{n}", String(ids.size)), { danger: true });
    if (!ok) return false;
    await Promise.all(Array.from(ids).map((id) => deleteStudent(id)));
    refetchStudents();
    return true;
  }

  // "Dropped out" is a soft status, not a delete -- the record (and any
  // assessment scores already entered) stays intact, they're just moved
  // back to the waiting list/backlog and tagged so staff can tell them apart
  // from students who were never placed yet.
  async function markDropout(id) {
    const ok = await requestConfirm(t("dropoutConfirm"));
    if (!ok) return;
    await updateStudent(id, { classKey: null, droppedOut: true, dropoutDate: todayStr() });
    refetchStudents();
    showToast(t("studentDroppedOut"));
  }

  // Manual half of the Outcome field (the "completed" half is computed
  // automatically from a gain -- see assessments.js -- and isn't settable
  // here since a real gain always wins over whatever was picked before).
  async function setOutcome(id, outcome) {
    await updateStudent(id, { outcome });
    refetchStudents();
  }

  // Returns true on success so callers can close their own local editingId
  // state -- that's per-section UI state, not something this shared hook owns.
  async function saveEdit(student, fields) {
    const updated = buildUpdatedStudent(student, fields);
    if (!updated) { showToast(t("fixErrors")); return false; }
    await updateStudent(student.id, updated);
    refetchStudents();
    showToast(t("studentUpdated"));
    return true;
  }

  return { moveStudent, removeStudent, removeSelected, markDropout, setOutcome, saveEdit, joinClassWaitlist, leaveClassWaitlist, promoteFromWaitlist };
}

// A section heading that also collapses its section: chevron, h2 and a count.
function CollapsibleHeading({ collapsed, onToggle, title, count, dot }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className={cn(BUTTON_RESET, "-ml-1 flex min-w-0 items-center gap-2 rounded-control px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2")}
    >
      {collapsed
        ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        : <ChevronUp className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
      {dot}
      <h2 className="m-0 truncate text-section font-semibold text-card-foreground">{title}</h2>
      <Badge variant="neutral" className="tabular-nums">{count}</Badge>
    </button>
  );
}

function AssessmentBadges({ student, assessment, t }) {
  if (assessment.status === "noPretest") return null;
  return (
    <>
      <Badge variant="neutral" className="tabular-nums">{t("pretestLabel")}: {student.pretestReading}</Badge>
      {assessment.status === "posttestMissing" ? (
        <StatusBadge domain="assessment" status="posttestMissing">{t("posttestNotCompletedFlag")}</StatusBadge>
      ) : (
        <>
          <Badge variant="neutral" className="tabular-nums">{t("posttestLabel")}: {student.posttestReading}</Badge>
          <StatusBadge domain="assessment" status={assessment.gain ? "gain" : "noGain"}>{assessment.gain ? t("gainLabel") : t("noGainLabel")}</StatusBadge>
        </>
      )}
    </>
  );
}

// Classroom "move to" picker -- a DropdownMenu standing in for the plain
// <select> everywhere else, so it can show each destination's icon and a
// check on the current one. Same move semantics as StudentCard/
// WaitingListRow's native <select> (onMove with null = waiting list).
function ClassroomPicker({ classKey, classes, onMove, labelId }) {
  const t = useT();
  const options = [{ key: null, name: t("waitingList"), disc: "bg-tone-warning-chip text-tone-warning-ink", icon: Clock3 }].concat(
    classes.map((c) => ({ key: c.key, name: c.name, disc: "bg-tone-info-chip text-tone-info-ink", icon: GraduationCap }))
  );
  const current = options.find((o) => o.key === classKey) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-labelledby={labelId}
          aria-describedby={labelId + "-value"}
          className={cn(BUTTON_RESET, CONTROL, "flex h-11 items-center justify-between gap-2 text-left data-[state=open]:border-primary")}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-chip", current.disc)}>
              <current.icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span id={labelId + "-value"} className="truncate text-ui font-semibold text-card-foreground">{current.name}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
        {options.map((o) => (
          <DropdownMenuItem key={o.key || "waiting"} onClick={() => onMove(o.key)} className="justify-between">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-chip", o.disc)}>
                <o.icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="truncate">{o.name}</span>
            </span>
            {o.key === current.key ? <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Full student detail (ID, contact info, assessment, outcome). Viewing a
// record, so it's a Drawer that keeps the board in view. The edit/dropout/
// remove/move/outcome handlers are the same ones the old modal called.
function StudentDetailDrawer({ student, classes, onClose, onEditStart, onDropout, onRemove, onMove, onSetOutcome }) {
  const t = useT();
  const uid = useId();
  const assessment = student ? studentAssessmentStatus(student) : null;
  const name = student ? student.firstName + " " + student.lastName : "";
  const currentClass = student ? classes.find((c) => c.key === student.classKey) : null;

  return (
    <Drawer
      open={!!student}
      onClose={onClose}
      title={t("studentDetailsTitle")}
      icon={<UserRound />}
      closeLabel={t("closeLabel")}
      footer={student ? (
        <>
          <Button variant="ghost" className="mr-auto text-tone-danger-ink hover:bg-tone-danger-bg" onClick={onRemove}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteLabel")}
          </Button>
          {student.classKey ? (
            <Button variant="secondary" onClick={onDropout}><LogOut className="h-4 w-4" aria-hidden="true" />{t("dropoutBtn")}</Button>
          ) : null}
          <Button onClick={onEditStart}><Pencil className="h-4 w-4" aria-hidden="true" />{t("editStudentTitle")}</Button>
        </>
      ) : null}
    >
      {student ? (
        <>
          <div className="mb-5 flex items-start gap-3">
            <Avatar className="h-12 w-12"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-section font-semibold text-card-foreground">{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
                {student.studentId ? <Badge>{student.studentId}</Badge> : null}
                <span className="inline-flex items-center gap-1 tabular-nums"><Phone className="h-3.5 w-3.5" aria-hidden="true" />{formatPhone(student.phone) || "—"}</span>
                <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />{currentClass ? currentClass.name : t("waitingList")}</span>
              </div>
            </div>
            <StatusBadge domain="enrollment" status={student.droppedOut ? "droppedOut" : "active"} className="shrink-0">
              {student.droppedOut ? t("droppedOutBadge") : t("activeLabel")}
            </StatusBadge>
          </div>

          <div className="mb-5 flex flex-col gap-1.5">
            <span id={uid} className="text-meta font-semibold text-card-foreground">{t("classroomColumn")}</span>
            <ClassroomPicker classKey={student.classKey} classes={classes} onMove={onMove} labelId={uid} />
          </div>

          <dl className="m-0">
            <DetailRow label={t("emailLabel")}>{student.email || "—"}</DetailRow>
            <DetailRow label={t("address")}>{formatAddress(student) || "—"}</DetailRow>
          </dl>

          {assessment.status !== "noPretest" ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <AssessmentBadges student={student} assessment={assessment} t={t} />
            </div>
          ) : null}

          {assessment.outcome ? (
            <div className="mt-4">
              {assessment.outcomeEditable ? (
                <Field label={t("outcomeLabel")} htmlFor={uid + "-outcome"}>
                  <Select id={uid + "-outcome"} value={assessment.outcome} onChange={(e) => onSetOutcome(e.target.value)}>
                    <option value="working">{t("outcomeWorking")}</option>
                    <option value="scheduleRetest">{t("outcomeScheduleRetest")}</option>
                  </Select>
                </Field>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-meta font-semibold text-muted">{t("outcomeLabel")}</span>
                  <StatusBadge domain="outcome" status="completed">{t("outcomeCompleted")}</StatusBadge>
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </Drawer>
  );
}

function StudentsBoard({ term, sortMode, filterMode, onAddStudentClick }) {
  const { data } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState(null);
  const [dropHover, setDropHover] = useState(null);
  // Stores the id, not the student object -- so the detail drawer stays live
  // (e.g. the Outcome select inside it) as data.students changes underneath it.
  const [detailStudentId, setDetailStudentId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const { moveStudent, removeStudent, markDropout, setOutcome, saveEdit } = useStudentRosterActions();

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const columns = activeClasses.map((c) => {
    const students = studentsForClass(data.students, c.key);
    const searched = students.filter((s) => studentMatchesSearch(s, term));
    const withFilter = filterMode === "missingContact" ? searched.filter(studentMissingContact) : searched;
    const filtered = sortStudentsList(withFilter, sortMode);
    const waiting = waitlistForClass(data.students, c.key);
    return { key: c.key, name: c.name, students, filtered, waiting };
  });
  const totalStudents = columns.reduce((sum, c) => sum + c.students.length, 0);
  const totalFiltered = columns.reduce((sum, c) => sum + c.filtered.length, 0);
  const detailStudent = detailStudentId ? (data.students || []).find((s) => s.id === detailStudentId) || null : null;
  const narrowed = !!term || filterMode === "missingContact";

  function handleDrop(e, colKey) {
    e.preventDefault();
    setDropHover(null);
    const studentId = e.dataTransfer.getData("text/plain");
    if (studentId) moveStudent(studentId, colKey);
  }

  return (
    <section className="mb-6" aria-label={t("classroomsHeading")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <CollapsibleHeading
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          title={t("classroomsHeading")}
          count={totalFiltered + (narrowed ? "/" + totalStudents : "")}
        />
        <Button asChild variant="ghost" size="sm" className="text-primary no-underline">
          <Link to="/manage">{t("addClassroomShortcutBtn")}</Link>
        </Button>
      </div>
      {collapsed ? null : (
        <>
          <p className="no-print m-0 mb-3 text-meta text-muted">{t("dragHint")}</p>
          {!columns.length ? (
            <Card>
              <EmptyState
                icon={GraduationCap}
                title={t("noClassroomsTitle")}
                description={t("noClassroomsHint")}
                action={<Button asChild variant="secondary" className="no-underline"><Link to="/manage">{t("addClassroomShortcutBtn")}</Link></Button>}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {columns.map((col) => {
                const filtered = col.filtered;
                const capacityStatus = col.students.length >= CLASS_CAPACITY ? "full" : "open";
                return (
                  <div
                    key={col.key}
                    className={cn(
                      "flex min-w-0 flex-col rounded-surface border bg-surface-sunken transition-[border-color,box-shadow] duration-fast",
                      dropHover === col.key ? "border-primary ring-2 ring-primary/30" : "border-border"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setDropHover(col.key); }}
                    onDragLeave={() => setDropHover((cur) => (cur === col.key ? null : cur))}
                    onDrop={(e) => handleDrop(e, col.key)}
                  >
                    <div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <ToneDot domain="classroom" status={capacityStatus} />
                        <h3 className="m-0 truncate text-ui font-semibold text-card-foreground">{col.name}</h3>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {col.waiting.length ? (
                          <StatusBadge domain="enrollment" status="waitlisted" className="tabular-nums">
                            {t("waitingCountBadge").replace("{n}", String(col.waiting.length))}
                          </StatusBadge>
                        ) : null}
                        <Badge variant="neutral" className="tabular-nums">
                          {filtered.length}
                          {narrowed ? "/" + col.students.length : "/" + CLASS_CAPACITY}
                        </Badge>
                      </div>
                    </div>
                    <div className="max-h-[35rem] flex-1 space-y-2.5 overflow-y-auto px-3 pb-3 pt-1">
                      {filtered.length ? (
                        filtered.map((s) => (
                          <StudentCard
                            key={s.id}
                            student={s}
                            classes={activeClasses}
                            editing={editingId === s.id}
                            onMove={(classKey) => moveStudent(s.id, classKey)}
                            onEditStart={() => setEditingId(s.id)}
                            onEditCancel={() => setEditingId(null)}
                            onSave={async (fields) => { if (await saveEdit(s, fields)) setEditingId(null); }}
                            onRemove={() => removeStudent(s.id)}
                            onDropout={() => markDropout(s.id)}
                            onViewDetails={() => setDetailStudentId(s.id)}
                          />
                        ))
                      ) : (
                        <EmptyState
                          compact
                          variant={narrowed ? "no-results" : "none"}
                          title={narrowed ? t("noSearchResults") : t("noStudentsEnrolled")}
                          description={narrowed ? null : t("classroomEmptyHint")}
                          className="px-2"
                        />
                      )}
                    </div>
                    <div className="border-t border-border p-1.5">
                      <Button type="button" variant="ghost" onClick={onAddStudentClick} className="w-full text-primary hover:bg-card">
                        {t("addStudentColumnBtn")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <StudentDetailDrawer
        student={detailStudent}
        classes={activeClasses}
        onClose={() => setDetailStudentId(null)}
        onEditStart={() => { setEditingId(detailStudentId); setDetailStudentId(null); }}
        onDropout={() => { markDropout(detailStudentId); setDetailStudentId(null); }}
        onRemove={() => { removeStudent(detailStudentId); setDetailStudentId(null); }}
        onMove={(classKey) => moveStudent(detailStudentId, classKey)}
        onSetOutcome={(outcome) => setOutcome(detailStudentId, outcome)}
      />
    </section>
  );
}

// One row of the Waiting List panel -- same student fields/edit form as a
// Kanban StudentCard, laid out horizontally (from xl; stacked below) instead
// of stacked in a card. No dropout control here: a waiting-list student has
// no classKey to drop out of by definition (waitingListStudents() below only
// returns students with none), so that action is never applicable here.
function WaitingListRow({ student, classes, editing, onMove, onEditStart, onEditCancel, onSave, onRemove, onViewDetails, selected, onToggleSelect, onLeaveWaitlist, onPromote, seatAvailable }) {
  const t = useT();
  const uid = useId();
  const [fields, setFields] = useState(() => ({
    firstName: student.firstName || "", lastName: student.lastName || "", phone: student.phone || "",
    email: student.email || "", street: student.street || "", city: student.city || "", zip: student.zip || "",
    pretestReading: student.pretestReading || "", posttestReading: student.posttestReading || ""
  }));
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  if (editing) {
    const fid = (k) => uid + "-" + k;
    return (
      <div className="py-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label={t("firstName")} htmlFor={fid("firstName")}><Input id={fid("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} /></Field>
          <Field label={t("lastName")} htmlFor={fid("lastName")}><Input id={fid("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} /></Field>
          <Field label={t("phone")} htmlFor={fid("phone")}><Input id={fid("phone")} type="tel" value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} /></Field>
          <Field label={t("email")} htmlFor={fid("email")}><Input id={fid("email")} type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} /></Field>
          <Field label={t("address")} htmlFor={fid("street")}><Input id={fid("street")} value={fields.street} onChange={(e) => setField("street", e.target.value)} /></Field>
          <Field label={t("city")} htmlFor={fid("city")}><Input id={fid("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} /></Field>
          <Field label={t("zip")} htmlFor={fid("zip")}><Input id={fid("zip")} inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("pretestReadingLabel")} htmlFor={fid("pre")}><Input id={fid("pre")} type="number" className="tabular-nums" value={fields.pretestReading} onChange={(e) => setField("pretestReading", e.target.value)} /></Field>
            <Field label={t("posttestReadingLabel")} htmlFor={fid("post")}><Input id={fid("post")} type="number" className="tabular-nums" value={fields.posttestReading} onChange={(e) => setField("posttestReading", e.target.value)} /></Field>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
          <Button size="sm" variant="secondary" onClick={onEditCancel}>{t("cancelLabel")}</Button>
        </div>
      </div>
    );
  }

  const assessment = studentAssessmentStatus(student);
  const name = student.firstName + " " + student.lastName;
  const waitlistedClass = student.waitlistedForClassKey ? classes.find((c) => c.key === student.waitlistedForClassKey) : null;
  const moveId = uid + "-move";
  const address = formatAddress(student);

  return (
    <div
      className="grid cursor-grab grid-cols-1 items-start gap-3 py-4 active:cursor-grabbing xl:grid-cols-[minmax(200px,1.6fr)_minmax(140px,1fr)_minmax(150px,1.3fr)_200px_auto] xl:items-center xl:gap-x-4"
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", student.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <input
          type="checkbox"
          checked={!!selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          aria-label={name}
          className="mt-2.5 h-4 min-h-0 w-4 shrink-0 cursor-pointer accent-primary"
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onViewDetails}
            className={cn(BUTTON_RESET, "group flex max-w-full items-center gap-3 rounded-control text-left focus-visible:outline-none focus-visible:ring-2")}
          >
            <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
            <span className="min-w-0 truncate text-ui font-semibold text-card-foreground group-hover:text-primary group-hover:underline">{name}</span>
          </button>
          {student.studentId || student.droppedOut || waitlistedClass ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-12">
              {student.studentId ? <Badge>{student.studentId}</Badge> : null}
              {student.droppedOut ? <StatusBadge domain="enrollment" status="droppedOut">{t("droppedOutBadge")}</StatusBadge> : null}
              {waitlistedClass ? (
                <span className="inline-flex items-center gap-0.5">
                  <StatusBadge domain="enrollment" status="waitlisted">{t("waitingForClassBadge").replace("{class}", waitlistedClass.name)}</StatusBadge>
                  <IconButton size="sm" label={t("leaveWaitlistBtn")} onClick={(e) => { e.stopPropagation(); onLeaveWaitlist(); }}>
                    <X aria-hidden="true" />
                  </IconButton>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="pl-[4.75rem] text-meta tabular-nums text-muted xl:pl-0">
        {student.phone ? <div>{formatPhone(student.phone)}</div> : null}
        {address ? <div>{address}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-[4.75rem] xl:pl-0">
        <AssessmentBadges student={student} assessment={assessment} t={t} />
      </div>
      <div className="flex items-end gap-2 xl:contents">
        <Field label={t("classroomColumn")} htmlFor={moveId} className="min-w-0 flex-1">
          <Select
            id={moveId}
            value="waiting"
            onChange={(e) => onMove(e.target.value === "waiting" ? null : e.target.value)}
          >
            <option value="waiting">{t("waitingList")}</option>
            {classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
          </Select>
        </Field>
        <div className="flex shrink-0 items-center justify-end gap-0.5">
          {waitlistedClass && seatAvailable ? (
            <Button size="sm" onClick={onPromote} className="mr-1">{t("promoteFromWaitlistBtn")}</Button>
          ) : null}
          <IconButton label={t("editStudentTitle")} onClick={onEditStart}><Pencil aria-hidden="true" /></IconButton>
          <IconButton variant="danger" label={t("deleteLabel")} onClick={onRemove}><X aria-hidden="true" /></IconButton>
        </div>
      </div>
    </div>
  );
}

// Waiting List, pulled out of the Kanban grid into its own list section --
// it's the intake backlog (no capacity cap, often the longest roster), so a
// dense list reads better here than a column of tall cards. Still a drop
// target for drag-and-drop (dropping a card back here un-places a student),
// same as when it was a board column.
function WaitingListPanel({ term, sortMode, filterMode, onAddStudentClick, onClearFilters, selected, onToggleSelect, onClearSelected }) {
  const { data } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState(null);
  const [dropHover, setDropHover] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Whole-panel collapse (independent of the row-level "show all" toggle
  // below) -- lets staff shrink the backlog down to just its header when
  // they're focused on the classroom board instead.
  const [collapsed, setCollapsed] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState(null);
  const { moveStudent, removeStudent, removeSelected, markDropout, setOutcome, saveEdit, leaveClassWaitlist, promoteFromWaitlist } = useStudentRosterActions();

  async function handleRemoveSelected() {
    const ok = await removeSelected(selected);
    if (ok) onClearSelected();
  }

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const students = waitingListStudents(data.students);
  const searched = students.filter((s) => studentMatchesSearch(s, term));
  const withFilter = filterMode === "missingContact" ? searched.filter(studentMissingContact) : searched;
  const filtered = sortStudentsList(withFilter, sortMode);
  const narrowed = !!term || filterMode === "missingContact";
  const visible = showAll ? filtered : filtered.slice(0, WAITING_LIST_PREVIEW);
  const detailStudent = detailStudentId ? (data.students || []).find((s) => s.id === detailStudentId) || null : null;

  function handleDrop(e) {
    e.preventDefault();
    setDropHover(false);
    const studentId = e.dataTransfer.getData("text/plain");
    if (studentId) moveStudent(studentId, null);
  }

  return (
    <Card
      className={cn("mb-6 p-5 transition-[border-color,box-shadow] duration-fast sm:p-6", dropHover ? "border-primary ring-2 ring-primary/30" : "")}
      onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
      onDragLeave={() => setDropHover(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CollapsibleHeading
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          title={t("waitingList")}
          count={filtered.length + (narrowed ? "/" + students.length : "")}
          dot={<ToneDot domain="enrollment" status="waitlisted" />}
        />
        <Button type="button" variant="ghost" size="sm" onClick={onAddStudentClick} className="text-primary">
          {t("addStudentColumnBtn")}
        </Button>
      </div>
      {collapsed ? null : (
        <div className="mt-3">
          <BulkActionsBar count={selected.size} onClear={onClearSelected}>
            <Button variant="danger" size="sm" onClick={handleRemoveSelected}><Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteSelectedLabel")}</Button>
          </BulkActionsBar>
          {filtered.length ? (
            <>
              <div className="divide-y divide-line-subtle">
                {visible.map((s) => (
                  <WaitingListRow
                    key={s.id}
                    student={s}
                    classes={activeClasses}
                    editing={editingId === s.id}
                    onMove={(classKey) => moveStudent(s.id, classKey)}
                    onEditStart={() => setEditingId(s.id)}
                    onEditCancel={() => setEditingId(null)}
                    onSave={async (fields) => { if (await saveEdit(s, fields)) setEditingId(null); }}
                    onRemove={() => removeStudent(s.id)}
                    onViewDetails={() => setDetailStudentId(s.id)}
                    selected={selected.has(s.id)}
                    onToggleSelect={() => onToggleSelect(s.id)}
                    onLeaveWaitlist={() => leaveClassWaitlist(s.id)}
                    onPromote={() => promoteFromWaitlist(s.id, s.waitlistedForClassKey)}
                    seatAvailable={!s.waitlistedForClassKey || studentsForClass(data.students, s.waitlistedForClassKey).length < CLASS_CAPACITY}
                  />
                ))}
              </div>
              {filtered.length > WAITING_LIST_PREVIEW ? (
                <div className="mt-1 border-t border-line-subtle pt-3">
                  <Button variant="ghost" className="w-full text-primary" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                    {showAll ? (
                      <>{t("showLessLabel")} <ChevronUp className="h-4 w-4" aria-hidden="true" /></>
                    ) : (
                      <>{t("showAllLabel").replace("{n}", String(filtered.length))} <ChevronDown className="h-4 w-4" aria-hidden="true" /></>
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          ) : narrowed ? (
            <EmptyState
              compact
              variant="no-results"
              title={t("noSearchResults")}
              description={t("studentsNoResultsHint")}
              action={<Button variant="secondary" onClick={onClearFilters}>{t("clearFilters")}</Button>}
            />
          ) : (
            <EmptyState
              compact
              icon={Users}
              title={t("waitingListEmptyTitle")}
              description={t("waitingListEmptyHint")}
              action={<Button variant="secondary" onClick={onAddStudentClick}>{t("addStudentColumnBtn")}</Button>}
            />
          )}
        </div>
      )}

      <StudentDetailDrawer
        student={detailStudent}
        classes={activeClasses}
        onClose={() => setDetailStudentId(null)}
        onEditStart={() => { setEditingId(detailStudentId); setDetailStudentId(null); }}
        onDropout={() => { markDropout(detailStudentId); setDetailStudentId(null); }}
        onRemove={() => { removeStudent(detailStudentId); setDetailStudentId(null); }}
        onMove={(classKey) => moveStudent(detailStudentId, classKey)}
        onSetOutcome={(outcome) => setOutcome(detailStudentId, outcome)}
      />
    </Card>
  );
}

function EnrollStudentPanel() {
  const { data, showToast, refetchStudents } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ firstName: "", lastName: "", phone: "", email: "", street: "", city: "", zip: "" });
  const [errors, setErrors] = useState([]);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function finalizeCreate(result, matchedClient) {
    const { row: created } = await createStudentWithClient(result, result, matchedClient ? matchedClient.id : null);
    refetchStudents();
    setFields({ firstName: "", lastName: "", phone: "", email: "", street: "", city: "", zip: "" });
    setDupMatches(null);
    setPendingResult(null);
    showToast(t("studentEnrolled") + " " + created.studentId);
  }

  function submit() {
    if (!fields.firstName.trim() || !fields.lastName.trim()) {
      setErrors(["firstName", "lastName"].filter((f) => !fields[f].trim()));
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const result = enrollStudent(fields);
    if (!result) return;
    const matches = findPossibleDuplicates(fields, data.clients || []);
    if (matches.length) {
      setPendingResult(result);
      setDupMatches(matches);
      return;
    }
    finalizeCreate(result, null);
  }

  const firstInvalid = errors.indexOf("firstName") !== -1;
  const lastInvalid = errors.indexOf("lastName") !== -1;

  return (
    <SectionCard title={t("enrollStudentTitle")} description={t("enrollStudentDesc")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("firstName")} htmlFor="enroll-first-name" required error={firstInvalid ? t("fieldRequired") : null}>
          <Input id="enroll-first-name" value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} placeholder={t("enterFirstNamePlaceholder")} aria-invalid={firstInvalid || undefined} aria-describedby={firstInvalid ? "enroll-first-name-error" : undefined} />
        </Field>
        <Field label={t("lastName")} htmlFor="enroll-last-name" required error={lastInvalid ? t("fieldRequired") : null}>
          <Input id="enroll-last-name" value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} placeholder={t("enterLastNamePlaceholder")} aria-invalid={lastInvalid || undefined} aria-describedby={lastInvalid ? "enroll-last-name-error" : undefined} />
        </Field>
        <Field label={t("phone")} htmlFor="enroll-phone">
          <Input id="enroll-phone" type="tel" className="tabular-nums" value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder={t("phPhone")} />
        </Field>
        <Field label={t("email")} htmlFor="enroll-email">
          <Input id="enroll-email" type="email" value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder={t("phEmail")} />
        </Field>
        <Field label={t("address")} htmlFor="enroll-street" className="sm:col-span-2">
          <Input id="enroll-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} placeholder={t("streetAddressPlaceholder")} />
        </Field>
        <Field label={t("city")} htmlFor="enroll-city">
          <Input id="enroll-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} />
        </Field>
        <Field label={t("zip")} htmlFor="enroll-zip" hint={t("stateAlwaysRI")}>
          <Input id="enroll-zip" inputMode="numeric" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
        </Field>
      </div>
      <Button className="mt-5" onClick={submit}>{t("enrollBtn")}</Button>
      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingResult(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingResult, matchedClient)}
          onCreateAnyway={() => finalizeCreate(pendingResult, null)}
          onCancel={() => { setDupMatches(null); setPendingResult(null); }}
        />
      )}
    </SectionCard>
  );
}

function UploadStudentsPanel() {
  const { data, showToast, refetchStudents } = useApp();
  const t = useT();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");

  async function importRows(rows) {
    const result = buildImportedStudents(rows, data.students);
    if (!result) { showToast(t("importError")); return; }
    // Bulk import has no UI for a per-row duplicate review -- silently
    // attach each imported row to the best existing master-client match or
    // create a new one, same as Case Management's CSV import.
    for (const row of result.added) {
      const matches = findPossibleDuplicates(row, data.clients || []);
      await createStudentWithClient(row, row, matches.length ? matches[0].client.id : null);
    }
    refetchStudents();
    showToast(result.added.length + " " + t("studentsImported"));
  }

  function handleImportClick() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importRows, () => showToast(t("importError")));
  }

  return (
    <SectionCard
      title={t("uploadStudents")}
      description={t("uploadStudentsDesc")}
      action={
        <Button variant="secondary" size="sm" onClick={downloadStudentTemplate}>
          <Download className="h-4 w-4" aria-hidden="true" />{t("downloadTemplate")}
        </Button>
      }
    >
      {/* The visually-hidden file input stays focusable inside its label, so
          the drop zone works from the keyboard too. */}
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-surface border-2 border-dashed border-line-strong p-6 text-center transition-colors duration-fast focus-within:border-primary focus-within:ring-2 hover:border-primary hover:bg-surface-sunken">
        <FileUp className="h-6 w-6 text-muted" aria-hidden="true" />
        <span className="text-ui font-semibold text-card-foreground">{fileName || t("chooseFileDragDrop")}</span>
        <span className="text-meta text-muted">{t("fileTypesHint")}</span>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
        />
      </label>
      <Button className="mt-4 w-full" onClick={handleImportClick}>{t("importBtn")}</Button>
    </SectionCard>
  );
}

const FILE_INPUT = "block min-h-0 w-full border-0 bg-transparent p-0 text-ui text-card-foreground file:mr-3 file:h-10 file:min-h-0 file:cursor-pointer file:rounded-control file:border-0 file:bg-primary-tint file:px-3 file:text-ui file:font-semibold file:text-primary";

function PastSessionsPanel() {
  const { data, requestConfirm, showToast } = useApp();
  const t = useT();
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pastSessionId, setPastSessionId] = useState("");
  const pastFileRef = useRef(null);

  const history = (data.sessionHistory || []).slice().sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));

  function rosterCount(sessionId) {
    return (data.pastSessionStudents || []).filter((r) => r.sessionId === sessionId).length;
  }

  async function deleteSession(id) {
    const ok = await requestConfirm(t("deleteSessionConfirm"), { danger: true });
    if (!ok) return;
    await deleteSessionRow(id);
    setExpandedSessionId((cur) => (cur === id ? null : cur));
  }

  async function addPastSession() {
    if (!start || !end) { showToast(t("fixErrors")); return; }
    if (end <= start) { showToast(t("invalidDateRange")); return; }
    await createPastSession({ startDate: start, endDate: end });
    setStart(""); setEnd("");
    showToast(t("pastSessionAdded"));
  }

  async function importPastRoster(rows) {
    const result = buildImportedPastRoster(pastSessionId, rows, data.classes);
    if (!result) { showToast(t("importError")); return; }
    await createPastSessionStudents(result.added);
    showToast(result.added.length + " " + t("pastStudentsImported") + (result.unmatched ? " (" + result.unmatched + " " + t("unmatchedClassroom") + ")" : ""));
  }

  function handleImportPastClick() {
    if (!pastSessionId) { showToast(t("addPastSessionFirst")); return; }
    const file = pastFileRef.current && pastFileRef.current.files && pastFileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importPastRoster, () => showToast(t("importError")));
  }

  const rosterColumns = [
    { key: "name", header: t("nameLabel"), cell: (r) => <span className="font-semibold">{r.firstName} {r.lastName}</span> },
    { key: "phone", header: t("phoneLabel"), cell: (r) => <span className="whitespace-nowrap">{formatPhone(r.phone)}</span> },
    { key: "email", header: t("emailLabel"), cell: (r) => r.email || "" },
    { key: "address", header: t("address"), cell: (r) => formatAddress(r) },
    { key: "classroom", header: t("classroomColumn"), cell: (r) => r.className || "" }
  ];

  function renderRosterCard(r) {
    const contact = [formatPhone(r.phone), r.email].filter(Boolean).join(" · ");
    const address = formatAddress(r);
    return (
      <div className="min-w-0 text-ui">
        <div className="font-semibold text-card-foreground">{r.firstName} {r.lastName}</div>
        {r.className ? <div className="text-meta text-muted">{t("classroomColumn")}: {r.className}</div> : null}
        {contact ? <div className="break-words text-meta tabular-nums text-muted">{contact}</div> : null}
        {address ? <div className="text-meta text-muted">{address}</div> : null}
      </div>
    );
  }

  return (
    <SectionCard title={t("sessionHistoryTitle")} description={t("sessionHistoryDesc")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("pastSessionStart")} htmlFor="past-session-start">
          <div className="ds-control"><DatePicker id="past-session-start" value={start} onChange={setStart} /></div>
        </Field>
        <Field label={t("pastSessionEnd")} htmlFor="past-session-end">
          <div className="ds-control"><DatePicker id="past-session-end" value={end} onChange={setEnd} /></div>
        </Field>
      </div>
      <Button className="mt-4 w-full sm:w-auto" onClick={addPastSession}>{t("addSession")}</Button>

      {!history.length ? (
        <Alert tone="info" title={t("noPastSessions")} className="mt-5">{t("noPastSessionsHint")}</Alert>
      ) : (
        <ul className="m-0 mt-5 list-none divide-y divide-line-subtle border-t border-line-subtle p-0">
          {history.map((s) => {
            const count = rosterCount(s.id);
            const expanded = expandedSessionId === s.id;
            const rows = (data.pastSessionStudents || []).filter((r) => r.sessionId === s.id);
            return (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ui tabular-nums text-card-foreground">
                    {fmtDateLong(s.startDate)} – {fmtDateLong(s.endDate)} <span className="text-muted">({count})</span>
                  </span>
                  <span className="flex gap-1.5">
                    <Button size="sm" variant="secondary" aria-expanded={expanded} onClick={() => setExpandedSessionId(expanded ? null : s.id)}>
                      {expanded ? t("hideRoster") : t("viewRoster")}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-tone-danger-ink hover:bg-tone-danger-bg" onClick={() => deleteSession(s.id)}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />{t("deleteLabel")}
                    </Button>
                  </span>
                </div>
                {expanded ? (
                  <DataTable
                    stackBelow="xl"
                    className="mt-3"
                    caption={fmtDateLong(s.startDate) + " – " + fmtDateLong(s.endDate)}
                    columns={rosterColumns}
                    rows={rows}
                    getRowId={(r) => r.id}
                    renderCard={renderRosterCard}
                    maxHeight="24rem"
                    empty={
                      <EmptyState
                        compact
                        title={t("noPastRosterYet")}
                        description={t("noPastRosterHint")}
                      />
                    }
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {history.length ? (
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="m-0 text-section font-semibold text-card-foreground">{t("importPastRosterTitle")}</h3>
          <p className="m-0 mt-1 text-meta text-muted">{t("importPastRosterDesc")}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={downloadPastSessionTemplate}>
            <Download className="h-4 w-4" aria-hidden="true" />{t("downloadPastTemplate")}
          </Button>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("selectSession")} htmlFor="past-roster-session">
              <Select id="past-roster-session" value={pastSessionId} onChange={(e) => setPastSessionId(e.target.value)}>
                <option value="">{t("pleaseSelect")}</option>
                {history.map((s) => <option key={s.id} value={s.id}>{fmtDateLong(s.startDate)} – {fmtDateLong(s.endDate)}</option>)}
              </Select>
            </Field>
            <Field label={t("uploadStudents")} htmlFor="past-roster-upload-input">
              <input ref={pastFileRef} type="file" id="past-roster-upload-input" accept=".xlsx,.xls,.csv" className={FILE_INPUT} />
            </Field>
          </div>
          <Button className="mt-4 w-full sm:w-auto" onClick={handleImportPastClick}>{t("importBtn")}</Button>
        </div>
      ) : null}
    </SectionCard>
  );
}

export default function Students() {
  const { data, lang, requestConfirm, showToast } = useApp();
  const t = useT();
  const location = useLocation();
  // Sidebar's "search a student" shortcut (Shell.jsx) hands its query here
  // via router state instead of a second results view -- this board already
  // knows how to render a filtered roster.
  const [search, setSearch] = useState(() => (location.state && location.state.presetSearch) || "");
  const [sortMode, setSortMode] = useState("name");
  const [filterMode, setFilterMode] = useState("all");
  const [selected, setSelected] = useState(() => new Set());
  const enrollSectionRef = useRef(null);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (location.state && typeof location.state.presetSearch === "string") {
      setSearch(location.state.presetSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const session = data.currentSession || {};

  async function startNewSession() {
    const ok = await requestConfirm(t("startNewSessionConfirm"));
    if (!ok) return;
    const start = todayStr();
    // start_new_session() RPC does the archive-old/insert-new/clear-rosters
    // sequence atomically server-side now -- see sessionsData.js.
    await startNewSessionRpc(start, addMonths(start, 3));
    showToast(t("newSessionStarted"));
  }

  function scrollToEnroll() {
    enrollSectionRef.current && enrollSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setSearch("");
    setFilterMode("all");
  }

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const totalEnrolled = totalEnrolledCount(data.students);
  const seatsAvailable = Math.max(0, activeClasses.length * CLASS_CAPACITY - totalEnrolled);
  const waitingCount = waitingListStudents(data.students).length;
  const assessed = (data.students || []).filter((s) => s.active !== false).map(studentAssessmentStatus).filter((a) => a.status !== "noPretest");
  const completedCount = assessed.filter((a) => a.outcome === "completed").length;
  const completionRate = assessed.length ? Math.round((completedCount / assessed.length) * 100) : 0;
  const activeFilterCount = filterMode !== "all" ? 1 : 0;
  const term = search.trim().toLowerCase();

  return (
    <>
      <PageHeader
        title={t("studentsPageTitle")}
        description={t("studentsPageSubtitle")}
        meta={
          <span className="inline-flex items-center gap-1.5 text-meta text-muted">
            <CalendarRange className="h-4 w-4" aria-hidden="true" />
            {t("currentSession")}:
            <span className="font-semibold tabular-nums text-card-foreground">{fmtDateLong(session.startDate, lang)} – {fmtDateLong(session.endDate, lang)}</span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="secondary" className="no-underline"><Link to="/manage">{t("addClassroomShortcutBtn")}</Link></Button>
            <Button onClick={startNewSession}><CalendarPlus className="h-4 w-4" aria-hidden="true" />{t("startNewSession")}</Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("statTotalEnrolledLabel")} value={totalEnrolled} icon={Users} tone="info" hint={t("statAcrossClassroomsLabel")} />
        <KpiCard label={t("statSeatsAvailableLabel")} value={seatsAvailable} icon={CheckCircle2} tone="success" hint={t("statAcrossClassroomsLabel")} />
        <KpiCard label={t("waitingList")} value={waitingCount} icon={Clock3} tone="warning" />
        <KpiCard label={t("statCompletionRateLabel")} value={completionRate + "%"} icon={TrendingUp} tone="violet" hint={t("statThisSessionLabel")} />
      </div>

      <FilterBar
        className="no-print"
        search={
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch("")}
            clearLabel={t("clearAllLabel")}
            placeholder={t("studentSearchPlaceholder")}
            aria-label={t("studentSearchPlaceholder")}
          />
        }
        activeCount={activeFilterCount}
        canClear={activeFilterCount > 0 || !!search}
        onClear={clearFilters}
        clearLabel={t("clearFilters")}
        filtersLabel={t("filtersLabel")}
        gridClassName="sm:grid-cols-2 lg:grid-cols-3"
      >
        <FilterField label={t("filterLabel")} htmlFor="students-filter-mode">
          <Select id="students-filter-mode" value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
            <option value="all">{t("filterAllLabel")}</option>
            <option value="missingContact">{t("filterMissingContactLabel")}</option>
          </Select>
        </FilterField>
        <FilterField label={t("sortByLabel")} htmlFor="students-sort-mode">
          <Select id="students-sort-mode" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="name">{t("sortByNameLabel")}</option>
            <option value="id">{t("sortByIdLabel")}</option>
            <option value="recent">{t("sortByRecentLabel")}</option>
          </Select>
        </FilterField>
      </FilterBar>

      <WaitingListPanel
        term={term} sortMode={sortMode} filterMode={filterMode} onAddStudentClick={scrollToEnroll} onClearFilters={clearFilters}
        selected={selected} onToggleSelect={toggleSelect} onClearSelected={() => setSelected(new Set())}
      />

      <StudentsBoard term={term} sortMode={sortMode} filterMode={filterMode} onAddStudentClick={scrollToEnroll} />

      <div ref={enrollSectionRef} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EnrollStudentPanel />
        <div className="flex min-w-0 flex-col gap-6">
          <UploadStudentsPanel />
          <PastSessionsPanel />
        </div>
      </div>
    </>
  );
}
