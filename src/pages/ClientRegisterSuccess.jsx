// ClientRegisterSuccess.jsx -- confirmation after a client registers
// themself (ClientRegister.jsx), in the shared kiosk result frame. On the
// kiosk it returns to the check-in screen by itself after a short pause so
// the next visitor doesn't land on someone else's confirmation -- and back in
// English, since this visitor's language choice shouldn't carry over to them.
import { useLocation, useNavigate } from "react-router-dom";
import { House } from "lucide-react";
import { useApp, useT } from "../context/AppContext.jsx";
import KioskResult, { RESULT_PRIMARY_BTN } from "../components/kiosk/KioskResult.jsx";

const KIOSK_RETURN_MS = 20000;

export default function ClientRegisterSuccess() {
  const { kiosk, setLang } = useApp();
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const checkedIn = !!(location.state && location.state.checkedIn);

  function goHome() {
    setLang("en");
    navigate("/checkin", { replace: true });
  }

  return (
    <KioskResult
      title={t("registerSuccessTitle")}
      returnAfterMs={kiosk ? KIOSK_RETURN_MS : 0}
      onReturn={goHome}
      // On a client's own phone there's nowhere to go back to.
      actions={kiosk ? (
        <button type="button" onClick={goHome} className={RESULT_PRIMARY_BTN}>
          <House size={22} strokeWidth={2.2} aria-hidden="true" />
          {t("backToHomeBtn")}
        </button>
      ) : null}
    >
      <p className="m-0">{t("registerSuccessDesc")}</p>
      {checkedIn && (
        <p className="m-0 rounded-[14px] border border-border bg-tint-success px-4 py-3 font-semibold text-success">
          {t("registerCheckedInNote")}
        </p>
      )}
    </KioskResult>
  );
}
