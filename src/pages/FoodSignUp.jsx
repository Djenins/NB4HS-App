// FoodSignUp.jsx -- public sign-up for a food distribution, ahead of the
// day. No login: staff create the distribution in Food Distribution >
// Sign-in Forms and share its link or QR code (/f/<short code>, or the
// original /food-signup/<event id>).
// The client gives their name, phone, address (with apartment/unit) and
// household size; the server matches them to their client record by name +
// phone and allows one sign-up per address. On the day, staff find them by
// name or phone and they sign for their food (FoodOnlineSignins.jsx).
//
// Works on a client's own phone or one tablet passed around: after a
// sign-up the thank-you screen offers "Next person" and returns to an empty
// form by itself. Same visitor-facing frame as the registration page.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Home, MapPin, ShoppingBasket, TriangleAlert, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { formTitle, formatFormDate } from "../lib/foodSignInForm.js";
import { publicFoodEvent, publicFoodEventByCode, publicFoodSignup } from "../lib/foodSigninData.js";
import KioskPageHeader from "../components/kiosk/KioskPageHeader.jsx";
import KioskResult, { RESULT_PRIMARY_BTN } from "../components/kiosk/KioskResult.jsx";
import ApptRequestCard from "../components/appointment/ApptRequestCard.jsx";
import { ApptField, ApptSelect } from "../components/appointment/ApptRequestField.jsx";
import AppointmentSubmitButton from "../components/appointment/AppointmentSubmitButton.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";

const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const HOUSEHOLD_SIZES = ["1", "2", "3", "4", "5", "6+"];
const NEXT_PERSON_MS = 20000;

