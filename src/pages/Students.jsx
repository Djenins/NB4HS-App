// Students.jsx -- the Administrator/Case Manager/Job Developer Students
// page: search + drag-and-drop Kanban roster board (waiting list + each
// active classroom), student enrollment, CSV/Excel roster upload, and
// session history (including past-session roster import). Ported from
// students.js's renderStudents()/renderStudentsBoardHtml()/
// renderSessionHistoryCard() and their attach* handlers.
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { CLASS_CAPACITY } from "../lib/constants.js";
import { addMonths, fmtDateLong, formatAddress, todayStr, uid } from "../lib/utils.js";
import {
  buildImportedPastRoster, buildImportedStudents, buildUpdatedStudent, columnAccentColor,
  downloadPastSessionTemplate, downloadStudentTemplate, enrollStudent, readRowsFromFile,
  sortStudentsList, studentMatchesSearch, studentMissingContact, studentsForClass, totalEnrolledCount, waitingListStudents
} from "../lib/students.js";
import DatePicker from "../components/DatePicker.jsx";
import EmptyState from "../components/EmptyState.jsx";
import StudentCard from "../components/StudentCard.jsx";

function StudentsBoard({ term, sortMode, filterMode }) {
  const { data, setData, requestConfirm, showToast } = useApp();
  const t = useT();
  const [editingId, setEditingId] = useState(null);
  const [dropHover, setDropHover] = useState(null);

  const activeClasses = (data.classes || []).filter((c) => c.active !== false);
  const columns = [{ key: "waiting", name: t("waitingList"), students: waitingListStudents(data.students) }].concat(
    activeClasses.map((c) => ({ key: c.key, name: c.name, students: studentsForClass(data.students, c.key) }))
  );

  // Waiting List (the backlog) has no cap -- only real classrooms do. Moving
  // a student who's already in the target class is always a no-op allowed
  // (e.g. re-dropping on the same column), so it doesn't get blocked by its
  // own presence in the count. Placing a student into any real class also
  // clears a prior dropout flag -- coming back into a class is how staff
  // "un-drops" someone, no separate control needed for that.
  function moveStudent(studentId, classKeyOrNull) {
    if (classKeyOrNull) {
      const student = (data.students || []).find((s) => s.id === studentId);
      if (student && student.classKey !== classKeyOrNull) {
        const currentCount = studentsForClass(data.students, classKeyOrNull).length;
        if (currentCount >= CLASS_CAPACITY) {
          showToast(t("classFullMessage"));
          return;
        }
      }
    }
    setData((prev) => Object.assign({}, prev, {
      students: prev.students.map((s) => (s.id === studentId ? Object.assign({}, s, {
        classKey: classKeyOrNull,
        droppedOut: classKeyOrNull ? false : s.droppedOut,
        dropoutDate: classKeyOrNull ? "" : s.dropoutDate
      }) : s))
    }));
  }

  async function removeStudent(id) {
    const ok = await requestConfirm(t("removeStudentConfirm"), { danger: true });
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, { students: prev.students.filter((s) => s.id !== id) }));
  }

  // "Dropped out" is a soft status, not a delete -- the record (and any
  // assessment scores already entered) stays intact, they're just moved
  // back to the waiting list/backlog and tagged so staff can tell them apart
  // from students who were never placed yet.
  async function markDropout(id) {
    const ok = await requestConfirm(t("dropoutConfirm"));
    if (!ok) return;
    setData((prev) => Object.assign({}, prev, {
      students: prev.students.map((s) => (s.id === id ? Object.assign({}, s, { classKey: null, droppedOut: true, dropoutDate: todayStr() }) : s))
    }));
    showToast(t("studentDroppedOut"));
  }

  // Manual half of the Outcome field (the "completed" half is computed
  // automatically from a gain -- see assessments.js -- and isn't settable
  // here since a real gain always wins over whatever was picked before).
  function setOutcome(id, outcome) {
    setData((prev) => Object.assign({}, prev, {
      students: prev.students.map((s) => (s.id === id ? Object.assign({}, s, { outcome: outcome }) : s))
    }));
  }

  function saveEdit(student, fields) {
    const updated = buildUpdatedStudent(student, fields);
    if (!updated) { showToast(t("fixErrors")); return; }
    setData((prev) => Object.assign({}, prev, {
      students: prev.students.map((s) => (s.id === student.id ? updated : s))
    }));
    setEditingId(null);
    showToast(t("studentUpdated"));
  }

  function handleDrop(e, colKey) {
    e.preventDefault();
    setDropHover(null);
    const studentId = e.dataTransfer.getData("text/plain");
    if (studentId) moveStudent(studentId, colKey === "waiting" ? null : colKey);
  }

  return (
    <div className="board">
      {columns.map((col, idx) => {
        const searched = col.students.filter((s) => studentMatchesSearch(s, term));
        const withFilter = filterMode === "missingContact" ? searched.filter(studentMissingContact) : searched;
        const filtered = sortStudentsList(withFilter, sortMode);
        const emptyMsg = term || filterMode === "missingContact" ? t("noSearchResults") : t("noStudentsEnrolled");
        return (
          <div
            className={"board-col" + (dropHover === col.key ? " drop-hover" : "")}
            style={{ borderTopColor: columnAccentColor(col.key, idx - 1) }}
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setDropHover(col.key); }}
            onDragLeave={() => setDropHover((cur) => (cur === col.key ? null : cur))}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className="board-col-head">
              <h3>{col.name}</h3>
              <span className="board-col-count">
                {filtered.length}
                {(term || filterMode === "missingContact") ? "/" + col.students.length : (col.key !== "waiting" ? "/" + CLASS_CAPACITY : "")}
              </span>
            </div>
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
                  onSave={(fields) => saveEdit(s, fields)}
                  onRemove={() => removeStudent(s.id)}
                  onDropout={() => markDropout(s.id)}
                  onSetOutcome={(outcome) => setOutcome(s.id, outcome)}
                />
              ))
            ) : (
              <p className="muted" style={{ fontSize: ".85rem" }}>{emptyMsg}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EnrollStudentDetails({ open, onToggle }) {
  const { data, setData, showToast } = useApp();
  const t = useT();
  const [fields, setFields] = useState({ firstName: "", lastName: "", phone: "", email: "", street: "", city: "", zip: "" });
  const [errors, setErrors] = useState([]);

  function setField(name, value) { setFields((prev) => Object.assign({}, prev, { [name]: value })); }

  function submit() {
    if (!fields.firstName.trim() || !fields.lastName.trim()) {
      setErrors(["firstName", "lastName"].filter((f) => !fields[f].trim()));
      showToast(t("fixErrors"));
      return;
    }
    setErrors([]);
    const result = enrollStudent(fields, data.nextStudentNumber || 1);
    if (!result) return;
    setData((prev) => Object.assign({}, prev, {
      students: (prev.students || []).concat([result.student]),
      nextStudentNumber: result.nextStudentNumber
    }));
    setFields({ firstName: "", lastName: "", phone: "", email: "", street: "", city: "", zip: "" });
    showToast(t("studentEnrolled") + " " + result.student.studentId);
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("enrollStudentTitle")}</summary>
      <div className="details-body">
        <p className="muted">{t("enrollStudentDesc")}</p>
        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionPersonalDetails")}</h3>
            <p>{t("sectionPersonalDetailsDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-2">
              <div className="field"><label htmlFor="enroll-first-name">{t("firstName")}</label><input type="text" id="enroll-first-name" className={errors.indexOf("firstName") !== -1 ? "field-invalid" : ""} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} /></div>
              <div className="field"><label htmlFor="enroll-last-name">{t("lastName")}</label><input type="text" id="enroll-last-name" className={errors.indexOf("lastName") !== -1 ? "field-invalid" : ""} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} /></div>
              <div className="field"><label htmlFor="enroll-phone">{t("phone")}</label><input type="text" id="enroll-phone" value={fields.phone} onChange={(e) => setField("phone", e.target.value)} /></div>
              <div className="field"><label htmlFor="enroll-email">{t("email")}</label><input type="text" id="enroll-email" value={fields.email} onChange={(e) => setField("email", e.target.value)} /></div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-head">
            <h3>{t("sectionAddress")}</h3>
            <p>{t("sectionAddressDesc")}</p>
          </div>
          <div className="form-section-body">
            <div className="grid grid-3">
              <div className="field"><label htmlFor="enroll-street">{t("address")}</label><input type="text" id="enroll-street" value={fields.street} onChange={(e) => setField("street", e.target.value)} /></div>
              <div className="field"><label htmlFor="enroll-city">{t("city")}</label><input type="text" id="enroll-city" value={fields.city} onChange={(e) => setField("city", e.target.value)} /></div>
              <div className="field"><label htmlFor="enroll-zip">{t("zip")}</label><input type="text" id="enroll-zip" value={fields.zip} onChange={(e) => setField("zip", e.target.value)} /></div>
            </div>
            <p className="muted" style={{ fontSize: ".85rem" }}>{t("stateAlwaysRI")}</p>
          </div>
        </div>

        <div className="pill-row" style={{ marginTop: 4 }}><button className="btn-primary" onClick={submit}>{t("enrollBtn")}</button></div>
      </div>
    </details>
  );
}

