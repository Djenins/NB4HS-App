// CheckInSuccess.jsx -- confirmation after a kiosk check-in (student or
// visitor). The just-checked-in visit comes through router navigation state.
// Shares the kiosk result frame (components/kiosk/KioskResult.jsx) with the
// other kiosk confirmations, and returns to the start screen after a few
// seconds so the next person starts fresh.
import { useLocation, useNavigate } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import { useNavItems } from "../lib/useNavItems.js";
import KioskResult, { RESULT_PRIMARY_BTN } from "../components/kiosk/KioskResult.jsx";

export default function CheckInSuccess() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const isStudent = location.state && location.state.kind === "student";
  const className = (location.state && location.state.className) || "";
  // Back to check-in -- or, for staff who checked a visitor in from Visitor
  // Search and can't open the check-in screen, back to Visitor Search.
  const { kiosk } = useApp();
  const { items } = useNavItems();
  const home = kiosk || items.indexOf("checkin") !== -1 ? "/checkin" : "/search";

  const heading = isStudent ? t("checkInSuccessStudent") : t("checkInSuccess");
  const sub = isStudent
    ? (className ? t("checkInSuccessStudentSub").replace("{class}", className) : null)
    : t("checkInSuccessSub");

  return (
    <KioskResult
      title={heading}
      returnAfterMs={8000}
      onReturn={() => navigate(home, { replace: true })}
      actions={
        <button type="button" onClick={() => navigate(home, { replace: true })} className={RESULT_PRIMARY_BTN}>
          <RotateCcw size={22} strokeWidth={2.2} aria-hidden="true" />
          {t("newCheckIn")}
        </button>
      }
    >
      {sub && <p className="m-0 font-semibold text-card-foreground">{sub}</p>}
      <p className="m-0">{t("checkOutReminder")}</p>
    </KioskResult>
  );
}
