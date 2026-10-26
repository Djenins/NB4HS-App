// CheckInStudent.jsx -- pick your name off today's class roster, laid out as
// the landscape kiosk sibling of CheckInVisitor.jsx (identity + today's
// classes on the left, rosters in the centre, a welcome panel on the right).
// This pass is UI only; the check-in logic below is unchanged.
//
// Duplicate check-ins are guarded twice: studentAlreadyCheckedInToday()
// below is a client-side check against in-memory data.visits (fast, but
// racy -- two rapid taps, or two kiosks, can both pass it before either
// visit lands). The real backstop is the DB's visits_student_date_unique
// partial unique index (student_id, visit_date); a second check-in RPC
// for the same student/day fails there with a 23505 (unique_violation),
// which the catch below turns into the same "already checked in" toast
// instead of an unhandled error. `submittingId` covers the same-kiosk case
// even faster by disabling every roster row until the request settles.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarX, GraduationCap, UserRoundSearch } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { classByKey, classesMeetingToday, meetingDaysLabel, studentAlreadyCheckedInToday, studentsForClass } from "../lib/students.js";
import { todayStr } from "../lib/utils.js";
import { checkInStudentVisit } from "../lib/checkinData.js";
import KioskSidebar from "../components/kiosk/KioskSidebar.jsx";
import KioskActionPanel from "../components/kiosk/KioskActionPanel.jsx";
import ClassRosterSection from "../components/kiosk/ClassRosterSection.jsx";

export default function CheckInStudent() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const [submittingId, setSubmittingId] = useState(null);
  const [activeClass, setActiveClass] = useState(null);
  const sectionRefs = useRef({});

  const today = classesMeetingToday(data.classes);

  async function checkInStudent(student) {
    if (submittingId) return;
    if (studentAlreadyCheckedInToday(data.visits, student.id, todayStr())) {
      showToast(t("alreadyCheckedInToday"));
      return;
    }
    setSubmittingId(student.id);
    const cls = classByKey(data.classes, student.classKey);
    try {
      // The visit row (contact details, class service/staff) is built
      // server-side by kiosk_student_check_in -- the kiosk roster only
      // carries names.
      const created = await checkInStudentVisit(student.id, todayStr());
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

  // Today's classes stand in for the visitor form's numbered steps: same
  // cards, same anchor-navigation behaviour, one per class instead of one
  // per form section.
  const steps = today.map((c, i) => ({
    id: c.key,
    number: ("0" + (i + 1)).slice(-2),
    icon: GraduationCap,
    title: c.name,
    description: t("meetsOn") + ": " + meetingDaysLabel(c.days, lang)
  }));
  const currentClass = activeClass || (today.length ? today[0].key : null);

  function goToClass(key) {
    setActiveClass(key);
    const el = sectionRefs.current[key];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // t("notMyName") is a combined "context / action" string in every locale
  // ("I don't see my name / I'm a Visitor"). Split on the slash so the panel
  // button can set the action in bold over a quieter context line rather than
  // wrapping one long sentence across three lines; if a translation ever
  // drops the slash, it just renders as a single line.
  const notMyNameParts = t("notMyName").split("/").map((part) => part.trim()).filter(Boolean);
  const notMyNameLead = notMyNameParts.length > 1 ? notMyNameParts[0] : null;
  const notMyNameAction = notMyNameParts.length > 1 ? notMyNameParts.slice(1).join(" / ") : t("notMyName");


  return (
    <div className="kiosk-checkin flex min-h-0 w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1680px] min-h-0 flex-1 flex-col rounded-[22px] sm:border sm:border-border sm:bg-card sm:p-5 sm:shadow-card">
        {/* Back, clock and language live in the shared KioskTopBar (Shell.jsx). */}

        <div className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(210px,19%)_minmax(0,1fr)_minmax(240px,20%)] lg:grid-rows-[minmax(0,1fr)] lg:gap-5 xl:gap-6">
          <KioskSidebar
            title={t("studentCheckInTitle")}
            subtitle={t("selectYourName")}
            icon={GraduationCap}
            steps={steps}
            activeStep={currentClass}
            onStepSelect={goToClass}
            navLabel={t("kioskTodaysClasses")}
            helpTitle={t("landingNeedHelp")}
            helpText={t("landingAskStaff")}
          />

          <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1.5">
            {today.length ? (
              today.map((c, i) => (
                <ClassRosterSection
                  key={c.key}
                  id={"kiosk-class-" + c.key}
                  sectionRef={(el) => { sectionRefs.current[c.key] = el; }}
                  classItem={c}
                  roster={studentsForClass(data.students, c.key)}
                  meetsLabel={steps[i].description}
                  emptyLabel={t("noStudentsEnrolled")}
                  submittingId={submittingId}
                  onSelect={(s) => { setActiveClass(c.key); checkInStudent(s); }}
                />
              ))
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-[18px] border border-border bg-card p-10 text-center shadow-card">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-tint-neutral text-muted">
                  <CalendarX size={30} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className="mt-4 text-[1.15rem] font-bold text-navy dark:text-[color:var(--text)]">{t("noClassesMeetingToday")}</p>
                <p className="mt-1 text-[0.98rem] text-muted">{t("notMyName")}</p>
              </div>
            )}
          </div>

          <KioskActionPanel
            title={t("kioskStudentPanelTitle")}
            description={t("kioskStudentPanelDesc")}
            footer={
              <button
                type="button"
                onClick={() => navigate("/checkin/visitor")}
                className="mt-6 flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-card px-3 text-center text-[0.95rem] font-bold leading-snug text-primary transition-colors hover:bg-primary-tint active:bg-primary-tint focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary xl:gap-2.5 xl:px-4 xl:text-[1rem]"
              >
                <UserRoundSearch size={20} strokeWidth={2.2} aria-hidden="true" className="shrink-0" />
                <span className="min-w-0">
                  {notMyNameLead && <span className="block text-[0.78rem] font-semibold text-muted">{notMyNameLead}</span>}
                  <span className="block">{notMyNameAction}</span>
                </span>
              </button>
            }
          />
        </div>

        <p className="mt-2 hidden shrink-0 text-center text-[0.9rem] text-muted lg:block">{t("kioskFooterWelcome")}</p>
      </div>
    </div>
  );
}
