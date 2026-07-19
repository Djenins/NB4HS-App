// Students.jsx -- the Administrator/Case Manager/Job Developer Students
// page: search + drag-and-drop Kanban roster board (waiting list + each
// active classroom), student enrollment, CSV/Excel roster upload, and
// session history (including past-session roster import). Tailwind/shadcn
// redesign pass (client-provided "Student Waiting List & Classrooms"
// mockup), same idiom as the Dashboard.jsx/Search.jsx redesign passes --
// every data computation below still comes from the existing lib/students.js
// /lib/assessments.js helpers and AppContext's setData; only the
// presentation layer changed. The three collapsible <details> panels
// (Enroll/Upload/Past Sessions) became always-visible Cards laid out exactly
// like the mockup's bottom two-column grid, since the reference design has
// no accordion affordance for them.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CalendarPlus, CalendarRange, Check, CheckCircle2, ChevronDown, ChevronUp, Clock3, Download, FileUp, GraduationCap, Info,
  LogOut, Mail, Pencil, Phone, Trash2, TrendingUp, UserPlus, Upload, Users, X
} from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { CLASS_CAPACITY } from "../lib/constants.js";
import { studentAssessmentStatus } from "../lib/assessments.js";
import { cn } from "../lib/cn.js";
import { attachClientToProgram, findPossibleDuplicates } from "../lib/masterClients.js";
import { addMonths, fmtDateLong, formatAddress, formatPhone, initialsOf, todayStr } from "../lib/utils.js";
import { createStudent, createStudents, deleteStudent, updateStudent } from "../lib/checkinData.js";
import {
  createPastSession, createPastSessionStudents, deleteSession as deleteSessionRow, startNewSession as startNewSessionRpc
} from "../lib/sessionsData.js";
import {
  buildImportedPastRoster, buildImportedStudents, buildUpdatedStudent, columnAccentColor,
  downloadPastSessionTemplate, downloadStudentTemplate, enrollStudent, readRowsFromFile,
  sortStudentsList, studentMatchesSearch, studentMissingContact, studentsForClass, totalEnrolledCount, waitingListStudents
} from "../lib/students.js";
import BulkActionsBar from "../components/BulkActionsBar.jsx";
import DatePicker from "../components/DatePicker.jsx";
import DuplicateClientWarning from "../components/DuplicateClientWarning.jsx";
import EmptyState from "../components/EmptyState.jsx";
import StudentCard, { avatarColorFor } from "../components/StudentCard.jsx";
import { Avatar, AvatarFallback } from "../components/ui/avatar.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../components/ui/dropdown-menu.jsx";

const WAITING_ACCENT = "#D99E32"; // gold -- matches columnAccentColor("waiting", ...)
const WAITING_LIST_PREVIEW = 5; // rows shown before the "Show all" toggle

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
        showToast(t("classFullMessage"));
        return;
      }
    }
    await updateStudent(studentId, {
      classKey: classKeyOrNull,
      droppedOut: classKeyOrNull ? false : (student && student.droppedOut),
      dropoutDate: classKeyOrNull ? null : (student && student.dropoutDate)
    });
    refetchStudents();
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

  return { moveStudent, removeStudent, removeSelected, markDropout, setOutcome, saveEdit };
}

function KpiStat({ icon: Icon, tint, label, value, sublabel, index, big }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: index * 0.05 }}>
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + tint}>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-muted">{label}</div>
            <div className={"mt-1 font-extrabold tracking-tight text-card-foreground " + (big ? "text-2xl" : "text-base leading-snug")}>{value}</div>
            {sublabel ? <div className="mt-0.5 truncate text-xs text-muted">{sublabel}</div> : null}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FilterFieldSelect({ label, value, onChange, children }) {
  return (
    <div className="relative min-w-[170px] flex-1 rounded-lg border border-border bg-background px-4 py-2 transition-colors hover:border-[#b7c0d1]">
      <div className="text-xs font-medium text-muted">{label}</div>
      <select
        value={value}
        onChange={onChange}
        aria-label={label}
        className="min-h-0 w-full appearance-none border-0 bg-transparent p-0 text-sm font-semibold text-card-foreground focus:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

function TextField({ id, label, required, invalid, icon: Icon, value, onChange, placeholder, type }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-card-foreground">
        {label}{required ? <span className="text-accent"> *</span> : null}
      </label>
      <div className="relative">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /> : null}
        <input
          id={id}
          type={type || "text"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "h-11 min-h-0 w-full rounded-lg border bg-background text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/15",
            Icon ? "pl-9 pr-3" : "px-3",
            invalid ? "border-accent bg-tint-danger" : "border-border focus:border-primary"
          )}
        />
      </div>
    </div>
  );
}

