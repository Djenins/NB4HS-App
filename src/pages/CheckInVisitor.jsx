// CheckInVisitor.jsx -- the full visitor check-in form, laid out as a
// landscape self-service kiosk (sidebar | form | action panel) instead of
// the old single 640px column. This pass is UI only: fields are still
// uncontrolled and read via FormData on submit (except the service/staff
// selects, which need state to toggle their "other, please specify"
// inputs), the validation rules, the record shape handed to createVisit(),
// and the navigate-to-/checkin/success flow are all unchanged. The one
// behavioural addition is cosmetic-adjacent: the same validation results
// that already drove the toast + red borders now also render a message
// under each offending field, and Submit is disabled while the insert is
// in flight so a double-tap can't create two visits.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, ClipboardList, Clock, MapPin, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeServiceList, activeStaffList, fmtDateLong, fmtTime, todayStr, uid } from "../lib/utils.js";
import { createVisit } from "../lib/checkinData.js";
import KioskSidebar from "../components/kiosk/KioskSidebar.jsx";
import KioskActionPanel from "../components/kiosk/KioskActionPanel.jsx";
import VisitorInformationSection from "../components/kiosk/VisitorInformationSection.jsx";
import AddressSection from "../components/kiosk/AddressSection.jsx";
import VisitDetailsSection from "../components/kiosk/VisitDetailsSection.jsx";

export default function CheckInVisitor() {
  const { data, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [service, setService] = useState("");
  const [staff, setStaff] = useState("");
  // Field name -> i18n key of the message shown under that field. Same set
  // of names the old string[] carried, so the red-border/focus behaviour is
  // unchanged; the value just says *why* the field failed.
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [activeStep, setActiveStep] = useState("visitor");

  const services = activeServiceList(data.customServices, data.disabledServices);
  const staffList = activeStaffList(data.customStaff, data.disabledStaff);

  const sectionRefs = {
    visitor: useRef(null),
    address: useRef(null),
    visit: useRef(null)
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const form = formRef.current;
    const fd = new FormData(form);
    const v = {};
    fd.forEach((val, key) => { v[key] = (val || "").toString().trim(); });

    // errs keeps the original first-seen ordering (it drives which field
    // gets focused); errMap carries the message for that same field.
    const errs = [];
    const errMap = {};
    const addErr = (field, msgKey) => {
      if (errMap[field]) return;
      errs.push(field);
      errMap[field] = t(msgKey);
    };

    ["firstName", "lastName", "phone", "address", "city", "zip"].forEach((f) => { if (!v[f]) addErr(f, "fieldRequired"); });
    if (!v.service) addErr("service", "fieldRequired");
    if (v.service === "other" && !v.serviceOther) addErr("serviceOther", "fieldRequired");
    if (!v.staff) addErr("staff", "fieldRequired");
    if (v.staff === "other" && !v.staffOther) addErr("staffOther", "fieldRequired");
    if (v.phone && !/^[0-9()\-\s.+]{7,20}$/.test(v.phone)) addErr("phone", "invalidPhone");
    if (v.zip && !/^\d{5}(-\d{4})?$/.test(v.zip)) addErr("zip", "invalidZip");
    if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) addErr("email", "invalidEmail");

    if (errs.length) {
      setErrors(errMap);
      showToast(t("fixErrors"));
      const firstEl = form.querySelector('[name="' + errs[0] + '"]');
      if (firstEl) firstEl.focus();
      return;
    }
    setErrors({});

    const now = new Date();
    const record = {
      id: uid(), firstName: v.firstName, lastName: v.lastName, phone: v.phone, email: v.email || "",
      address: v.address, city: v.city, state: v.state || "RI", zip: v.zip,
      service: v.service, serviceOther: v.serviceOther || "",
      staff: v.staff, staffOther: v.staffOther || "",
      notes: v.notes || "", date: todayStr(), timeIn: now.toISOString(), timeOut: null
    };
    setBusy(true);
    try {
      const created = await createVisit(record);
      navigate("/checkin/success", { state: { lastCheckInId: created.id, kind: "visitor" } });
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { id: "visitor", number: "01", icon: UserRound, title: t("sectionVisitorInfo"), description: t("sectionVisitorInfoDesc") },
    { id: "address", number: "02", icon: MapPin, title: t("sectionAddress"), description: t("sectionAddressDesc") },
    { id: "visit", number: "03", icon: ClipboardList, title: t("sectionVisitDetails"), description: t("kioskStepVisitDetailsDesc") }
  ];

  // Step cards double as anchor navigation; focusing any control inside a
  // section makes that section's card the active one.
  function goToStep(id) {
    setActiveStep(id);
    const el = sectionRefs[id].current;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function handleFocusIn(e) {
    const match = steps.find((s) => {
      const el = sectionRefs[s.id].current;
      return el && el.contains(e.target);
    });
    if (match && match.id !== activeStep) setActiveStep(match.id);
  }

  const dateValue = fmtDateLong(todayStr(), lang);
  const timeValue = fmtTime(new Date().toISOString());

  return (
    <div className="kiosk-checkin flex min-h-0 w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1680px] min-h-0 flex-1 flex-col rounded-[22px] border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/checkin")}
            className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-border bg-card px-5 text-[1.02rem] font-bold text-navy dark:text-[color:var(--text)] transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
            {t("back")}
          </button>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-2.5 text-[0.98rem] font-semibold text-navy dark:text-[color:var(--text)]">
            <span className="flex items-center gap-2">
              <Clock size={18} strokeWidth={2} aria-hidden="true" className="text-primary" />
              {timeValue}
            </span>
            <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden items-center gap-2 sm:flex">
              <Calendar size={18} strokeWidth={2} aria-hidden="true" className="text-primary" />
              {dateValue}
            </span>
          </div>
        </div>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onFocus={handleFocusIn}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(210px,19%)_minmax(0,1fr)_minmax(240px,20%)] lg:grid-rows-[minmax(0,1fr)] lg:gap-5 xl:gap-6"
        >
          <KioskSidebar
            title={t("checkInFormTitle")}
            subtitle={t("welcome") + "! " + t("checkInFormSubtitle")}
            steps={steps}
            activeStep={activeStep}
            onStepSelect={goToStep}
            helpTitle={t("landingNeedHelp")}
            helpText={t("landingAskStaff")}
          />

          <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1.5">
            <VisitorInformationSection
              id="kiosk-step-visitor" sectionRef={sectionRefs.visitor}
              t={t} errors={errors} dateValue={dateValue} timeValue={timeValue}
            />
            <AddressSection id="kiosk-step-address" sectionRef={sectionRefs.address} t={t} errors={errors} />
            <VisitDetailsSection
              id="kiosk-step-visit" sectionRef={sectionRefs.visit}
              t={t} lang={lang} errors={errors}
              services={services} staffList={staffList}
              service={service} onServiceChange={(e) => setService(e.target.value)}
              staff={staff} onStaffChange={(e) => setStaff(e.target.value)}
            />
          </div>

          <KioskActionPanel
            title={t("thankYou")}
            description={t("thankYouDesc")}
            submitLabel={t("submit")}
            busy={busy}
          />
        </form>

        <p className="mt-2 hidden shrink-0 text-center text-[0.9rem] text-muted lg:block">{t("kioskFooterWelcome")}</p>
      </div>
    </div>
  );
}
