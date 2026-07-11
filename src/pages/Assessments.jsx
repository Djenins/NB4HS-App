// Assessments.jsx -- page listing every enrolled student's pretest/posttest
// NRS level (CASAS Reading STEPS, see assessments.js), gain/no-gain/flag
// status, and Outcome. Pretest/posttest scores are still entered via each
// student's edit form on the Students board (per the client's "Both" answer
// -- edit inline, review here); the Outcome dropdown (Working/Schedule
// Retest) is editable directly from this table since it's not tied to the
// score-entry form -- "Completed" is automatic once a gain is achieved and
// isn't editable either place.
import { useState } from "react";
import { useApp, useT } from "../context/AppContext.jsx";
import { nrsLevelLabel, studentAssessmentStatus } from "../lib/assessments.js";
import { paginateList } from "../lib/pagination.js";
import { sortStudentsList, studentMatchesSearch } from "../lib/students.js";
import { initialsOf } from "../lib/utils.js";
import EmptyState from "../components/EmptyState.jsx";
import Pagination from "../components/Pagination.jsx";

function StatusBadge({ assessment, t }) {
  if (assessment.status === "noPretest") return <span className="muted">—</span>;
  if (assessment.status === "posttestMissing") return <span className="badge badge-warn">{t("posttestNotCompletedFlag")}</span>;
  return <span className={"badge " + (assessment.gain ? "badge-in" : "badge-out")}>{assessment.gain ? t("gainLabel") : t("noGainLabel")}</span>;
}

function OutcomeCell({ student, assessment, t, onSetOutcome }) {
  if (!assessment.outcome) return <span className="muted">—</span>;
  if (!assessment.outcomeEditable) return <span className="badge badge-in">{t("outcomeCompleted")}</span>;
  return (
    <select aria-label={t("outcomeLabel")} value={assessment.outcome} onChange={(e) => onSetOutcome(student.id, e.target.value)}>
      <option value="working">{t("outcomeWorking")}</option>
      <option value="scheduleRetest">{t("outcomeScheduleRetest")}</option>
    </select>
  );
}

export default function Assessments() {
  const { data, lang, setData } = useApp();
  const t = useT();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const active = (data.students || []).filter((s) => s.active !== false);
  const matched = active.filter((s) => studentMatchesSearch(s, term));
  const withAssessment = matched.map((s) => ({ student: s, assessment: studentAssessmentStatus(s) }));
  const filtered = withAssessment.filter((x) => {
    if (filterMode === "gain") return x.assessment.status === "complete" && x.assessment.gain;
    if (filterMode === "noGain") return x.assessment.status === "complete" && !x.assessment.gain;
    if (filterMode === "flagged") return x.assessment.status === "posttestMissing";
    if (filterMode === "noPretest") return x.assessment.status === "noPretest";
    return true;
  });
  const sorted = sortStudentsList(filtered.map((x) => ({ firstName: x.student.firstName, lastName: x.student.lastName, __ref: x }))).map((w) => w.__ref);
  const paged = paginateList(sorted, page);

  function setOutcome(id, outcome) {
    setData((prev) => Object.assign({}, prev, {
      students: prev.students.map((s) => (s.id === id ? Object.assign({}, s, { outcome: outcome }) : s))
    }));
  }

  return (
    <>
      <h1>{t("assessmentsTitle")}</h1>
      <div className="card">
        <p className="muted">{t("assessmentsDesc")}</p>
      </div>

      <div className="card">
        <div className="student-search-bar">
          <input type="text" placeholder={t("studentSearchPlaceholder")} aria-label={t("studentSearchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select aria-label={t("filterLabel")} value={filterMode} onChange={(e) => { setFilterMode(e.target.value); setPage(1); }}>
            <option value="all">{t("assessmentFilterAll")}</option>
            <option value="gain">{t("assessmentFilterGain")}</option>
            <option value="noGain">{t("assessmentFilterNoGain")}</option>
            <option value="flagged">{t("assessmentFilterFlagged")}</option>
            <option value="noPretest">{t("assessmentFilterNoPretest")}</option>
          </select>
        </div>

        {paged.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("nameLabel")}</th>
                  <th>{t("pretestLabel")}</th>
                  <th>{t("posttestLabel")}</th>
                  <th>{t("statusLabel")}</th>
                  <th>{t("outcomeLabel")}</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map(({ student, assessment }) => (
                  <tr key={student.id}>
                    <td>
                      <span className="client-row-name">
                        <span className="avatar-chip">{initialsOf(student)}</span>
                        <span>{student.firstName} {student.lastName}</span>
                      </span>
                    </td>
                    <td>{assessment.pretestLevel ? nrsLevelLabel(assessment.pretestLevel, lang) : "—"}</td>
                    <td>{assessment.posttestLevel ? nrsLevelLabel(assessment.posttestLevel, lang) : "—"}</td>
                    <td><StatusBadge assessment={assessment} t={t} /></td>
                    <td><OutcomeCell student={student} assessment={assessment} t={t} onSetOutcome={setOutcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="students" message={t("noAssessmentDataYet")} />
        )}
        <Pagination page={paged.page} totalPages={paged.totalPages} onChange={(delta) => setPage(paged.page + delta)} />
      </div>
    </>
  );
}
