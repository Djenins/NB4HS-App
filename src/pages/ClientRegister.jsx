// ClientRegister.jsx -- public "New client registration" form: a new client
// signs themself up for Case Management, no login required. Reached from a
// link / QR code on the client's own phone (/register) or from the
// "New client" button on the check-in kiosk (CheckIn.jsx).
//
// Same visitor-facing family as ApptRequest.jsx -- same header, cards,
// touch-scale fields and submit button -- and the same short field set as
// Case Management's "Add a Client" form. It submits through
// publicRegisterCaseClient() (a security-definer function that only
// inserts), and the record arrives on Case Management > Clients marked
// "Needs intake" so a case manager completes the full intake with them. On
// the kiosk it also checks them in for today as a Case Management visitor.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cake, MapPin, TriangleAlert, UserPlus } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { CASE_SERVICES, IMMIGRATION_STATUSES } from "../lib/constants.js";
import { caseServiceLabel, immigrationStatusLabel } from "../lib/clients.js";
import { publicRegisterCaseClient } from "../lib/clientsData.js";
import { cn } from "../lib/cn.js";
import { todayStr } from "../lib/utils.js";
import KioskPageHeader from "../components/kiosk/KioskPageHeader.jsx";
import ApptRequestCard from "../components/appointment/ApptRequestCard.jsx";
import { ApptField, ApptSelect } from "../components/appointment/ApptRequestField.jsx";
import AppointmentSubmitButton from "../components/appointment/AppointmentSubmitButton.jsx";
import WhatHappensNext from "../components/appointment/WhatHappensNext.jsx";
import YourInformationSection from "../components/appointment/YourInformationSection.jsx";

