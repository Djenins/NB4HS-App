// ApptRequestSuccess.jsx -- confirmation shown after an appointment request
// is filed, in the shared kiosk result frame (components/kiosk/KioskResult.jsx).
// "Back to Home" returns to the kiosk start screen and "Check its status"
// opens the appointment lookup. The wording stays careful on one point: the
// request was *received*, not confirmed -- staff still confirm the time.
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Search } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import KioskResult, { RESULT_PRIMARY_BTN, RESULT_SECONDARY_BTN } from "../components/kiosk/KioskResult.jsx";
import calendarIllustration from "../assets/nb4hs-appointment-calendar.svg";

export default function ApptRequestSuccess() {
  const t = useT();
  const navigate = useNavigate();

  return (
    <KioskResult
      title={t("apptRequestSuccessTitle")}
      actions={
        <>
          <button type="button" onClick={() => navigate("/checkin", { replace: true })} className={RESULT_PRIMARY_BTN}>
            <CalendarCheck size={22} strokeWidth={2.2} aria-hidden="true" />
            {t("backToHomeBtn")}
          </button>
          <button type="button" onClick={() => navigate("/appointments/lookup")} className={RESULT_SECONDARY_BTN}>
            <Search size={20} strokeWidth={2.2} aria-hidden="true" className="text-primary" />
            {t("apptLookupLink")}
          </button>
        </>
      }
    >
      <p className="m-0">{t("apptRequestSuccessDesc")}</p>
      <img src={calendarIllustration} alt="" aria-hidden="true" className="mt-2 hidden h-[124px] w-auto object-contain sm:block" />
    </KioskResult>
  );
}
