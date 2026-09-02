// ApptRequestSuccess.jsx -- confirmation shown after a request is filed.
// Ported from checkin_checkout.js's renderApptRequestSuccess(); "Back to
// home" still always lands on the public login screen and clears kiosk mode,
// same as the original (attachViewHandlers: App.state.kiosk = false;
// App.state.view = "login"), and "Check its status" still goes to the public
// lookup page.
//
// Restyled with the appointment-request kiosk so the visitor lands somewhere
// that looks like the screen they just left -- same frame, same logo, same
// touch scale. The wording is unchanged and stays careful on the one point
// that matters here: the request was *received*, not confirmed. A staff
// member still has to confirm the date and time.
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Check, Search } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { ORG } from "../lib/constants.js";
import { LOGO_DATA_URI } from "../lib/logo.js";
import calendarIllustration from "../assets/nb4hs-appointment-calendar.svg";

export default function ApptRequestSuccess() {
  const { setKiosk } = useApp();
  const t = useT();
  const navigate = useNavigate();

  return (
    <div className="appt-request flex w-full flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[880px] flex-col items-center rounded-[22px] border border-border bg-card p-6 text-center shadow-card sm:p-9">
        <img src={LOGO_DATA_URI} alt={ORG.name} className="h-11 w-auto object-contain sm:h-14" />

        <span className="success-icon mt-6 flex h-[76px] w-[76px] items-center justify-center rounded-full bg-success text-white sm:h-[88px] sm:w-[88px]">
          <Check size={40} strokeWidth={3} aria-hidden="true" />
        </span>

        <h1 className="m-0 mt-5 text-[1.75rem] font-extrabold leading-tight tracking-tight text-navy dark:text-[color:var(--text)] sm:text-[2.2rem]">
          {t("apptRequestSuccessTitle")}
        </h1>
        <p className="m-0 mt-2.5 max-w-[52ch] text-[1.02rem] leading-snug text-muted sm:text-[1.12rem]">
          {t("apptRequestSuccessDesc")}
        </p>

        <img
          src={calendarIllustration}
          alt=""
          aria-hidden="true"
          className="mt-5 hidden h-[124px] w-auto object-contain sm:block"
        />

        <div className="mt-7 flex w-full max-w-[440px] flex-col gap-3">
          <button
            type="button"
            onClick={() => { setKiosk(false); navigate("/"); }}
            className="flex min-h-[62px] w-full items-center justify-center gap-3 rounded-[14px] bg-primary px-5 text-[1.1rem] font-bold text-white shadow-[0_6px_18px_rgba(37,99,235,.28)] transition-colors duration-150 hover:bg-primary-dark focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <CalendarCheck size={22} strokeWidth={2.2} aria-hidden="true" />
            {t("backToHomeBtn")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/appointments/lookup")}
            className="flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-secondary-border bg-card px-5 text-[1.02rem] font-bold text-navy dark:text-[color:var(--text)] transition-colors hover:bg-primary-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Search size={20} strokeWidth={2.2} aria-hidden="true" className="text-primary" />
            {t("apptLookupLink")}
          </button>
        </div>
      </div>
    </div>
  );
}