function UploadStudentsDetails({ open, onToggle }) {
  const { data, setData, showToast } = useApp();
  const t = useT();
  const fileRef = useRef(null);

  function importRows(rows) {
    const result = buildImportedStudents(rows, data.students, data.nextStudentNumber || 1);
    if (!result) { showToast(t("importError")); return; }
    setData((prev) => Object.assign({}, prev, {
      students: (prev.students || []).concat(result.added),
      nextStudentNumber: result.nextStudentNumber
    }));
    showToast(result.added.length + " " + t("studentsImported"));
  }

  function handleImportClick() {
    const file = fileRef.current && fileRef.current.files && fileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importRows, () => showToast(t("importError")));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("uploadStudents")}</summary>
      <div className="details-body">
        <p className="muted">{t("uploadStudentsDesc")}</p>
        <div className="pill-row"><button className="btn-secondary" onClick={downloadStudentTemplate}>{t("downloadTemplate")}</button></div>
        <div className="grid grid-2">
          <div className="field"><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" /></div>
          <button className="btn-primary" onClick={handleImportClick}>{t("importBtn")}</button>
        </div>
        <p className="muted">{t("waitingListNote")}</p>
      </div>
    </details>
  );
}

function SessionHistoryDetails({ open, onToggle }) {
  const { data, setData, requestConfirm, showToast } = useApp();
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
    setData((prev) => Object.assign({}, prev, {
      sessionHistory: (prev.sessionHistory || []).filter((s) => s.id !== id),
      pastSessionStudents: (prev.pastSessionStudents || []).filter((r) => r.sessionId !== id)
    }));
    setExpandedSessionId((cur) => (cur === id ? null : cur));
  }

  function addPastSession() {
    if (!start || !end) { showToast(t("fixErrors")); return; }
    if (end <= start) { showToast(t("invalidDateRange")); return; }
    setData((prev) => Object.assign({}, prev, {
      sessionHistory: (prev.sessionHistory || []).concat([{ id: uid(), startDate: start, endDate: end }])
    }));
    setStart(""); setEnd("");
    showToast(t("pastSessionAdded"));
  }

  function importPastRoster(rows) {
    const result = buildImportedPastRoster(pastSessionId, rows, data.classes);
    if (!result) { showToast(t("importError")); return; }
    setData((prev) => Object.assign({}, prev, {
      pastSessionStudents: (prev.pastSessionStudents || []).concat(result.added)
    }));
    showToast(result.added.length + " " + t("pastStudentsImported") + (result.unmatched ? " (" + result.unmatched + " " + t("unmatchedClassroom") + ")" : ""));
  }

  function handleImportPastClick() {
    if (!pastSessionId) { showToast(t("addPastSessionFirst")); return; }
    const file = pastFileRef.current && pastFileRef.current.files && pastFileRef.current.files[0];
    if (!file) { showToast(t("chooseFileFirst")); return; }
    readRowsFromFile(file, importPastRoster, () => showToast(t("importError")));
  }

  return (
    <details className="card" open={open} onToggle={(e) => onToggle(e.target.open)}>
      <summary>{t("sessionHistoryTitle")}</summary>
      <div className="details-body">
        {!history.length ? (
          <EmptyState icon="calendar" message={t("noPastSessions")} />
        ) : (
          history.map((s) => {
            const count = rosterCount(s.id);
            const expanded = expandedSessionId === s.id;
            const rows = (data.pastSessionStudents || []).filter((r) => r.sessionId === s.id);
            return (
              <div key={s.id} style={{ borderBottom: "1px solid var(--border,#e5e5e5)", padding: "8px 0" }}>
                <div className="kv">
                  <span>{fmtDateLong(s.startDate)} – {fmtDateLong(s.endDate)} <span className="muted">({count})</span></span>
                  <span>
                    <button className="btn-ghost btn-sm" onClick={() => setExpandedSessionId(expanded ? null : s.id)}>
                      {expanded ? t("hideRoster") : t("viewRoster")}
                    </button>{" "}
                    <button className="btn-ghost btn-sm btn-outline-danger" onClick={() => deleteSession(s.id)}>{t("deleteLabel")}</button>
                  </span>
                </div>
                {expanded && (
                  rows.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>{t("nameLabel")}</th><th>{t("phoneLabel")}</th><th>{t("emailLabel")}</th><th>{t("address")}</th><th>{t("classroomColumn")}</th></tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.id}>
                              <td>{r.firstName} {r.lastName}</td><td>{r.phone || ""}</td><td>{r.email || ""}</td>
                              <td>{formatAddress(r)}</td>
                              <td>{r.className || ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <EmptyState icon="inbox" message={t("noPastRosterYet")} />
                )}
              </div>
            );
          })
        )}
        <div className="grid grid-3" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="past-session-start">{t("pastSessionStart")}</label><DatePicker id="past-session-start" value={start} onChange={setStart} /></div>
          <div className="field"><label htmlFor="past-session-end">{t("pastSessionEnd")}</label><DatePicker id="past-session-end" value={end} onChange={setEnd} /></div>
          <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-secondary btn-block" onClick={addPastSession}>{t("addSession")}</button>
          </div>
        </div>
        {history.length ? (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--border,#e5e5e5)", paddingTop: 14 }}>
            <h4 style={{ margin: "0 0 6px 0" }}>{t("importPastRosterTitle")}</h4>
            <p className="muted">{t("importPastRosterDesc")}</p>
            <div className="pill-row"><button className="btn-secondary" onClick={downloadPastSessionTemplate}>{t("downloadPastTemplate")}</button></div>
            <div className="grid grid-3">
              <div className="field">
                <label htmlFor="past-roster-session">{t("selectSession")}</label>
                <select id="past-roster-session" value={pastSessionId} onChange={(e) => setPastSessionId(e.target.value)}>
                  <option value=""></option>
                  {history.map((s) => <option key={s.id} value={s.id}>{fmtDateLong(s.startDate)} – {fmtDateLong(s.endDate)}</option>)}
                </select>
              </div>
              <div className="field"><label htmlFor="past-roster-upload-input">{t("uploadStudents")}</label><input ref={pastFileRef} type="file" id="past-roster-upload-input" accept=".xlsx,.xls,.csv" /></div>
              <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn-primary btn-block" onClick={handleImportPastClick}>{t("importBtn")}</button>
              </div>
            </div>
          </div>
        ) : <p className="muted" style={{ marginTop: 14 }}>{t("addPastSessionFirst")}</p>}
      </div>
    </details>
  );
}