function Notice({ children }) {
  return (
    <p role="alert" className="m-0 flex items-start gap-2.5 rounded-[14px] border border-accent-soft bg-accent-tint p-3.5 text-[0.98rem] font-semibold text-accent">
      <TriangleAlert size={20} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default function FoodSignUp() {
  const { eventId: idParam, code } = useParams();
  const { lang, setLang, showToast } = useApp();
  const t = useT();
  const formRef = useRef(null);
  const [event, setEvent] = useState(undefined); // undefined loading, null not found
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(""); // "", "ok", "already"
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState({ info: true, address: true });
  const toggle = (k) => setOpen((prev) => Object.assign({}, prev, { [k]: !prev[k] }));

  useEffect(() => {
    let cancelled = false;
    (code ? publicFoodEventByCode(code) : publicFoodEvent(idParam))
      .then((ev) => {
        if (cancelled) return;
        setEvent(ev && Object.assign({}, ev, { id: ev.id || idParam }));
        // Open in the language staff chose for the form; the client can
        // still switch with the language picker.
        const first = ev && ev.lang ? ev.lang.split("+")[0] : "en";
        if (ev && first !== "en") setLang(first);
      })
      .catch(() => { if (!cancelled) setEvent(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam, code]);

  function nextPerson() {
    setResult("");
    setErrors({});
    setSubmitError("");
    setFormKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const fields = {
      firstName: val("firstName"), lastName: val("lastName"), phone: val("phone"),
      street: val("street"), unit: val("unit"), city: val("city"), zip: val("zip"), householdSize: val("householdSize"),
    };
    const errMap = {};
    ["firstName", "lastName", "phone", "street"].forEach((f) => { if (!fields[f]) errMap[f] = t("fieldRequired"); });
    if (fields.phone && !PHONE_RE.test(fields.phone)) errMap.phone = t("registerPhoneInvalid");
    if (Object.keys(errMap).length) {
      setErrors(errMap);
      setSubmitError("");
      setOpen({ info: true, address: true });
      showToast(t("fixErrors"));
      const first = ["firstName", "lastName", "phone", "street"].find((f) => errMap[f]);
      const el = form.querySelector('[name="' + first + '"]');
      if (el) el.focus();
      return;
    }
    setErrors({});
    setSubmitError("");
    setBusy(true);
    try {
      const status = await publicFoodSignup(event.id, fields);
      if (status === "ok" || status === "already") setResult(status);
      else if (status === "closed") setEvent(Object.assign({}, event, { isOpen: false }));
      else if (status === "duplicate_address") {
        setErrors({ street: t("fsDuplicateAddressShort") });
        setSubmitError(t("fsDuplicateAddress"));
      }
    } catch (err) {
      console.warn("publicFoodSignup failed", err);
      setSubmitError(t("fsErrorDesc"));
      showToast(t("fsErrorDesc"));
    } finally {
      setBusy(false);
    }
  }

  if (event === undefined) {
    return (
      <div className="appt-request mx-auto w-full max-w-[900px] space-y-4 p-4" aria-busy="true">
        <span className="sr-only">{t("fsLoading")}</span>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (event === null) {
    return <KioskResult title={t("fsNotFoundTitle")}><p className="m-0">{t("fsNotFoundDesc")}</p></KioskResult>;
  }

  const title = formTitle(event.occasion, event.customOccasion, lang);
  const when = formatFormDate(event.date, lang);

  if (result) {
    return (
      <KioskResult
        title={t(result === "already" ? "fsAlreadyTitle" : "fsSuccessTitle")}
        returnAfterMs={NEXT_PERSON_MS}
        onReturn={nextPerson}
        actions={(
          <button type="button" onClick={nextPerson} className={RESULT_PRIMARY_BTN}>
            <UserRound size={22} strokeWidth={2.2} aria-hidden="true" />
            {t("fsNextPerson")}
          </button>
        )}
      >
        <p className="m-0">{title}{when ? " · " + when : ""}{event.location ? " · " + event.location : ""}</p>
        <p className="m-0">{t("fsSuccessDesc")}</p>
      </KioskResult>
    );
  }

  return (
    <div className="appt-request flex w-full flex-1 flex-col">
      <div className="appt-frame mx-auto flex w-full max-w-[1100px] flex-col rounded-[22px] sm:border sm:border-border sm:bg-card sm:p-5 sm:shadow-card">
        <KioskPageHeader icon={ShoppingBasket} title={title} description={t("fsPageDesc")} />
        {(when || event.location) ? (
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-touch-label font-semibold text-muted">
            {when ? <span className="inline-flex items-center gap-1.5"><CalendarDays size={18} aria-hidden="true" />{when}</span> : null}
            {event.location ? <span className="inline-flex items-center gap-1.5"><MapPin size={18} aria-hidden="true" />{event.location}</span> : null}
          </div>
        ) : null}

        {!event.isOpen ? (
          <div className="mt-5"><Notice>{t("fsClosedDesc")}</Notice></div>
        ) : (
          <form key={formKey} ref={formRef} onSubmit={handleSubmit} noValidate className="appt-form mt-4 flex flex-col gap-4">
            <div className="[container-type:inline-size]">
              <div className="flex flex-col gap-4 [@container(min-width:46rem)]:grid [@container(min-width:46rem)]:grid-cols-2 [@container(min-width:46rem)]:items-start">
                <ApptRequestCard id="food-signup-info" icon={UserRound} title={t("fsYourInfoTitle")} description={t("fsYourInfoDesc")} open={open.info} onToggle={() => toggle("info")}>
                  <div className="grid gap-x-4 gap-y-3">
                    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-5">
                      <ApptField name="firstName" label={t("firstName")} required error={errors.firstName} autoComplete="given-name" />
                      <ApptField name="lastName" label={t("lastName")} required error={errors.lastName} autoComplete="family-name" />
                    </div>
                    <ApptField name="phone" type="tel" label={t("ffPhone")} required error={errors.phone} autoComplete="tel" />
                    <ApptSelect name="householdSize" label={t("householdSizeLabel")} defaultValue="">
                      <option value="">{t("pleaseSelect")}</option>
                      {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </ApptSelect>
                  </div>
                </ApptRequestCard>

                <div className="flex flex-col gap-4">
                  <ApptRequestCard id="food-signup-address" icon={Home} title={t("fsAddressTitle")} description={t("fsAddressDesc")} open={open.address} onToggle={() => toggle("address")}>
                    <div className="grid gap-x-4 gap-y-3">
                      <ApptField
                        name="street" label={t("address")} required error={errors.street} placeholder={t("streetAddressPlaceholder")}
                        onAddressSelect={(a) => {
                          const form = formRef.current;
                          if (!form) return;
                          if (a.city) form.elements.namedItem("city").value = a.city;
                          if (a.zip) form.elements.namedItem("zip").value = a.zip;
                        }}
                      />
                      <ApptField name="unit" label={t("fsUnitLabel")} placeholder={t("fsUnitPlaceholder")} autoComplete="address-line2" />
                      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-5">
                        <ApptField name="city" label={t("city")} autoComplete="address-level2" placeholder={t("phCity")} />
                        <ApptField name="zip" label={t("zip")} autoComplete="postal-code" placeholder={t("phZip")} />
                      </div>
                    </div>
                  </ApptRequestCard>

                  {submitError ? <Notice>{submitError}</Notice> : null}
                  <AppointmentSubmitButton label={t("fsSubmit")} busyLabel={t("fsSubmitting")} busy={busy} />
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
