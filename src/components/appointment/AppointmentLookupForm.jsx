// AppointmentLookupForm.jsx -- the lookup form on the public "Check Your
// Appointment" page: Last Name, then Email OR Phone Number either side of an
// "OR" divider, then the primary Find My Appointments button.
//
// Presentation only. The inputs stay uncontrolled and are read back by the
// page via form.elements at submit time (the same way they always were), and
// the required/optional split shown here is exactly the rule the page
// validates: last name is required, and at least one of email/phone.
import { Info, Loader2, Mail, Phone, Search, UserRound } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { formatPhone } from "../../lib/utils.js";

// main.css's bare `input` rule already supplies the fill, 14px radius, border
// and blue focus ring used everywhere else in the app -- these utilities only
// scale that up to the touch target this visitor-facing page needs (56px on a
// phone, 62px on the kiosk) and leave room for the leading icon.
const LOOKUP_INPUT =
  "w-full min-h-[56px] rounded-[14px] pl-[52px] text-base sm:min-h-[62px] sm:text-[1.05rem]";

function LookupField({ name, label, type = "text", required, icon: LeadingIcon, placeholder, autoComplete, error, invalid, describedBy }) {
  const id = "appt-lookup-" + name;
  const errorId = error ? id + "-error" : undefined;
  // `invalid` without `error` is the phone half of the email-or-phone rule:
  // both fields turn red, but the one message sits under the pair.
  const isInvalid = invalid || !!error;
  const described = [describedBy, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[0.98rem] font-bold text-navy dark:text-[color:var(--text)]">
        {label}
        {required && <span className="text-accent" aria-hidden="true"> *</span>}
      </label>
      <div className="relative">
        <LeadingIcon
          size={21}
          strokeWidth={2}
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
        />
        <input
          type={type}
          name={name}
          id={id}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-required={required ? "true" : undefined}
          aria-invalid={isInvalid ? "true" : undefined}
          aria-describedby={described}
          className={cn(LOOKUP_INPUT, isInvalid && "field-invalid")}
          onInput={type === "tel" ? (e) => { e.target.value = formatPhone(e.target.value); } : undefined}
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[0.92rem] font-semibold text-accent">{error}</p>
      )}
    </div>
  );
}

export default function AppointmentLookupForm({ formRef, onSubmit, errors, busy, t }) {
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 sm:mt-7">
      <LookupField
        name="lastName"
        label={t("lastName")}
        required
        icon={UserRound}
        autoComplete="family-name"
        placeholder={t("apptLookupLastNamePlaceholder")}
        error={errors.lastName}
      />

      <p id="appt-lookup-contact-hint" className="mt-4 flex items-start gap-2.5 text-[0.98rem] leading-snug text-muted sm:mt-5">
        <Info size={20} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
        {t("apptLookupContactHint")}
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-5">
        <LookupField
          name="email"
          label={t("email")}
          type="email"
          icon={Mail}
          autoComplete="email"
          placeholder={t("apptLookupEmailPlaceholder")}
          describedBy="appt-lookup-contact-hint"
          error={errors.contact}
        />
        {/* Functional cue, not decoration: email and phone are alternatives,
            so the divider runs between them on the kiosk and collapses to a
            single horizontal rule once they stack on a phone. */}
        <div aria-hidden="true" className="flex items-center justify-center gap-3 md:flex-col md:gap-2">
          <span className="h-px flex-1 bg-border md:h-auto md:w-px" />
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[0.85rem] font-extrabold uppercase tracking-wide text-primary">
            {t("orLabel")}
          </span>
          <span className="h-px flex-1 bg-border md:h-auto md:w-px" />
        </div>
        <LookupField
          name="phone"
          label={t("phoneOptional")}
          type="tel"
          icon={Phone}
          autoComplete="tel"
          placeholder="(555) 123-4567"
          describedBy={"appt-lookup-contact-hint" + (errors.contact ? " appt-lookup-email-error" : "")}
          invalid={!!errors.contact}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className={cn(
          "mt-5 flex w-full items-center justify-center gap-3 rounded-[14px] bg-primary px-5 font-bold text-white",
          "min-h-[60px] text-[1.05rem] sm:min-h-[68px] sm:text-[1.2rem]",
          "shadow-[0_6px_18px_rgba(37,99,235,.28)] transition-colors duration-150",
          "hover:bg-primary-dark active:bg-primary-dark",
          "focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary",
          busy && "cursor-not-allowed opacity-70"
        )}
      >
        {busy ? (
          <Loader2 size={24} strokeWidth={2.4} aria-hidden="true" className="animate-spin" />
        ) : (
          <Search size={24} strokeWidth={2.4} aria-hidden="true" />
        )}
        {busy ? t("apptLookupSearching") : t("apptLookupBtn")}
      </button>
    </form>
  );
}
