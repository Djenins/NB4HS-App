// CheckInVisitor.jsx -- the full visitor check-in form on the kiosk, laid
// out to fit one screen with no scrolling: a title row, then three columns --
// Visitor Information | Address | Visit Details with the help note and
// Submit (two columns on narrower screens). Date and time aren't asked for: the kiosk's top
// bar shows them and the record stamps its own on submit. Phones are too
// short for all of it and stack the cards in one scrolling column.
//
// Fields are uncontrolled and read via FormData on submit (except the
// service/staff selects, which need state for their "other, please specify"
// inputs). Validation messages render under each field, and Submit is
// disabled while the insert is in flight so a double-tap can't create two
// visits.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleHelp, UserRoundCheck } from "lucide-react";
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

  const services = activeServiceList(data.customServices, data.disabledServices);
  const staffList = activeStaffList(data.customStaff, data.disabledStaff);

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

  return (
    // Where Shell fixes <main> to the window (main--kiosk-form), the layout
    // is sized to fit it; overflow-y-auto is only a safety net for a screen
    // shorter than the kiosk it was designed for.
    <div className="kiosk-checkin flex w-full flex-1 flex-col [@media(min-width:1024px)_and_(min-height:620px)]:min-h-0 [@media(min-width:1024px)_and_(min-height:620px)]:overflow-y-auto">
      {/* Back, clock and language live in the shared KioskTopBar (Shell.jsx). */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        noValidate
        className="mx-auto flex w-full max-w-6xl flex-col gap-4"
      >
        <header className="flex items-center gap-3 lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
          {/* Arrives like KioskPageHeader: badge, title, then the line under it. */}
          <span className="k-pop flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <UserRoundCheck strokeWidth={2} aria-hidden="true" className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 style={{ "--d": ".06s" }} className="k-reveal m-0 text-touch-heading font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:text-touch-title">{t("checkInFormTitle")}</h1>
            <p style={{ "--d": ".16s" }} className="k-enter m-0 text-touch-label leading-snug text-muted">{t("welcome") + "! " + t("checkInFormSubtitle")}</p>
          </div>
          </div>
          {/* On wide screens the help note sits up here, so the Visit Details
              column only has to hold Submit; phones show it by Submit. */}
          <div style={{ "--d": ".44s" }} className="k-enter hidden shrink-0 rounded-touch border border-border bg-card px-4 py-3 shadow-card lg:block">
            <p className="m-0 flex items-start gap-2.5 text-touch-label leading-snug text-muted">
            <CircleHelp aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span><span className="font-semibold text-card-foreground">{t("landingNeedHelp")}</span> {t("landingAskStaff")}</span>
          </p>
          </div>
        </header>

        {/* Three columns when the form is wide enough (Visitor | Address |
            Visit Details + Submit), two on narrower screens, and a plain
            stack on phones (a grid would trap the sticky Submit bar in its
            own row).
            The outer div is the size container the grid reads; each column
            is one too, so its fields pick their own layout. */}
        <div className="[container-type:inline-size]">
          <div className="flex flex-col gap-4 [@container(min-width:40rem)]:grid [@container(min-width:40rem)]:grid-cols-2 [@container(min-width:40rem)]:items-start [@container(min-width:50rem)]:grid-cols-3">
            <div className="[container-type:inline-size]">
              <VisitorInformationSection id="kiosk-step-visitor" t={t} errors={errors} />
            </div>
            <div className="[container-type:inline-size]">
              <AddressSection id="kiosk-step-address" t={t} errors={errors} />
            </div>
            {/* "contents" on phones: the column's box disappears so the Submit
                bar's sticky edge is the whole form, not just this column. */}
            <div className="contents lg:flex lg:flex-col lg:gap-4 lg:[container-type:inline-size]">
              <VisitDetailsSection
                id="kiosk-step-visit"
                t={t} lang={lang} errors={errors}
                services={services} staffList={staffList}
                service={service} onServiceChange={(e) => setService(e.target.value)}
                staff={staff} onStaffChange={(e) => setStaff(e.target.value)}
              />
              {/* On phones this bar is pinned to the bottom of the screen so
                  Submit stays in reach while the cards scroll; on wide
                  screens it's just the button under Visit Details. It
                  rises in last, once the form it submits is in place. */}
              <div style={{ "--d": ".44s" }} className="k-enter sticky bottom-0 z-10 -mx-3 flex flex-col gap-3 border-t border-border bg-background px-3 py-3 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
                <div className="lg:hidden">
                  <p className="m-0 flex items-start gap-2.5 text-touch-label leading-snug text-muted">
                    <CircleHelp aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span><span className="font-semibold text-card-foreground">{t("landingNeedHelp")}</span> {t("landingAskStaff")}</span>
                  </p>
                </div>
                <SubmitCheckInButton label={t("submit")} busy={busy} className="min-h-[60px] xl:min-h-[64px]" />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
