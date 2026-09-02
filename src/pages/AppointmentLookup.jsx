// AppointmentLookup.jsx -- public "check my appointment status" page (no
// login required, reached from the Login page or after submitting a
// request). Clients aren't Supabase Auth users anywhere in this app, so
// this is a narrow two-factor lookup (last name + email or phone) against
// a SECURITY DEFINER RPC (lookup_client_appointments) rather than a real
// account -- see that migration for the accepted trade-off.
//
// This pass redesigns the page as part of the visitor experience the check-in
// kiosk belongs to (CheckInVisitor.jsx): one wide white frame, the NB4HS logo
// centred at the top, kiosk-scale touch targets, and a layout that reflows to
// a single column on a phone. The lookup itself is untouched -- same
// uncontrolled fields read at submit time, same required-last-name plus
// email-or-phone rule, same RPC, same rows rendered. What is new is that the
// three outcomes are now told apart: a validation problem, an empty result,
// and a request that failed (which must never be reported as "you have no
// appointment").
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { lookupClientAppointments } from "../lib/clientsData.js";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import LangSelect from "../components/LangSelect.jsx";
import AppointmentLookupForm from "../components/appointment/AppointmentLookupForm.jsx";
import AppointmentResults from "../components/appointment/AppointmentResults.jsx";
import AppointmentLookupHelp from "../components/appointment/AppointmentLookupHelp.jsx";

export default function AppointmentLookup() {
  const { setKiosk, lang, showToast } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const formRef = useRef(null);
  // Field name -> message shown under that field. Same two rules as before
  // (last name required; email or phone required), the message just says
  // which one failed instead of only turning the borders red.
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  // null = nothing searched yet, then "results" | "empty" | "error".
  const [state, setState] = useState(null);
  const [results, setResults] = useState([]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    const form = formRef.current;
    const val = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const lastName = val("lastName"), email = val("email"), phone = val("phone");

    const errs = {};
    if (!lastName) errs.lastName = t("apptLookupLastNameError");
    if (!email && !phone) errs.contact = t("apptLookupContactError");
    if (Object.keys(errs).length) {
      setErrors(errs);
      showToast(t("fixErrors"));
      const firstEl = form.querySelector('[name="' + (errs.lastName ? "lastName" : "email") + '"]');
      if (firstEl) firstEl.focus();
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const rows = await lookupClientAppointments(lastName, email, phone);
      setResults(rows);
      setState(rows.length ? "results" : "empty");
    } catch (err) {
      // The RPC failed (offline, timeout, server error). Saying "no
      // appointments found" here would be a lie, so this gets its own state.
      setResults([]);
      setState("error");
    } finally {
      setLoading(false);
    }
  }

  // "Try Again" from the empty/error state: clear the outcome and put the
  // visitor back in the first field rather than navigating anywhere.
  function handleRetry() {
    setState(null);
    setResults([]);
    const firstEl = formRef.current?.querySelector('[name="lastName"]');
    if (firstEl) firstEl.focus();
  }

  return (
    <div className="appt-lookup flex w-full flex-1 flex-col">
      <div className="mx-auto w-full max-w-[1400px] rounded-[22px] border border-border bg-card p-5 shadow-card sm:p-7 lg:p-9">
        {/* On a phone the logo takes a centred row of its own under the Back
            and language controls; from sm up the three sit on one row with the
            logo between them, as the kiosk design has it. */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { setKiosk(false); navigate("/"); }}
            className="order-1 flex min-h-[50px] shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-4 text-[1rem] font-bold text-navy dark:text-[color:var(--text)] transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5 sm:text-[1.02rem]"
          >
            <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" className="text-primary" />
            {t("back")}
          </button>
          <div className="order-2 ml-auto shrink-0 sm:order-3">
            <LangSelect />
          </div>
          <img
            src={LOGO_DATA_URI}
            alt={ORG.name}
            className="order-3 mx-auto h-11 w-full object-contain sm:order-2 sm:h-14 sm:w-auto lg:h-16"
          />
        </div>

        <div className="mt-6 flex items-start gap-4 sm:mt-8 sm:gap-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-[76px] sm:w-[76px] lg:h-[88px] lg:w-[88px]">
            <Search size={28} strokeWidth={2.4} aria-hidden="true" className="sm:h-9 sm:w-9 lg:h-11 lg:w-11" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-[1.75rem] font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:text-[2.4rem] lg:text-[2.8rem]">
              {t("apptLookupTitle")}
            </h1>
            <p className="m-0 mt-1.5 max-w-[52ch] text-[1rem] leading-snug text-muted sm:text-[1.15rem]">
              {t("apptLookupDesc")}
            </p>
          </div>
        </div>

        <hr className="mt-5 border-0 border-t border-border sm:mt-6" />

        <AppointmentLookupForm
          formRef={formRef}
          onSubmit={handleSubmit}
          errors={errors}
          busy={loading}
          t={t}
        />

        {state && (
          <AppointmentResults
            state={state}
            results={results}
            lang={lang}
            t={t}
            onRetry={handleRetry}
          />
        )}

        <AppointmentLookupHelp title={t("landingNeedHelp")} text={t("apptLookupHelpText")} />
      </div>
    </div>
  );
}
