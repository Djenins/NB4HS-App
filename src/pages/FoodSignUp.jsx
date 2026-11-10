// FoodSignUp.jsx -- public sign-up for a food distribution, ahead of the
// day. No login: staff create the distribution in Food Distribution >
// Sign-in Forms and share its link or QR code (/food-signup/<event id>).
// The client gives their name, phone, address (with apartment/unit) and
// household size; the server matches them to their client record by name +
// phone and allows one sign-up per address. On the day, staff find them by
// name or phone and they sign for their food (FoodOnlineSignins.jsx).
//
// The Regular program's form also asks "Do you have SNAP?" and, only when
// the answer is no, "Do you want to apply for SNAP?". A yes is sent to the
// SNAP team as a follow-up (done by the server, see migration f2). The CDBG
// form doesn't ask. A distribution with a sign-up limit shows "full" once
// it's reached.
//
// Works on a client's own phone or one tablet passed around: after a
// sign-up the thank-you screen offers "Next person" and returns to an empty
// form by itself. Same visitor-facing frame as the registration page.
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Check, HandHeart, Home, MapPin, ShoppingBasket, TriangleAlert, UserRound } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { formTitle, formatFormDate, programAsksSnap } from "../lib/foodSignInForm.js";
import { cn } from "../lib/cn.js";
import { publicFoodEvent, publicFoodSignup } from "../lib/foodSigninData.js";
import KioskPageHeader from "../components/kiosk/KioskPageHeader.jsx";
import KioskResult, { RESULT_PRIMARY_BTN } from "../components/kiosk/KioskResult.jsx";
import ApptRequestCard from "../components/appointment/ApptRequestCard.jsx";
import { ApptField, ApptFieldError, ApptSelect } from "../components/appointment/ApptRequestField.jsx";
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

// A Yes / No question as two big touch buttons (a radio group).
function YesNo({ id, question, value, onChange, error }) {
  const t = useT();
  const errorId = error ? id + "-error" : undefined;
  return (
    <div id={id}>
      <p id={id + "-label"} className="appt-label m-0 mb-1.5 text-touch-label font-bold text-navy dark:text-[color:var(--text)]">
        {question}<span className="text-accent" aria-hidden="true"> *</span>
      </p>
      <div role="radiogroup" aria-labelledby={id + "-label"} aria-describedby={errorId} aria-required="true" className="grid grid-cols-2 gap-2 sm:max-w-sm">
        {["yes", "no"].map((v) => {
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(v)}
              className={cn(
                "flex min-h-[56px] items-center justify-center gap-2 rounded-touch border-2 px-3 text-touch-body font-bold transform-none transition-colors",
                on ? "border-primary bg-primary text-primary-foreground"
                  : cn("bg-card text-navy hover:border-primary dark:text-[color:var(--text)]", error ? "border-tone-danger-ink" : "border-border")
              )}
            >
              {on ? <Check size={20} strokeWidth={2.6} aria-hidden="true" /> : null}
              {t(v === "yes" ? "ffYes" : "ffNo")}
            </button>
          );
        })}
      </div>
      <ApptFieldError id={errorId}>{error}</ApptFieldError>
    </div>
  );
}