// Phone is required here (unlike staff's form): it's how the case manager
// reaches the client to book the intake.
const REQUIRED_FIELDS = ["firstName", "lastName", "phone"];
const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function ClientRegister() {
  const { kiosk, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [services, setServices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [openSections, setOpenSections] = useState({ info: true, more: true, next: true });

  function toggleSection(key) {
    setOpenSections((prev) => Object.assign({}, prev, { [key]: !prev[key] }));
  }
  function toggleService(key) {
    setServices((prev) => (prev.indexOf(key) !== -1 ? prev.filter((k) => k !== key) : prev.concat([key])));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;

    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const fields = {
      firstName: val("firstName"), lastName: val("lastName"), phone: val("phone"), email: val("email"),
      dob: val("dob"), street: val("street"), city: val("city"), zip: val("zip"),
      immigrationStatus: val("immigrationStatus"), services,
      // The page's language is the client's pick (the top bar's language
      // picker sets it), so it doubles as their preferred language.
      preferredLanguage: lang,
      // At the front-desk kiosk, registering also checks them in for today,
      // so they're in the visitor log and can check out like any visitor.
      // Same local date / ISO time the visitor check-in form sends.
      checkIn: kiosk, visitDate: todayStr(), timeIn: new Date().toISOString()
    };

    const errMap = {};
    REQUIRED_FIELDS.forEach((f) => { if (!fields[f]) errMap[f] = t("fieldRequired"); });
    if (fields.phone && !PHONE_RE.test(fields.phone)) errMap.phone = t("registerPhoneInvalid");
    if (fields.email && !EMAIL_RE.test(fields.email)) errMap.email = t("registerEmailInvalid");
    if (fields.dob && fields.dob > todayStr()) errMap.dob = t("registerDobInvalid");
    if (Object.keys(errMap).length) {
      setErrors(errMap);
      setSubmitError("");
      showToast(t("fixErrors"));
      setOpenSections({ info: true, more: true, next: true });
      const first = ["firstName", "lastName", "phone", "email", "dob"].find((f) => errMap[f]);
      const el = form.querySelector('[name="' + first + '"]');
      if (el) el.focus();
      return;
    }
    setErrors({});
    setSubmitError("");

    setBusy(true);
    try {
      await publicRegisterCaseClient(fields);
      navigate("/register/success", { replace: true, state: { checkedIn: kiosk } });
    } catch (err) {
      // Everything the visitor typed stays in place so they can retry.
      console.warn("publicRegisterCaseClient failed", err);
      setSubmitError(t("registerErrorDesc"));
      showToast(t("registerErrorDesc"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="appt-request flex w-full flex-1 flex-col">
      <div className="appt-frame mx-auto flex w-full max-w-[1500px] flex-col rounded-[22px] sm:border sm:border-border sm:bg-card sm:p-6 sm:shadow-card">
        <KioskPageHeader
          icon={UserPlus}
          title={t("registerTitle")}
          description={t("registerDesc")}
        />

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="appt-form mt-5 flex flex-col gap-4">
          <div className="appt-cards grid items-stretch gap-4 lg:grid-cols-2 lg:gap-5">
            <div className="flex flex-col gap-4">
              <YourInformationSection t={t} errors={errors} open={openSections.info} onToggle={() => toggleSection("info")} description={t("registerYourInfoDesc")} />
              <ApptRequestCard
                id="register-about"
                icon={Cake}
                title={t("registerAboutTitle")}
                description={t("registerAboutDesc")}
                open={openSections.info}
                onToggle={() => toggleSection("info")}
              >
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4">
                  <ApptField name="dob" label={t("dobLabel")} type="date" error={errors.dob} autoComplete="bday" />
                  <ApptSelect name="immigrationStatus" label={t("immigrationStatusLabel")} defaultValue="">
                    <option value="">{t("pleaseSelect")}</option>
                    {IMMIGRATION_STATUSES.map((s) => <option key={s.key} value={s.key}>{immigrationStatusLabel(s.key, lang)}</option>)}
                  </ApptSelect>
                </div>
              </ApptRequestCard>
            </div>

            <ApptRequestCard
              id="register-more"
              icon={MapPin}
              title={t("registerAddressServicesTitle")}
              description={t("registerAddressServicesDesc")}
              open={openSections.more}
              onToggle={() => toggleSection("more")}
            >
              <div className="grid gap-x-4 gap-y-3 sm:gap-y-4">
                <ApptField
                  name="street" label={t("address")} icon={MapPin} placeholder={t("streetAddressPlaceholder")}
                  onAddressSelect={(a) => {
                    // Uncontrolled form: write the picked city / ZIP straight in.
                    const form = formRef.current;
                    if (!form) return;
                    if (a.city) form.elements.namedItem("city").value = a.city;
                    if (a.zip) form.elements.namedItem("zip").value = a.zip;
                  }}
                />
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-5">
                  <ApptField name="city" label={t("city")} autoComplete="address-level2" placeholder={t("phCity")} />
                  <ApptField name="zip" label={t("zip")} autoComplete="postal-code" placeholder={t("phZip")} />
                </div>
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="appt-label mb-2 block p-0 text-[0.95rem] font-bold text-navy dark:text-[color:var(--text)]">
                    {t("registerServicesLabel")}
                  </legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CASE_SERVICES.map((s) => {
                      const on = services.indexOf(s.key) !== -1;
                      return (
                        <label
                          key={s.key}
                          className={cn(
                            "flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[14px] border px-4 text-[1rem] font-semibold transition-colors",
                            on ? "border-primary bg-primary-tint text-primary" : "border-border bg-card text-card-foreground hover:border-primary"
                          )}
                        >
                          <input type="checkbox" checked={on} onChange={() => toggleService(s.key)} className="h-5 w-5 shrink-0" />
                          {caseServiceLabel(s.key, lang)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </ApptRequestCard>
          </div>

          <WhatHappensNext
            title={t("apptWhatsNextTitle")}
            text={t("registerWhatsNextDesc")}
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

          <AppointmentSubmitButton label={t("registerSubmitBtn")} busyLabel={t("registerSubmitting")} busy={busy} />
        </form>
      </div>
    </div>
  );
}
