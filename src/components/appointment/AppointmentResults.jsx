// AppointmentResults.jsx -- what the public lookup page shows underneath the
// form once a search has run: the matching appointments, a friendly empty
// state, or a "we couldn't check right now" state.
//
// The three are deliberately distinct: a request that failed must not tell a
// visitor their appointment doesn't exist. Every field rendered here comes
// straight from lookup_client_appointments' own columns (date, time, who the
// meeting is with, status, reason) -- nothing is derived or invented, and no
// identifier or internal note is exposed.
import { CalendarDays, CalendarX2, Clock, MessageSquareText, TriangleAlert, UserRound } from "lucide-react";
import { apptStatusBadgeClass, apptStatusLabel, meetingWithLabel } from "../../lib/appointments.js";
import { fmtDateLong } from "../../lib/utils.js";
import { cn } from "../../lib/cn.js";

function StatusPill({ status, lang }) {
  return (
    <span className={cn("badge shrink-0", apptStatusBadgeClass(status))}>{apptStatusLabel(status, lang)}</span>
  );
}

function AppointmentCard({ appt, lang, t }) {
  return (
    <li className="rounded-[16px] border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
            <CalendarDays size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[1.1rem] font-extrabold leading-tight text-navy dark:text-[color:var(--text)] sm:text-[1.2rem]">
              {fmtDateLong(appt.date, lang)}
            </p>
            {appt.time && (
              <p className="m-0 mt-1 flex items-center gap-1.5 text-[0.95rem] font-semibold text-muted">
                <Clock size={16} strokeWidth={2} aria-hidden="true" className="text-primary" />
                {appt.time}
              </p>
            )}
          </div>
        </div>
        <StatusPill status={appt.status} lang={lang} />
      </div>

      <dl className="m-0 mt-3 flex flex-col gap-2 border-t border-border pt-3 text-[0.95rem] sm:flex-row sm:flex-wrap sm:gap-x-8">
        <div className="flex min-w-0 items-start gap-2">
          <dt className="sr-only">{t("calendarStaffMember")}</dt>
          <UserRound size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
          <dd className="m-0 font-semibold text-navy dark:text-[color:var(--text)]">{meetingWithLabel(appt.meetingWith, lang)}</dd>
        </div>
        {appt.reason && (
          <div className="flex min-w-0 items-start gap-2">
            <dt className="sr-only">{t("apptLookupReasonLabel")}</dt>
            <MessageSquareText size={18} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-muted" />
            <dd className="m-0 min-w-0 text-muted">{appt.reason}</dd>
          </div>
        )}
      </dl>
    </li>
  );
}

function LookupState({ tone, icon: StateIcon, title, description, actionLabel, onAction }) {
  return (
    <div
      className={cn(
        "rounded-[18px] border p-6 text-center sm:p-8",
        tone === "error" ? "border-accent/40 bg-accent-tint" : "border-border bg-background"
      )}
    >
      <span
        className={cn(
          "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
          tone === "error" ? "bg-card text-accent" : "bg-primary-tint text-primary"
        )}
      >
        <StateIcon size={28} strokeWidth={2} aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-[1.2rem] font-extrabold text-navy dark:text-[color:var(--text)] sm:text-[1.35rem]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[46ch] text-[0.98rem] leading-snug text-muted">{description}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="btn-secondary mt-4 min-h-[50px] px-7 text-[1rem] font-bold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function AppointmentResults({ state, results, lang, t, onRetry }) {
  if (state === "error") {
    return (
      <div className="mt-7" role="status" aria-live="polite">
        <LookupState
          tone="error"
          icon={TriangleAlert}
          title={t("apptLookupErrorTitle")}
          description={t("apptLookupErrorDesc")}
          actionLabel={t("apptLookupTryAgain")}
          onAction={onRetry}
        />
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="mt-7" role="status" aria-live="polite">
        <LookupState
          icon={CalendarX2}
          title={t("apptLookupNoResultsTitle")}
          description={t("apptLookupNoResultsBody")}
          actionLabel={t("apptLookupTryAgain")}
          onAction={onRetry}
        />
      </div>
    );
  }

  return (
    <section className="mt-7" aria-live="polite">
      <h2 className="text-[1.25rem] font-extrabold text-navy dark:text-[color:var(--text)] sm:text-[1.4rem]">
        {t("apptLookupResultsTitle")}
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
        {results.map((appt, i) => (
          <AppointmentCard key={i} appt={appt} lang={lang} t={t} />
        ))}
      </ul>
    </section>
  );
}
