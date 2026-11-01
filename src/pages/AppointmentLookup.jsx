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
import { Search } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { lookupClientAppointments } from "../lib/clientsData.js";
import KioskPageHeader from "../components/kiosk/KioskPageHeader.jsx";
import AppointmentLookupForm from "../components/appointment/AppointmentLookupForm.jsx";
import AppointmentResults from "../components/appointment/AppointmentResults.jsx";
import AppointmentLookupHelp from "../components/appointment/AppointmentLookupHelp.jsx";

export default function AppointmentLookup() {
  const { lang, showToast } = useApp();
  const t = useT();
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
      <div className="mx-auto w-full max-w-[1400px] rounded-surface sm:border sm:border-border sm:bg-card sm:p-7 sm:shadow-card lg:p-9">
        {/* Back, logo and language live in the shared KioskTopBar (Shell.jsx). */}
        <KioskPageHeader icon={Search} title={t("apptLookupTitle")} description={t("apptLookupDesc")} />

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