// Rounded "pill" action button used in the detail header (Drop Out/Edit/
// Remove) -- modeled on a reference "student profile" design the client
// shared. Icon-over-label, equal-width, neutral border by default; `tone`
// swaps in the danger tint for Drop Out/Remove.
function DetailActionButton({ icon: Icon, label, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 min-h-0 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors",
        tone === "danger"
          ? "border-accent/25 bg-tint-danger text-accent hover:bg-accent/10"
          : "border-border bg-card text-card-foreground hover:bg-background"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// Classroom "move to" picker -- a DropdownMenu standing in for the plain
// <select> everywhere else, so it can show each destination's accent color
// and a check on the current one, matching the reference design. Same
// move semantics as StudentCard/WaitingListRow's native <select> (onMove
// with null = waiting list).
function ClassroomPicker({ classKey, classes, onMove }) {
  const t = useT();
  const options = [{ key: null, name: t("waitingList"), accent: WAITING_ACCENT, icon: Clock3 }].concat(
    classes.map((c, i) => ({ key: c.key, name: c.name, accent: columnAccentColor(c.key, i), icon: GraduationCap }))
  );
  const current = options.find((o) => o.key === classKey) || options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-14 w-full items-center justify-between rounded-xl border border-border bg-card px-4 text-left transition-colors hover:border-primary/40 data-[state=open]:border-primary"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: current.accent + "22", color: current.accent }}>
              <current.icon className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-bold text-card-foreground">{current.name}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
        {options.map((o) => (
          <DropdownMenuItem key={o.key || "waiting"} onClick={() => onMove(o.key)} className="justify-between">
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: o.accent + "22", color: o.accent }}>
                <o.icon className="h-3.5 w-3.5" />
              </span>
              {o.name}
            </span>
            {o.key === current.key ? <Check className="h-4 w-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Full student detail (ID, contact info, assessment, outcome) now lives here
// instead of inline on every Kanban card -- StudentCard's view mode is just
// a clickable name + move select, and clicking the name opens this. Reuses
// the app's existing .modal-overlay/.modal-box CSS (same pattern as
// Search.jsx's visit-detail modal) rather than inventing a second modal look.
// Header/action-row/classroom-picker redesigned per a reference "student
// profile" mockup the client shared; the underlying edit/dropout/remove/move
// handlers are unchanged, just re-laid-out.
function StudentDetailModal({ student, classes, onClose, onEditStart, onDropout, onRemove, onMove, onSetOutcome }) {
  const t = useT();
  if (!student) return null;

  const assessment = studentAssessmentStatus(student);
  const name = student.firstName + " " + student.lastName;
  const currentClass = classes.find((c) => c.key === student.classKey);

  return (
    <div className="modal-overlay no-print" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0">{t("studentDetailsTitle")}</h3>
          <Button variant="ghost" size="icon" aria-label={t("closeLabel")} onClick={onClose} className="h-8 w-8 text-muted hover:bg-background">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
              {!student.droppedOut ? (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-success" />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="text-lg font-extrabold leading-tight text-card-foreground">{name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {student.studentId && <Badge>{student.studentId}</Badge>}
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(student.phone) || "—"}</span>
                <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{currentClass ? currentClass.name : t("waitingList")}</span>
              </div>
            </div>
          </div>
          <Badge variant={student.droppedOut ? "warn" : "success"} className="shrink-0 gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", student.droppedOut ? "bg-warn" : "bg-success")} />
            {student.droppedOut ? t("droppedOutBadge") : t("activeLabel")}
          </Badge>
        </div>

        <div className="flex gap-2 border-y border-border py-3">
          {student.classKey ? <DetailActionButton icon={LogOut} label={t("dropoutBtn")} tone="danger" onClick={onDropout} /> : null}
          <DetailActionButton icon={Pencil} label={t("editStudentTitle")} onClick={onEditStart} />
          <DetailActionButton icon={Trash2} label={t("deleteLabel")} tone="danger" onClick={onRemove} />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold text-muted">{t("classroomColumn")}</div>
          <ClassroomPicker classKey={student.classKey} classes={classes} onMove={onMove} />
        </div>

        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3 border-b border-border pb-2"><span className="text-muted">{t("emailLabel")}</span><span className="text-right font-semibold">{student.email || "—"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted">{t("address")}</span><span className="text-right font-semibold">{formatAddress(student) || "—"}</span></div>
        </div>

        {assessment.status !== "noPretest" && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="neutral">{t("pretestLabel")}: {student.pretestReading}</Badge>
            {assessment.status === "posttestMissing" ? (
              <Badge variant="warn">{t("posttestNotCompletedFlag")}</Badge>
            ) : (
              <>
                <Badge variant="neutral">{t("posttestLabel")}: {student.posttestReading}</Badge>
                <Badge variant={assessment.gain ? "success" : "neutral"}>{assessment.gain ? t("gainLabel") : t("noGainLabel")}</Badge>
              </>
            )}
          </div>
        )}

        {assessment.outcome && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="font-semibold text-muted">{t("outcomeLabel")}:</span>
            {assessment.outcomeEditable ? (
              <select
                value={assessment.outcome}
                onChange={(e) => onSetOutcome(e.target.value)}
                className="h-10 min-h-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium leading-tight text-card-foreground focus:border-primary focus:outline-none"
              >
                <option value="working">{t("outcomeWorking")}</option>
                <option value="scheduleRetest">{t("outcomeScheduleRetest")}</option>
              </select>
            ) : (
              <Badge variant="success">{t("outcomeCompleted")}</Badge>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>{t("closeLabel")}</Button>
        </div>
      </div>
    </div>
  );
}

function StudentsBoard({ term, sortMode, filterMode, onAddStudentClick }) {
  const { data } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState(null);
  const [dropHover, setDropHover] = useState(null);
  // Stores the id, not the student object -- so the detail modal stays live
  // (e.g. the Outcome select inside it) as data.students changes underneath it.
  const [detailStudentId, setDetailStudentId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const { moveStudent, removeStudent, markDropout, setOutcome, saveEdit } = useStudentRosterActions();

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const columns = activeClasses.map((c, idx) => {
    const students = studentsForClass(data.students, c.key);
    const searched = students.filter((s) => studentMatchesSearch(s, term));
    const withFilter = filterMode === "missingContact" ? searched.filter(studentMissingContact) : searched;
    const filtered = sortStudentsList(withFilter, sortMode);
    return { key: c.key, name: c.name, students, filtered, accent: columnAccentColor(c.key, idx) };
  });
  const totalStudents = columns.reduce((sum, c) => sum + c.students.length, 0);
  const totalFiltered = columns.reduce((sum, c) => sum + c.filtered.length, 0);
  const detailStudent = detailStudentId ? (data.students || []).find((s) => s.id === detailStudentId) || null : null;

  function handleDrop(e, colKey) {
    e.preventDefault();
    setDropHover(null);
    const studentId = e.dataTransfer.getData("text/plain");
    if (studentId) moveStudent(studentId, colKey);
  }

  return (
    <Card className="mb-5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex min-h-0 items-center gap-2 border-0 bg-transparent p-0"
        >
          {collapsed ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted" />}
          <CardTitle className="m-0">{t("classroomsHeading")}</CardTitle>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-bold text-muted">
            {totalFiltered}{(term || filterMode === "missingContact") ? "/" + totalStudents : ""}
          </span>
        </button>
        <Link to="/manage"><Button type="button" variant="ghost" size="sm" className="font-semibold">{t("addClassroomShortcutBtn")}</Button></Link>
      </CardHeader>
      {collapsed ? null : (
      <CardContent className="pt-0">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((col) => {
        const accent = col.accent;
        const filtered = col.filtered;
        const emptyMsg = term || filterMode === "missingContact" ? t("noSearchResults") : t("noStudentsEnrolled");
        return (
          <div
            key={col.key}
            className={cn(
              "flex flex-col overflow-hidden rounded-xl border bg-card shadow-card transition-shadow",
              dropHover === col.key ? "border-primary ring-2 ring-primary/30" : "border-border"
            )}
            style={{ borderTopWidth: 4, borderTopColor: accent }}
            onDragOver={(e) => { e.preventDefault(); setDropHover(col.key); }}
            onDragLeave={() => setDropHover((cur) => (cur === col.key ? null : cur))}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border bg-primary-tint px-4 py-3">
              <h3 className="m-0 truncate text-sm font-bold text-card-foreground">{col.name}</h3>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-bold text-muted">
                {filtered.length}
                {(term || filterMode === "missingContact") ? "/" + col.students.length : "/" + CLASS_CAPACITY}
              </span>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-3" style={{ maxHeight: 560 }}>
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
                <p className="py-6 text-center text-sm text-muted">{emptyMsg}</p>
              )}
            </div>
            <div className="border-t border-border p-1.5">
              <Button
                type="button"
                variant="ghost"
                onClick={onAddStudentClick}
                className="w-full font-semibold hover:bg-background"
                style={{ color: accent }}
              >
                {t("addStudentColumnBtn")}
              </Button>
            </div>
          </div>
        );
      })}
      </div>
      </CardContent>
      )}

      <StudentDetailModal
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

const listEditInputClass = "h-10 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

// One row of the Waiting List panel -- same student fields/edit form as a
// Kanban StudentCard, laid out horizontally instead of stacked in a card.
// No dropout control here: a waiting-list student has no classKey to drop
// out of by definition (waitingListStudents() below only returns students
// with none), so that action is simply never applicable in this list.
function WaitingListRow({ student, classes, editing, onMove, onEditStart, onEditCancel, onSave, onRemove, onViewDetails, selected, onToggleSelect }) {
  const t = useT();
  const [fields, setFields] = useState(() => ({
    firstName: student.firstName || "", lastName: student.lastName || "", phone: student.phone || "",
    email: student.email || "", street: student.street || "", city: student.city || "", zip: student.zip || "",
    pretestReading: student.pretestReading || "", posttestReading: student.posttestReading || ""
  }));
  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  if (editing) {
    return (
      <div className="py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input className={listEditInputClass} placeholder={t("firstName")} aria-label={t("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
          <input className={listEditInputClass} placeholder={t("lastName")} aria-label={t("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
          <input className={listEditInputClass} placeholder={t("phone")} aria-label={t("phone")} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} />
          <input className={listEditInputClass} placeholder={t("email")} aria-label={t("email")} value={fields.email} onChange={(e) => setField("email", e.target.value)} />
          <input className={listEditInputClass} placeholder={t("address")} aria-label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
          <input className={listEditInputClass} placeholder={t("city")} aria-label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
          <input className={listEditInputClass} placeholder={t("zip")} aria-label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" className={listEditInputClass} placeholder={t("pretestReadingLabel")} aria-label={t("pretestReadingLabel")} value={fields.pretestReading} onChange={(e) => setField("pretestReading", e.target.value)} />
            <input type="number" className={listEditInputClass} placeholder={t("posttestReadingLabel")} aria-label={t("posttestReadingLabel")} value={fields.posttestReading} onChange={(e) => setField("posttestReading", e.target.value)} />
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={() => onSave(fields)}>{t("saveLabel")}</Button>
          <Button size="sm" variant="secondary" onClick={onEditCancel}>{t("cancelLabel")}</Button>
        </div>
      </div>
    );
  }

  const assessment = studentAssessmentStatus(student);
  const name = student.firstName + " " + student.lastName;

  return (
    <div
      className="grid grid-cols-1 items-start gap-2 py-3 cursor-grab active:cursor-grabbing md:grid-cols-[minmax(200px,1.6fr)_minmax(140px,1fr)_minmax(150px,1.3fr)_180px_auto] md:items-center md:gap-x-4 md:gap-y-0"
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", student.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} aria-label={name} className="shrink-0" />
        <button
          type="button"
          onClick={onViewDetails}
          className="flex min-h-0 min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left"
        >
          <Avatar className="h-9 w-9 shrink-0"><AvatarFallback className={avatarColorFor(name)}>{initialsOf(student)}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <div className="text-sm font-bold text-card-foreground hover:text-primary hover:underline">{name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {student.studentId && <Badge>{student.studentId}</Badge>}
              {student.droppedOut && <Badge variant="warn">{t("droppedOutBadge")}</Badge>}
            </div>
          </div>
        </button>
      </div>
      <div className="pl-12 text-xs text-muted md:pl-0">
        {student.phone && <div>{formatPhone(student.phone)}</div>}
        {formatAddress(student) && <div>{formatAddress(student)}</div>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-12 md:pl-0">
        {assessment.status !== "noPretest" && (
          <>
            <Badge variant="neutral">{t("pretestLabel")}: {student.pretestReading}</Badge>
            {assessment.status === "posttestMissing" ? (
              <Badge variant="warn">{t("posttestNotCompletedFlag")}</Badge>
            ) : (
              <>
                <Badge variant="neutral">{t("posttestLabel")}: {student.posttestReading}</Badge>
                <Badge variant={assessment.gain ? "success" : "neutral"}>{assessment.gain ? t("gainLabel") : t("noGainLabel")}</Badge>
              </>
            )}
          </>
        )}
      </div>
      <select
        value="waiting"
        onChange={(e) => onMove(e.target.value === "waiting" ? null : e.target.value)}
        className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm font-semibold text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
      >
        <option value="waiting">{t("waitingList")}</option>
        {classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select>
      <div className="flex shrink-0 items-center justify-end gap-0.5">
        <Button variant="ghost" size="icon" title={t("editStudentTitle")} aria-label={t("editStudentTitle")} onClick={onEditStart} className="h-9 w-9 text-muted hover:bg-background hover:text-card-foreground">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove} className="h-9 w-9 text-muted hover:bg-tint-danger hover:text-accent">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Waiting List, pulled out of the Kanban grid into its own list section --
// it's the intake backlog (no capacity cap, often the longest roster), so a
// dense list reads better here than a column of tall cards. Still a drop
// target for drag-and-drop (dropping a card back here un-places a student),
// same as when it was a board column.
function WaitingListPanel({ term, sortMode, filterMode, onAddStudentClick, selected, onToggleSelect, onClearSelected }) {
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
  const { moveStudent, removeStudent, removeSelected, markDropout, setOutcome, saveEdit } = useStudentRosterActions();

  async function handleRemoveSelected() {
    const ok = await removeSelected(selected);
    if (ok) onClearSelected();
  }

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const students = waitingListStudents(data.students);
  const searched = students.filter((s) => studentMatchesSearch(s, term));
  const withFilter = filterMode === "missingContact" ? searched.filter(studentMissingContact) : searched;
  const filtered = sortStudentsList(withFilter, sortMode);
  const emptyMsg = term || filterMode === "missingContact" ? t("noSearchResults") : t("noStudentsEnrolled");
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
      className={cn("mb-5", dropHover ? "border-primary ring-2 ring-primary/30" : "")}
      style={{ borderTopWidth: 4, borderTopColor: WAITING_ACCENT }}
      onDragOver={(e) => { e.preventDefault(); setDropHover(true); }}
      onDragLeave={() => setDropHover(false)}
      onDrop={handleDrop}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex min-h-0 items-center gap-2 border-0 bg-transparent p-0"
        >
          {collapsed ? <ChevronDown className="h-4 w-4 shrink-0 text-muted" /> : <ChevronUp className="h-4 w-4 shrink-0 text-muted" />}
          <CardTitle className="m-0">{t("waitingList")}</CardTitle>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-bold text-muted">
            {filtered.length}{(term || filterMode === "missingContact") ? "/" + students.length : ""}
          </span>
        </button>
        <Button type="button" variant="ghost" size="sm" onClick={onAddStudentClick} className="font-semibold" style={{ color: WAITING_ACCENT }}>
          {t("addStudentColumnBtn")}
        </Button>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="pt-0">
          <BulkActionsBar count={selected.size} onClear={onClearSelected}>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleRemoveSelected}><Trash2 className="h-3.5 w-3.5" />{t("deleteSelectedLabel")}</Button>
          </BulkActionsBar>
          {filtered.length ? (
            <>
              <div className="divide-y divide-border">
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
                  />
                ))}
              </div>
              {filtered.length > WAITING_LIST_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 flex min-h-0 w-full items-center justify-center gap-1.5 border-0 border-t border-border bg-transparent pt-3 text-sm font-semibold text-primary hover:underline"
                >
                  {showAll ? (
                    <>{t("showLessLabel")} <ChevronUp className="h-4 w-4" /></>
                  ) : (
                    <>{t("showAllLabel").replace("{n}", String(filtered.length))} <ChevronDown className="h-4 w-4" /></>
                  )}
                </button>
              ) : null}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">{emptyMsg}</p>
          )}
        </CardContent>
      )}

      <StudentDetailModal
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
  const { data, setData, showToast, refetchStudents } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ firstName: "", lastName: "", phone: "", email: "", street: "", city: "", zip: "" });
  const [errors, setErrors] = useState([]);
  const [dupMatches, setDupMatches] = useState(null);
  const [pendingResult, setPendingResult] = useState(null);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  async function finalizeCreate(result, matchedClient) {
    const created = await createStudent(result);
    setData((prev) => attachClientToProgram(prev, "student", created, matchedClient));
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary">
          <UserPlus className="h-5 w-5" />
        </div>
        <div>
          <CardTitle>{t("enrollStudentTitle")}</CardTitle>
          <CardDescription className="mt-0.5">{t("enrollStudentDesc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="enroll-first-name" label={t("firstName")} required invalid={errors.indexOf("firstName") !== -1} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} placeholder={t("enterFirstNamePlaceholder")} />
          <TextField id="enroll-last-name" label={t("lastName")} required invalid={errors.indexOf("lastName") !== -1} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} placeholder={t("enterLastNamePlaceholder")} />
          <TextField id="enroll-phone" label={t("phone")} icon={Phone} value={fields.phone} onChange={(e) => setField("phone", formatPhone(e.target.value))} placeholder="(401) 123-4567" />
          <TextField id="enroll-email" label={t("email")} icon={Mail} value={fields.email} onChange={(e) => setField("email", e.target.value)} placeholder="name@example.com" />
        </div>
        <TextField id="enroll-street" label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} placeholder={t("streetAddressPlaceholder")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField id="enroll-city" label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} placeholder={t("city")} />
          <TextField id="enroll-zip" label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} placeholder={t("zip")} />
        </div>
        <p className="text-xs text-muted">{t("stateAlwaysRI")}</p>
        <Button size="lg" onClick={submit}>{t("enrollBtn")}</Button>
      </CardContent>
      {dupMatches && (
        <DuplicateClientWarning
          matches={dupMatches}
          onOpenExisting={(nbId) => { setDupMatches(null); setPendingResult(null); navigate("/clients/" + nbId); }}
          onEnrollExisting={(matchedClient) => finalizeCreate(pendingResult, matchedClient)}
          onCreateAnyway={() => finalizeCreate(pendingResult, null)}
          onCancel={() => { setDupMatches(null); setPendingResult(null); }}
        />
      )}
    </Card>
  );
}

function UploadStudentsPanel() {
  const { data, setData, showToast, refetchStudents } = useApp();
  const t = useT();
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");

  async function importRows(rows) {
    const result = buildImportedStudents(rows, data.students);
    if (!result) { showToast(t("importError")); return; }
    // Bulk import has no UI for a per-row duplicate review -- silently
    // attach each imported row to the best existing master-client match or
    // create a new one, same as Case Management's CSV import.
    const created = await createStudents(result.added);
    setData((prev) => {
      let next = prev;
      created.forEach((row) => {
        const matches = findPossibleDuplicates(row, next.clients || []);
        next = attachClientToProgram(next, "student", row, matches.length ? matches[0].client : null);
      });
      return next;
    });
    refetchStudents();
    showToast(created.length + " " + t("studentsImported"));
  }

  function handleImportClick() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importRows, () => showToast(t("importError")));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-success text-success">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <CardTitle>{t("uploadStudents")}</CardTitle>
          <CardDescription className="mt-0.5">{t("uploadStudentsDesc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="secondary" size="sm" className="gap-2" onClick={downloadStudentTemplate}>
          <Download className="h-4 w-4" /> {t("downloadTemplate")}
        </Button>
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary hover:bg-primary-tint/40">
          <FileUp className="h-6 w-6 text-muted" />
          <span className="text-sm font-semibold text-card-foreground">{fileName || t("chooseFileDragDrop")}</span>
          <span className="text-xs text-muted">{t("fileTypesHint")}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : "")}
          />
        </label>
        <Button size="lg" className="mt-4 w-full" onClick={handleImportClick}>{t("importBtn")}</Button>
      </CardContent>
    </Card>
  );
}

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-neutral text-muted">
          <CalendarRange className="h-5 w-5" />
        </div>
        <div>
          <CardTitle>{t("sessionHistoryTitle")}</CardTitle>
          <CardDescription className="mt-0.5">{t("sessionHistoryDesc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="field" style={{ marginBottom: 0 }}><label htmlFor="past-session-start">{t("pastSessionStart")}</label><DatePicker id="past-session-start" value={start} onChange={setStart} /></div>
          <div className="field" style={{ marginBottom: 0 }}><label htmlFor="past-session-end">{t("pastSessionEnd")}</label><DatePicker id="past-session-end" value={end} onChange={setEnd} /></div>
        </div>
        <Button className="mt-3 w-full sm:w-auto" onClick={addPastSession}>{t("addSession")}</Button>

        {!history.length ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary-tint px-4 py-3.5 text-sm text-primary">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">{t("noPastSessions")}</div>
              <div className="mt-0.5 text-primary/80">{t("noPastSessionsHint")}</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {history.map((s) => {
              const count = rosterCount(s.id);
              const expanded = expandedSessionId === s.id;
              const rows = (data.pastSessionStudents || []).filter((r) => r.sessionId === s.id);
              return (
                <div key={s.id} className="border-b border-border py-2 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">{fmtDateLong(s.startDate)} – {fmtDateLong(s.endDate)} <span className="text-muted">({count})</span></span>
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="border border-border" onClick={() => setExpandedSessionId(expanded ? null : s.id)}>
                        {expanded ? t("hideRoster") : t("viewRoster")}
                      </Button>
                      <Button size="sm" variant="ghost" className="border border-border text-accent hover:bg-tint-danger" onClick={() => deleteSession(s.id)}>{t("deleteLabel")}</Button>
                    </span>
                  </div>
                  {expanded && (
                    rows.length ? (
                      <div className="table-wrap mt-2">
                        <table>
                          <thead>
                            <tr><th>{t("nameLabel")}</th><th>{t("phoneLabel")}</th><th>{t("emailLabel")}</th><th>{t("address")}</th><th>{t("classroomColumn")}</th></tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id}>
                                <td>{r.firstName} {r.lastName}</td><td>{formatPhone(r.phone)}</td><td>{r.email || ""}</td>
                                <td>{formatAddress(r)}</td>
                                <td>{r.className || ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <div className="mt-2"><EmptyState icon="inbox" message={t("noPastRosterYet")} /></div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {history.length ? (
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="m-0 mb-1.5 text-sm font-bold text-card-foreground">{t("importPastRosterTitle")}</h4>
            <p className="text-sm text-muted">{t("importPastRosterDesc")}</p>
            <div className="mt-2"><Button variant="secondary" size="sm" className="gap-2" onClick={downloadPastSessionTemplate}><Download className="h-4 w-4" />{t("downloadPastTemplate")}</Button></div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="past-roster-session" className="mb-1 block text-xs font-semibold text-card-foreground">{t("selectSession")}</label>
                <select id="past-roster-session" value={pastSessionId} onChange={(e) => setPastSessionId(e.target.value)} className="h-11 min-h-0 w-full rounded-lg border border-border bg-background px-3 text-sm text-card-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15">
                  <option value=""></option>
                  {history.map((s) => <option key={s.id} value={s.id}>{fmtDateLong(s.startDate)} – {fmtDateLong(s.endDate)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="past-roster-upload-input" className="mb-1 block text-xs font-semibold text-card-foreground">{t("uploadStudents")}</label>
                <input ref={pastFileRef} type="file" id="past-roster-upload-input" accept=".xlsx,.xls,.csv" className="min-h-0 block w-full border-0 bg-transparent p-0 text-sm text-card-foreground file:mr-3 file:h-11 file:min-h-0 file:rounded-lg file:border-0 file:bg-primary-tint file:px-3 file:text-sm file:font-semibold file:text-primary" />
              </div>
              <div className="flex items-end"><Button className="w-full" onClick={handleImportPastClick}>{t("importBtn")}</Button></div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
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

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const totalEnrolled = totalEnrolledCount(data.students);
  const seatsAvailable = Math.max(0, activeClasses.length * CLASS_CAPACITY - totalEnrolled);
  const assessed = (data.students || []).filter((s) => s.active !== false).map(studentAssessmentStatus).filter((a) => a.status !== "noPretest");
  const completedCount = assessed.filter((a) => a.outcome === "completed").length;
  const completionRate = assessed.length ? Math.round((completedCount / assessed.length) * 100) : 0;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-1">{t("studentsPageTitle")}</h1>
          <p className="m-0 text-sm text-muted">{t("studentsPageSubtitle")}</p>
        </div>
        <Button size="lg" className="gap-2" onClick={startNewSession}>
          <CalendarPlus className="h-4 w-4" /> {t("startNewSession")}
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiStat icon={CalendarRange} tint="bg-primary-tint text-primary" label={t("currentSession")} value={fmtDateLong(session.startDate, lang) + " – " + fmtDateLong(session.endDate, lang)} index={0} />
        <KpiStat icon={Users} tint="bg-tint-success text-success" label={t("statTotalEnrolledLabel")} value={totalEnrolled} sublabel={t("navStudents")} index={1} big />
        <KpiStat icon={CheckCircle2} tint="bg-primary-tint text-primary" label={t("statSeatsAvailableLabel")} value={seatsAvailable} sublabel={t("statAcrossClassroomsLabel")} index={2} big />
        <KpiStat icon={TrendingUp} tint="bg-tint-warn text-warn" label={t("statCompletionRateLabel")} value={completionRate + "%"} sublabel={t("statThisSessionLabel")} index={3} big />
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("studentSearchPlaceholder")}
            aria-label={t("studentSearchPlaceholder")}
            className="h-12 min-h-0 w-full rounded-xl border border-border bg-background px-4 text-base text-card-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
          <p className="no-print mt-3 text-sm text-muted">{t("dragHint")}</p>
          <div className="no-print mt-3 flex flex-wrap items-stretch gap-2.5">
            <FilterFieldSelect label={t("filterLabel")} value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
              <option value="all">{t("filterAllLabel")}</option>
              <option value="missingContact">{t("filterMissingContactLabel")}</option>
            </FilterFieldSelect>
            <FilterFieldSelect label={t("sortByLabel")} value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="name">{t("sortByNameLabel")}</option>
              <option value="id">{t("sortByIdLabel")}</option>
              <option value="recent">{t("sortByRecentLabel")}</option>
            </FilterFieldSelect>
            <div className="ml-auto flex items-center">
              <Link to="/manage"><Button variant="secondary">{t("addClassroomShortcutBtn")}</Button></Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <WaitingListPanel
        term={search.trim().toLowerCase()} sortMode={sortMode} filterMode={filterMode} onAddStudentClick={scrollToEnroll}
        selected={selected} onToggleSelect={toggleSelect} onClearSelected={() => setSelected(new Set())}
      />

      <StudentsBoard term={search.trim().toLowerCase()} sortMode={sortMode} filterMode={filterMode} onAddStudentClick={scrollToEnroll} />

      <div ref={enrollSectionRef} className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EnrollStudentPanel />
        <div className="flex flex-col gap-4">
          <UploadStudentsPanel />
          <PastSessionsPanel />
        </div>
      </div>
    </>
  );
}
