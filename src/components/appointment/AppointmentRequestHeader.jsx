// AppointmentRequestHeader.jsx -- the top of the public "Request an
// Appointment" screen: the Back control, the official NB4HS logo, the
// language picker, and the page's title block.
//
// Same treatment as the check-in kiosk and the appointment-lookup page, so
// the three visitor-facing screens read as one system: the logo is the real
// brand asset (lib/logo.js), never redrawn in CSS, and Back keeps whatever
// behaviour the page hands it.
import { ArrowLeft } from "lucide-react";
import { ORG } from "../../lib/constants.js";
import { LOGO_DATA_URI } from "../../lib/logo.js";
import LangSelect from "../LangSelect.jsx";

export default function AppointmentRequestHeader({ icon: TitleIcon, title, description, backLabel, onBack }) {
  return (
    <header className="shrink-0">
      {/* 1fr | auto | 1fr keeps the logo optically centred whatever the Back
          button's translated width is, and leaves the right cell empty on a
          phone (where the language picker moves below) -- same header
          construction as the appointment-lookup page. */}
      <div className="appt-brandbar grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[50px] shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-4 text-[1rem] font-bold text-navy dark:text-[color:var(--text)] transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5 sm:text-[1.02rem]"
        >
          <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" className="text-primary" />
          {backLabel}
        </button>
        <img src={LOGO_DATA_URI} alt={ORG.name} className="appt-logo h-11 w-auto max-w-full justify-self-center object-contain sm:h-14" />
        <div className="hidden justify-self-end sm:block">
          <LangSelect />
        </div>
      </div>
      {/* No room for the language picker beside the logo on a narrow phone,
          so it moves under the header row there instead. */}
      <div className="mt-3 flex justify-center sm:hidden">
        <LangSelect />
      </div>

      <div className="appt-title mt-5 flex items-start gap-4 sm:gap-5">
        <span className="appt-title-badge flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary sm:h-[72px] sm:w-[72px]">
          <TitleIcon size={28} strokeWidth={2.4} aria-hidden="true" className="sm:h-9 sm:w-9" />
        </span>
        <div className="min-w-0">
          <h1 className="appt-h1 m-0 text-[1.7rem] font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:text-[2.3rem] xl:text-[2.6rem]">
            {title}
          </h1>
          <p className="appt-lede m-0 mt-1.5 max-w-[60ch] text-[1rem] leading-snug text-muted sm:text-[1.12rem]">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