export default function Students() {
  const { data, setData, requestConfirm, showToast } = useApp();
  const t = useT();
  const location = useLocation();
  // Sidebar's "search a student" shortcut (Shell.jsx) hands its query here
  // via router state instead of a second results view -- this board already
  // knows how to render a filtered roster.
  const [search, setSearch] = useState(() => (location.state && location.state.presetSearch) || "");
  const [sortMode, setSortMode] = useState("name");
  const [filterMode, setFilterMode] = useState("all");
  const [opens, setOpens] = useState({ enroll: false, upload: false, sessions: false });

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
    setData((prev) => Object.assign({}, prev, {
      sessionHistory: prev.currentSession ? (prev.sessionHistory || []).concat([prev.currentSession]) : (prev.sessionHistory || []),
      currentSession: { id: uid(), startDate: start, endDate: addMonths(start, 3) },
      students: (prev.students || []).map((s) => Object.assign({}, s, { classKey: null }))
    }));
    showToast(t("newSessionStarted"));
  }

  return (
    <>
      <h1>{t("studentsPageTitle")}</h1>
      <div className="card flex-between">
        <div>
          <strong>{t("currentSession")}:</strong> {fmtDateLong(session.startDate)} – {fmtDateLong(session.endDate)}
          <div className="muted" style={{ marginTop: 4 }}>{t("totalEnrolledLabel")}: {totalEnrolledCount(data.students)}</div>
        </div>
        <button className="btn-secondary" onClick={startNewSession}>{t("startNewSession")}</button>
      </div>

      <div className="card">
        <div className="student-search-bar">
          <input type="text" placeholder={t("studentSearchPlaceholder")} aria-label={t("studentSearchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="muted no-print" style={{ margin: "0 0 10px 0" }}>{t("dragHint")}</p>
        <div className="board-toolbar no-print">
          <span className="board-toolbar-label">{t("filterLabel")}</span>
          <select aria-label={t("filterLabel")} value={filterMode} onChange={(e) => setFilterMode(e.target.value)}>
            <option value="all">{t("filterAllLabel")}</option>
            <option value="missingContact">{t("filterMissingContactLabel")}</option>
          </select>
          <span className="board-toolbar-label">{t("sortByLabel")}</span>
          <select aria-label={t("sortByLabel")} value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
            <option value="name">{t("sortByNameLabel")}</option>
            <option value="id">{t("sortByIdLabel")}</option>
            <option value="recent">{t("sortByRecentLabel")}</option>
          </select>
          <span className="board-toolbar-spacer" />
          <Link to="/manage" className="btn-secondary btn-sm">{t("addClassroomShortcutBtn")}</Link>
        </div>
        <StudentsBoard term={search.trim().toLowerCase()} sortMode={sortMode} filterMode={filterMode} />
      </div>

      <EnrollStudentDetails open={opens.enroll} onToggle={(v) => setOpens((prev) => Object.assign({}, prev, { enroll: v }))} />
      <UploadStudentsDetails open={opens.upload} onToggle={(v) => setOpens((prev) => Object.assign({}, prev, { upload: v }))} />
      <SessionHistoryDetails open={opens.sessions} onToggle={(v) => setOpens((prev) => Object.assign({}, prev, { sessions: v }))} />
    </>
  );
}
