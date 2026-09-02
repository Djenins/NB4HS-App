// ApptRequest.jsx -- client-facing "request an appointment" form (no login
// required, reached from the Login page or the kiosk). Originally ported from
// checkin_checkout.js's renderApptRequest()/attachApptRequestHandlers().
//
// This pass redesigns the page as the third screen of the visitor-facing
// NB4HS system the check-in kiosk (CheckInVisitor.jsx) and the appointment
// lookup (AppointmentLookup.jsx) already belong to: one white frame with the
// brand logo at the top, two side-by-side cards on a landscape front-desk
// touchscreen, and a single stacked column of accordions on a phone -- one
// component tree, not a second mobile form.
//
// The appointment system underneath is untouched. Fields are still
// uncontrolled and read off form.elements at submit time, "Meet With" is
// still fed by the live staff_directory, "Meeting With" still only appears
// while no specific person is chosen, the same five fields are required, the
// record handed to createAppointment() is byte-for-byte the same shape, and
// success still lands on /appointments/request/success.
//
// Two behavioural additions ride along, both required by the kiosk brief:
// the validation results that already drove the toast and red borders now
// also print a message under the offending field, and submission is guarded
// by a busy flag -- Submit is disabled while the insert is in flight, and a
// failed insert now surfaces an error with every entered value still in place
// instead of rejecting unhandled and leaving the visitor on a dead form.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, TriangleAlert } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { createAppointment, fetchStaffDirectory } from "../lib/clientsData.js";
import AppointmentRequestHeader from "../components/appointment/AppointmentRequestHeader.jsx";
import YourInformationSection from "../components/appointment/YourInformationSection.jsx";
import AppointmentDetailsSection from "../components/appointment/AppointmentDetailsSection.jsx";
import WhatHappensNext from "../components/appointment/WhatHappensNext.jsx";
import AppointmentSubmitButton from "../components/appointment/AppointmentSubmitButton.jsx";

// The five fields the form has always required. Order matters: it decides
// which field gets focused when more than one is empty.
const REQUIRED_FIELDS = ["firstName", "lastName", "phone", "date", "time"];

export default function ApptRequest() {
  const { setKiosk, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  // Field name -> message shown under that field. The old string[] only drove
  // red borders; the map carries the reason as well.
  const [errors, setErrors] = useState({});
  const [staffList, setStaffList] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Mobile-only accordion state (the kiosk columns are always expanded). Both
  // start open so the form is never hidden behind a tap.
  const [openSections, setOpenSections] = useState({ info: true, details: true, next: true });

  useEffect(() => { fetchStaffDirectory().then(setStaffList); }, []);

  function toggleSection(key) {
    setOpenSections((prev) => Object.assign({}, prev, { [key]: !prev[key] }));
  }

  // Preferred Date is the app-wide DatePicker: its value lives in a hidden
  // input, so focusing the field means focusing the trigger button instead.
  function focusField(form, name) {
    const el = form.querySelector('[name="' + name + '"]');
    if (el && el.type !== "hidden" && typeof el.focus === "function") { el.focus(); return; }
    const trigger = form.querySelector("#appt-req-" + name);
    if (trigger) trigger.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // Guards a double-tap on the touchscreen: the second tap lands while the
    // first insert is still in flight and would otherwise file a duplicate.
    if (busy) return;

    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const picked = staffList.find((s) => s.id === staffId);

    const fields = {
      firstName: val("firstName"), lastName: val("lastName"), phone: val("phone"), email: val("email"),
      date: val("date"), time: val("time"), reason: val("reason"),
      assignedEmail: picked ? picked.email : "", meetingWith: picked ? picked.role : (val("meetingWith") || "case_manager")
    };
    const missing = REQUIRED_FIELDS.filter((f) => !fields[f]);
    if (missing.length) {
      const errMap = {};
      missing.forEach((f) => { errMap[f] = t("fieldRequired"); });
      setErrors(errMap);
      setSubmitError("");
      showToast(t("fixErrors"));
      // A collapsed accordion on a phone can be hiding the offending field,
      // so open everything before trying to put the cursor in it.
      setOpenSections({ info: true, details: true, next: true });
      focusField(form, missing[0]);
      return;
    }
    setErrors({});
    setSubmitError("");

    setBusy(true);
    try {
      await createAppointment(Object.assign({}, fields, { source: "client" }));
      navigate("/appointments/request/success");
    } catch (err) {
      // Nothing is cleared: the visitor keeps everything they typed and can
      // simply tap Submit again.
      console.warn("createAppointment failed", err);
      setSubmitError(t("apptRequestErrorDesc"));
      showToast(t("apptRequestErrorDesc"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="appt-request flex w-full flex-1 flex-col">
      <div className="appt-frame mx-auto flex w-full max-w-[1500px] flex-col rounded-[22px] border border-border bg-card p-4 shadow-card sm:p-6">
        <AppointmentRequestHeader
          icon={CalendarCheck}
          title={t("requestApptTitle")}
          description={t("requestApptDesc")}
          backLabel={t("back")}
          onBack={() => { setKiosk(false); navigate("/"); }}
        />

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="appt-form mt-5 flex flex-col gap-4">
          {/* Landscape kiosk: the two cards share the width instead of
              stacking, which is what keeps the whole form inside one
              1366x768 viewport. Below lg they stack into one column. */}
          <div className="appt-cards grid items-stretch gap-4 lg:grid-cols-2 lg:gap-5">
            <YourInformationSection
              t={t}
              errors={errors}
              open={openSections.info}
              onToggle={() => toggleSection("info")}
            />
            <AppointmentDetailsSection
              t={t}
              errors={errors}
              staffList={staffList}
              staffId={staffId}
              onStaffChange={(e) => setStaffId(e.target.value)}
              open={openSections.details}
              onToggle={() => toggleSection("details")}
            />
          </div>

          <WhatHappensNext
            title={t("apptWhatsNextTitle")}
            text={t("apptWhatsNextDesc")}
            open={openSections.next}
            onToggle={() => toggleSection("next")}
          />

          {submitError && (
            <p
              role="alert"
              className="m-0 flex items-start gap-2.5 rounded-[14px] border border-accent-soft bg-accent-tint p-3.5 text-[0.98rem] font-semibold text-accent"
            >
              <TriangleAlert size={20} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
              {submitError}
            </p>
          )}

          <AppointmentSubmitButton
            label={t("submitApptRequestBtn")}
            busyLabel={t("apptRequestSubmitting")}
            busy={busy}
          />
        </form>
      </div>
    </div>
  );
}
