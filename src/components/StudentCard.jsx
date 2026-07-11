// StudentCard.jsx -- one drag-and-drop-able roster card on the Students
// board, in either view mode (name, id, contact info, a "move to..." select)
// or edit mode (inline edit form). Ported from students.js's
// renderStudentCard()/renderStudentEditForm(). Native HTML5 drag-and-drop
// (no library) -- same mechanism as the original, just wired through React
// event props instead of addEventListener calls.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { nrsLevelLabel, studentAssessmentStatus } from "../lib/assessments.js";
import { formatAddress, initialsOf } from "../lib/utils.js";
import Icon from "./Icon.jsx";

export default function StudentCard({ student, classes, editing, onMove, onEditStart, onEditCancel, onSave, onRemove, onDropout, onSetOutcome }) {
  const { lang } = useApp();
  const t = useT();
  const [fields, setFields] = useState(() => ({
    firstName: student.firstName || "", lastName: student.lastName || "", phone: student.phone || "",
    email: student.email || "", street: student.street || "", city: student.city || "", zip: student.zip || "",
    pretestReading: student.pretestReading || "", posttestReading: student.posttestReading || ""
  }));

  function setField(name, value) {
    setFields((prev) => Object.assign({}, prev, { [name]: value }));
  }
  function save() {
    onSave(fields);
  }

  if (editing) {
    return (
      <div className="student-card" style={{ cursor: "default" }}>
        <div className="flex-between"><span className="name">{t("editStudentTitle")}</span></div>
        <input type="text" placeholder={t("firstName")} aria-label={t("firstName")} value={fields.firstName} onChange={(e) => setField("firstName", e.target.value)} />
        <input type="text" placeholder={t("lastName")} aria-label={t("lastName")} value={fields.lastName} onChange={(e) => setField("lastName", e.target.value)} />
        <input type="text" placeholder={t("phone")} aria-label={t("phone")} value={fields.phone} onChange={(e) => setField("phone", e.target.value)} />
        <input type="text" placeholder={t("email")} aria-label={t("email")} value={fields.email} onChange={(e) => setField("email", e.target.value)} />
        <input type="text" placeholder={t("address")} aria-label={t("address")} value={fields.street} onChange={(e) => setField("street", e.target.value)} />
        <input type="text" placeholder={t("city")} aria-label={t("city")} value={fields.city} onChange={(e) => setField("city", e.target.value)} />
        <input type="text" placeholder={t("zip")} aria-label={t("zip")} value={fields.zip} onChange={(e) => setField("zip", e.target.value)} />
        <div className="student-card-assessment-fields">
          <input type="number" placeholder={t("pretestReadingLabel")} aria-label={t("pretestReadingLabel")} value={fields.pretestReading} onChange={(e) => setField("pretestReading", e.target.value)} />
          <input type="number" placeholder={t("posttestReadingLabel")} aria-label={t("posttestReadingLabel")} value={fields.posttestReading} onChange={(e) => setField("posttestReading", e.target.value)} />
        </div>
        <div className="edit-row">
          <button className="btn-primary" onClick={save}>{t("saveLabel")}</button>
          <button className="btn-ghost" onClick={onEditCancel}>{t("cancelLabel")}</button>
        </div>
      </div>
    );
  }

  const assessment = studentAssessmentStatus(student);

  return (
    <div
      className="student-card"
      draggable="true"
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", student.id); e.dataTransfer.effectAllowed = "move"; }}
    >
      <div className="flex-between">
        <span className="name" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="avatar-chip">{initialsOf(student)}</span>
          {student.firstName} {student.lastName}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          {student.classKey && (
            <button className="btn-ghost btn-icon" title={t("dropoutBtn")} aria-label={t("dropoutBtn")} onClick={onDropout}>
              <Icon name="checkout" />
            </button>
          )}
          <button className="btn-ghost btn-icon" title={t("editStudentTitle")} aria-label={t("editStudentTitle")} onClick={onEditStart}>&#9998;</button>
          <button className="btn-ghost btn-icon btn-icon-danger" title={t("deleteLabel")} aria-label={t("deleteLabel")} onClick={onRemove}>&times;</button>
        </span>
      </div>
      {student.studentId && <span className="student-card-id">{student.studentId}</span>}
      {student.droppedOut && <span className="badge badge-warn">{t("droppedOutBadge")}</span>}
      {student.phone && <div className="muted" style={{ fontSize: ".8rem" }}>{student.phone}</div>}
      {formatAddress(student) && <div className="muted" style={{ fontSize: ".75rem" }}>{formatAddress(student)}</div>}
      {assessment.status !== "noPretest" && (
        <div className="student-card-assessment">
          <span className="badge badge-tag">{t("pretestLabel")}: {nrsLevelLabel(assessment.pretestLevel, lang)}</span>
          {assessment.status === "posttestMissing" ? (
            <span className="badge badge-warn">{t("posttestNotCompletedFlag")}</span>
          ) : (
            <span className={"badge " + (assessment.gain ? "badge-in" : "badge-out")}>{assessment.gain ? t("gainLabel") : t("noGainLabel")}</span>
          )}
        </div>
      )}
      {assessment.outcome && (
        <div className="student-card-outcome">
          <span className="muted">{t("outcomeLabel")}:</span>
          {assessment.outcomeEditable ? (
            <select value={assessment.outcome} onChange={(e) => onSetOutcome(e.target.value)}>
              <option value="working">{t("outcomeWorking")}</option>
              <option value="scheduleRetest">{t("outcomeScheduleRetest")}</option>
            </select>
          ) : (
            <span className="badge badge-in">{t("outcomeCompleted")}</span>
          )}
        </div>
      )}
      <select value={student.classKey || "waiting"} onChange={(e) => onMove(e.target.value === "waiting" ? null : e.target.value)}>
        <option value="waiting">{t("waitingList")}</option>
        {classes.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
      </select>
    </div>
  );
}
