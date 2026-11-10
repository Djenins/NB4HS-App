// FoodSignIn.jsx -- the online version of the food distribution form
// (lib/foodSignInForm.js prints the paper one). Public, no login: staff
// create a sign-in event in Food Distribution > Sign-in Forms and share its
// link or QR code (/food-signin/<event id>). A client types their name,
// address and phone and signs with a finger; it lands on the staff list and
// on the printed filled sheet.
//
// Built for one tablet passed down a line as much as for a client's own
// phone: after a sign-in the thank-you screen offers "Next person" and goes
// back to an empty form by itself after a short pause. Same visitor-facing
// frame as the appointment request and registration pages.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, MapPin, PenLine, ShoppingBasket, TriangleAlert, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { formTitle, formatFormDate } from "../lib/foodSignInForm.js";
import { publicFoodEvent, publicFoodSignin } from "../lib/foodSigninData.js";
import KioskPageHeader from "../components/kiosk/KioskPageHeader.jsx";
import KioskResult, { RESULT_PRIMARY_BTN } from "../components/kiosk/KioskResult.jsx";
import ApptRequestCard from "../components/appointment/ApptRequestCard.jsx";
import { ApptField, ApptFieldError } from "../components/appointment/ApptRequestField.jsx";
import AppointmentSubmitButton from "../components/appointment/AppointmentSubmitButton.jsx";
import SignaturePad from "../components/SignaturePad.jsx";
import { Skeleton } from "../components/ui/skeleton.jsx";

const PHONE_RE = /^[0-9()\-\s.+]{7,20}$/;
const NEXT_PERSON_MS = 15000;

export default function FoodSignIn() {
  const { eventId } = useParams();
  const { lang, setLang, showToast } = useApp();
  const t = useT();
  const formRef = useRef(null);
  const padRef = useRef(null);
  const [event, setEvent] = useState(undefined); // undefined loading, null not found
  const [errors, setErrors] = useState({});
  const [hasInk, setHasInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState({ info: true, sign: true });
  const toggle = (k) => setOpen((prev) => Object.assign({}, prev, { [k]: !prev[k] }));

  useEffect(() => {
    let cancelled = false;
    publicFoodEvent(eventId)
      .then((ev) => {
        if (cancelled) return;
        setEvent(ev);
        // Open in the language staff chose for the form; the client can
        // still switch with the language picker.
        const first = ev && ev.lang ? ev.lang.split("+")[0] : "en";
        if (ev && first !== "en") setLang(first);
      })
      .catch(() => { if (!cancelled) setEvent(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function nextPerson() {
    setDone(false);
    setErrors({});
    setSubmitError("");
    setHasInk(false);
    setFormKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const street = val("street"), city = val("city"), zip = val("zip");
    const fields = {
      name: val("name"),
      address: [street, [city, zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      phone: val("phone"),
    };
    const errMap = {};
    if (!fields.name) errMap.name = t("fieldRequired");
    if (!street) errMap.street = t("fieldRequired");
    if (fields.phone && !PHONE_RE.test(fields.phone)) errMap.phone = t("registerPhoneInvalid");
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) errMap.signature = t("fsSignRequired");
    if (Object.keys(errMap).length) {
      setErrors(errMap);
      setSubmitError("");
      setOpen({ info: true, sign: true });
      showToast(t("fixErrors"));
      const first = ["name", "street", "phone"].find((f) => errMap[f]);
      const el = first && form.querySelector('[name="' + first + '"]');
      if (el) el.focus();
      return;
    }
    setErrors({});
    setSubmitError("");
    setBusy(true);
    try {
      await publicFoodSignin(eventId, Object.assign(fields, { signature: pad.toDataURL() }));
      setDone(true);
    } catch (err) {
      console.warn("publicFoodSignin failed", err);
      // Closed while they were filling it in.
      const closed = err && err.code === "P0002";
      if (closed) setEvent(Object.assign({}, event, { isOpen: false }));
      setSubmitError(t(closed ? "fsClosedDesc" : "fsErrorDesc"));
      showToast(t(closed ? "fsClosedDesc" : "fsErrorDesc"));
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
  if (done) {
    return (
      <KioskResult
        title={t("fsSuccessTitle")}
        returnAfterMs={NEXT_PERSON_MS}
        onReturn={nextPerson}
        actions={(
          <button type="button" onClick={nextPerson} className={RESULT_PRIMARY_BTN}>
            <UserRound size={22} strokeWidth={2.2} aria-hidden="true" />
            {t("fsNextPerson")}
          </button>
        )}
      >
        <p className="m-0">{t("fsSuccessDesc")}</p>
      </KioskResult>
    );
  }

  const title = formTitle(event.occasion, event.customOccasion, lang);
  const when = formatFormDate(event.date, lang);

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
          <p role="alert" className="m-0 mt-5 flex items-start gap-2.5 rounded-[14px] border border-accent-soft bg-accent-tint p-3.5 text-[0.98rem] font-semibold text-accent">
            <TriangleAlert size={20} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
            {t("fsClosedDesc")}
          </p>
        ) : (
          <form key={formKey} ref={formRef} onSubmit={handleSubmit} noValidate className="appt-form mt-4 flex flex-col gap-4">
            <div className="[container-type:inline-size]">
              <div className="flex flex-col gap-4 [@container(min-width:46rem)]:grid [@container(min-width:46rem)]:grid-cols-2 [@container(min-width:46rem)]:items-start">
                <ApptRequestCard id="food-signin-info" icon={UserRound} title={t("fsYourInfoTitle")} description={t("fsYourInfoDesc")} open={open.info} onToggle={() => toggle("info")}>
                  <div className="grid gap-x-4 gap-y-3">
                    <ApptField name="name" label={t("ffName")} required error={errors.name} autoComplete="name" />
                    <ApptField
                      name="street" label={t("address")} required error={errors.street} placeholder={t("streetAddressPlaceholder")}
                      onAddressSelect={(a) => {
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
                    <ApptField name="phone" type="tel" label={t("ffPhone")} error={errors.phone} autoComplete="tel" />
                  </div>
                </ApptRequestCard>

                <div className="flex flex-col gap-4">
                  <ApptRequestCard id="food-signin-sign" icon={PenLine} title={t("fsSignTitle")} description={t("ffAcknowledge")} open={open.sign} onToggle={() => toggle("sign")}>
                    <SignaturePad
                      ref={padRef}
                      label={t("fsSignTitle")}
                      placeholder={t("fsSignHere")}
                      onChange={(inked) => { setHasInk(inked); if (inked) setErrors((prev) => Object.assign({}, prev, { signature: "" })); }}
                    />
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <ApptFieldError id="food-signin-signature-error">{errors.signature}</ApptFieldError>
                      {hasInk ? (
                        <button type="button" onClick={() => padRef.current && padRef.current.clear()} className="ml-auto text-touch-label font-semibold text-primary underline-offset-2 hover:underline">
                          {t("fsClearSignature")}
                        </button>
                      ) : null}
                    </div>
                  </ApptRequestCard>

                  {submitError && (
                    <p role="alert" className="m-0 flex items-start gap-2.5 rounded-[14px] border border-accent-soft bg-accent-tint p-3.5 text-[0.98rem] font-semibold text-accent">
                      <TriangleAlert size={20} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
                      {submitError}
                    </p>
                  )}
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
