// CheckInVisitor.jsx -- the full visitor check-in form on the kiosk: one
// centred column with the title, a three-step progress bar (Visitor
// Information -> Address -> Visit Details) that jumps to each section and
// follows focus, the three section cards, and a bar pinned to the bottom
// with the help note and Submit. Date and time aren't asked for: the kiosk's
// top bar shows them and the record stamps its own on submit.
//
// Fields are uncontrolled and read via FormData on submit (except the
// service/staff selects, which need state for their "other, please specify"
// inputs). Validation messages render under each field, and Submit is
// disabled while the insert is in flight so a double-tap can't create two
// visits.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleHelp, ClipboardList, MapPin, UserRound, UserRoundCheck } from "lucide-react";
import { cn } from "../lib/cn.js";
import { useApp, useT } from "../context/AppContext.jsx";
import { activeServiceList, activeStaffList, todayStr, uid } from "../lib/utils.js";
import { createVisit } from "../lib/checkinData.js";
import SubmitCheckInButton from "../components/kiosk/SubmitCheckInButton.jsx";
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
    { id: "visitor", number: "1", icon: UserRound, title: t("sectionVisitorInfo"), description: t("sectionVisitorInfoDesc") },
    { id: "address", number: "2", icon: MapPin, title: t("sectionAddress"), description: t("sectionAddressDesc") },
    { id: "visit", number: "3", icon: ClipboardList, title: t("sectionVisitDetails"), description: t("kioskStepVisitDetailsDesc") }
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


  return (
    <div className="kiosk-checkin flex w-full flex-1 flex-col">
      {/* Back, clock and language live in the shared KioskTopBar (Shell.jsx). */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onFocus={handleFocusIn}
        noValidate
        className="mx-auto flex w-full max-w-3xl flex-col"
      >
        <header className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-14 sm:w-14">
            <UserRoundCheck strokeWidth={2} aria-hidden="true" className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-touch-title font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)]">{t("checkInFormTitle")}</h1>
            <p className="m-0 mt-1 text-touch-body leading-snug text-muted">{t("welcome") + "! " + t("checkInFormSubtitle")}</p>
          </div>
        </header>

        {/* Progress: tap a step to jump to it; focusing a field moves it. */}
        <nav aria-label={t("checkInFormTitle")} className="mt-6">
          <ol className="m-0 flex list-none items-center gap-2 p-0">
            {steps.map((step, i) => {
              const active = activeStep === step.id;
              const done = steps.findIndex((s) => s.id === activeStep) > i;
              return (
                <li key={step.id} className={cn("m-0 flex min-w-0 items-center gap-2", active ? "flex-[3] sm:flex-1" : "flex-1")}>
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    aria-current={active ? "step" : undefined}
                    aria-label={step.number + ". " + step.title}
                    className={cn(
                      "flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-touch border px-3 py-2 text-left transition-colors duration-fast",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      active ? "border-primary bg-primary-tint" : "border-border bg-card hover:border-line-strong"
                    )}
                  >
                    <span className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-touch-label font-bold tabular-nums",
                      active || done ? "bg-primary text-primary-foreground" : "bg-surface-sunken text-muted"
                    )}>{step.number}</span>
                    {/* On phones only the current step names itself; the others
                        show their number (the button keeps the full name). */}
                    <span className={cn("min-w-0 text-touch-label font-semibold leading-tight", active ? "text-primary" : "hidden text-card-foreground sm:inline")}>{step.title}</span>
                  </button>
                  {i < steps.length - 1 ? <span aria-hidden="true" className="hidden h-px w-4 shrink-0 bg-line-strong sm:block" /> : null}
                </li>
              );
            })}
          </ol>
        </nav>

        {/* A size container: the sections pick their columns from this
            column's width, not the window's. */}
        <div className="mt-5 flex flex-col gap-4 [container-type:inline-size]">
          <VisitorInformationSection id="kiosk-step-visitor" sectionRef={sectionRefs.visitor} t={t} errors={errors} />
          <AddressSection id="kiosk-step-address" sectionRef={sectionRefs.address} t={t} errors={errors} />
          <VisitDetailsSection
            id="kiosk-step-visit" sectionRef={sectionRefs.visit}
            t={t} lang={lang} errors={errors}
            services={services} staffList={staffList}
            service={service} onServiceChange={(e) => setService(e.target.value)}
            staff={staff} onStaffChange={(e) => setStaff(e.target.value)}
          />
        </div>

        {/* Pinned to the bottom of the screen so Submit is always in reach. */}
        <div className="sticky bottom-0 z-10 mt-5 -mx-3 flex flex-col gap-3 border-t border-border bg-background px-3 py-4 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-surface sm:border sm:bg-card sm:px-5 sm:shadow-raised">
          <p className="m-0 flex items-start gap-2.5 text-touch-label leading-snug text-muted">
            <CircleHelp aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span><span className="font-semibold text-card-foreground">{t("landingNeedHelp")}</span> {t("landingAskStaff")}</span>
          </p>
          <SubmitCheckInButton label={t("submit")} busy={busy} className="min-h-[64px] sm:w-auto sm:min-w-[18rem] xl:min-h-[64px]" />
        </div>
      </form>
    </div>
  );
}