export default function FoodSignUp() {
  const { eventId } = useParams();
  const { lang, setLang, showToast } = useApp();
  const t = useT();
  const formRef = useRef(null);
  const [event, setEvent] = useState(undefined); // undefined loading, null not found
  // Errors hold i18n keys, not text, so they follow the language picker
  // if the client switches language after pressing Sign Up.
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(""); // "", "ok", "already"
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState({ info: true, snap: true, address: true });
  const [hasSnap, setHasSnap] = useState("");
  const [wantsSnap, setWantsSnap] = useState("");
  const [snapSent, setSnapSent] = useState(false);
  const asksSnap = !!event && programAsksSnap(event.program);
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
    setResult("");
    setErrors({});
    setSubmitError("");
    setHasSnap("");
    setWantsSnap("");
    setSnapSent(false);
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
      hasSnap: asksSnap ? hasSnap : "", wantsSnapHelp: asksSnap && hasSnap === "no" ? wantsSnap : "", lang,
    };
    const errMap = {};
    ["firstName", "lastName", "phone", "street"].forEach((f) => { if (!fields[f]) errMap[f] = "fieldRequired"; });
    if (fields.phone && !PHONE_RE.test(fields.phone)) errMap.phone = "registerPhoneInvalid";
    if (asksSnap && !hasSnap) errMap.hasSnap = "fsChooseOne";
    if (asksSnap && hasSnap === "no" && !wantsSnap) errMap.wantsSnap = "fsChooseOne";
    if (Object.keys(errMap).length) {
      setErrors(errMap);
      setSubmitError("");
      setOpen({ info: true, snap: true, address: true });
      showToast(t("fixErrors"));
      const first = ["firstName", "lastName", "phone", "hasSnap", "wantsSnap", "street"].find((f) => errMap[f]);
      const el = first === "hasSnap" || first === "wantsSnap"
        ? form.querySelector("#food-snap-" + first + " [role=radio]")
        : form.querySelector('[name="' + first + '"]');
      if (el) el.focus();
      return;
    }
    setErrors({});
    setSubmitError("");
    setBusy(true);
    try {
      const status = await publicFoodSignup(eventId, fields);
      if (status === "ok" || status === "already") {
        setSnapSent(status === "ok" && fields.wantsSnapHelp === "yes");
        setResult(status);
      } else if (status === "closed") setEvent(Object.assign({}, event, { isOpen: false }));
      else if (status === "full") setEvent(Object.assign({}, event, { isFull: true }));
      else if (status === "duplicate_address") {
        setErrors({ street: "fsDuplicateAddressShort" });
        setSubmitError("fsDuplicateAddress");
      }
    } catch (err) {
      console.warn("publicFoodSignup failed", err);
      setSubmitError("fsErrorDesc");
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
        {snapSent ? <p className="m-0">{t("fsSuccessSnap")}</p> : null}
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

        {!event.isOpen || event.isFull ? (
          <div className="mt-5"><Notice>{t(!event.isOpen ? "fsClosedDesc" : "fsFullDesc")}</Notice></div>
        ) : (
          <form key={formKey} ref={formRef} onSubmit={handleSubmit} noValidate className="appt-form mt-4 flex flex-col gap-4">
            <div className="[container-type:inline-size]">
              <div className="flex flex-col gap-4 [@container(min-width:46rem)]:grid [@container(min-width:46rem)]:grid-cols-2 [@container(min-width:46rem)]:items-start">
                <div className="flex flex-col gap-4">
                <ApptRequestCard id="food-signup-info" icon={UserRound} title={t("fsYourInfoTitle")} description={t("fsYourInfoDesc")} open={open.info} onToggle={() => toggle("info")}>
                  <div className="grid gap-x-4 gap-y-3">
                    <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 sm:gap-x-5">
                      <ApptField name="firstName" label={t("firstName")} required error={errors.firstName && t(errors.firstName)} autoComplete="given-name" />
                      <ApptField name="lastName" label={t("lastName")} required error={errors.lastName && t(errors.lastName)} autoComplete="family-name" />
                    </div>
                    <ApptField name="phone" type="tel" label={t("ffPhone")} required error={errors.phone && t(errors.phone)} autoComplete="tel" />
                    <ApptSelect name="householdSize" label={t("householdSizeLabel")} defaultValue="">
                      <option value="">{t("pleaseSelect")}</option>
                      {HOUSEHOLD_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </ApptSelect>
                  </div>
                </ApptRequestCard>

                {asksSnap ? (
                  <ApptRequestCard id="food-signup-snap" icon={HandHeart} title={t("fsSnapTitle")} description={t("fsSnapDesc")} open={open.snap} onToggle={() => toggle("snap")}>
                    <div className="grid gap-y-4">
                      <YesNo
                        id="food-snap-hasSnap"
                        question={t("ffSnapQ")}
                        value={hasSnap}
                        onChange={(v) => { setHasSnap(v); if (v === "yes") setWantsSnap(""); setErrors((e) => Object.assign({}, e, { hasSnap: "", wantsSnap: "" })); }}
                        error={errors.hasSnap && t(errors.hasSnap)}
                      />
                      {hasSnap === "no" ? (
                        <YesNo
                          id="food-snap-wantsSnap"
                          question={t("fsApplyQ")}
                          value={wantsSnap}
                          onChange={(v) => { setWantsSnap(v); setErrors((e) => Object.assign({}, e, { wantsSnap: "" })); }}
                          error={errors.wantsSnap && t(errors.wantsSnap)}
                        />
                      ) : null}
                      {hasSnap === "no" && wantsSnap === "yes" ? (
                        <p className="m-0 text-touch-label font-semibold text-muted">{t("fsApplyNote")}</p>
                      ) : null}
                    </div>
                  </ApptRequestCard>
                ) : null}
                </div>

                <div className="flex flex-col gap-4">
                  <ApptRequestCard id="food-signup-address" icon={Home} title={t("fsAddressTitle")} description={t("fsAddressDesc")} open={open.address} onToggle={() => toggle("address")}>
                    <div className="grid gap-x-4 gap-y-3">
                      <ApptField
                        name="street" label={t("address")} required error={errors.street && t(errors.street)} placeholder={t("streetAddressPlaceholder")}
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

                  {submitError ? <Notice>{t(submitError)}</Notice> : null}
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
