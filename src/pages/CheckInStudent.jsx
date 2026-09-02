// CheckInStudent.jsx -- pick your name off today's class roster. Ported
// from checkin_checkout.js's renderCheckInStudent()/attachCheckInStudentHandlers().
//
// Duplicate check-ins are guarded twice: studentAlreadyCheckedInToday()
// below is a client-side check against in-memory data.visits (fast, but
// racy -- two rapid taps, or two kiosks, can both pass it before either
// visit lands). The real backstop is the DB's visits_student_date_unique
// partial unique index (student_id, visit_date); a second createVisit()
// for the same student/day fails there with a 23505 (unique_violation),
// which the catch below turns into the same "already checked in" toast
// instead of an unhandled error. `submittingId` covers the same-kiosk case
// even faster by disabling the tapped row until the request settles.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, useT } from "../context/AppContext.jsx";
import { classByKey, classesMeetingToday, meetingDaysLabel, studentAlreadyCheckedInToday, studentsForClass } from "../lib/students.js";
import { todayStr, uid } from "../lib/utils.js";
import { createVisit } from "../lib/checkinData.js";
import EmptyState from "../components/EmptyState.jsx";

export default function CheckInStudent() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [submittingId, setSubmittingId] = useState(null);

  const today = classesMeetingToday(data.classes);

  async function checkInStudent(student) {
    if (submittingId) return;
    if (studentAlreadyCheckedInToday(data.visits, student.id, todayStr())) {
      showToast(t("alreadyCheckedInToday"));
      return;
    }
    setSubmittingId(student.id);
    const cls = classByKey(data.classes, student.classKey);
    const now = new Date();
    const record = {
      id: uid(), firstName: student.firstName, lastName: student.lastName, phone: student.phone || "",
      email: "", address: "", city: "", state: "RI", zip: "",
      service: (cls && cls.service) || "adult_education", serviceOther: "",
      staff: (cls && cls.staff) || "esl_instructor", staffOther: "",
      notes: "", date: todayStr(), timeIn: now.toISOString(), timeOut: null,
      studentId: student.id, className: cls ? cls.name : ""
    };
    try {
      const created = await createVisit(record);
      navigate("/checkin/success", { state: { lastCheckInId: created.id, kind: "student", className: cls ? cls.name : "" } });
    } catch (err) {
      if (err && err.code === "23505") {
        showToast(t("alreadyCheckedInToday"));
      } else {
        throw err;
      }
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="kiosk-wrap">
      <h1>{t("selectYourName")}</h1>
      {!today.length ? (
        <div className="card"><EmptyState icon="calendar" message={t("noClassesMeetingToday")} /></div>
      ) : (
        today.map((c) => {
          const roster = studentsForClass(data.students, c.key);
          return (
            <div className="card" key={c.key}>
              <h2>{c.name}</h2>
              <p className="muted" style={{ marginTop: -8 }}>{t("meetsOn")}: {meetingDaysLabel(c.days, lang)}</p>
              {roster.length ? (
                <div className="role-grid">
                  {roster.map((s) => (
                    <button key={s.id} className="role-btn" style={{ textAlign: "center" }} disabled={!!submittingId} onClick={() => checkInStudent(s)}>
                      <h3 style={{ fontSize: "1.1rem" }}>{s.firstName} {s.lastName}</h3>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">{t("noStudentsEnrolled")}</p>
              )}
            </div>
          );
        })
      )}
      <div className="card" style={{ textAlign: "center" }}>
        <button className="btn-secondary btn-block" onClick={() => navigate("/checkin/visitor")}>{t("notMyName")}</button>
        <button className="btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => navigate("/checkin")}>{t("back")}</button>
      </div>
    </div>
  );
}
