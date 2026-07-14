// CheckInStudent.jsx -- pick your name off today's class roster. Ported
// from checkin_checkout.js's renderCheckInStudent()/attachCheckInStudentHandlers().
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

  const today = classesMeetingToday(data.classes);

  async function checkInStudent(student) {
    if (studentAlreadyCheckedInToday(data.visits, student.id, todayStr())) {
      showToast(t("alreadyCheckedInToday"));
      return;
    }
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
    const created = await createVisit(record);
    navigate("/checkin/success", { state: { lastCheckInId: created.id } });
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
                    <button key={s.id} className="role-btn" style={{ textAlign: "center" }} onClick={() => checkInStudent(s)}>
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
